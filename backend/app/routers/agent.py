import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import (
    User,
    Device,
    Application,
    ApplicationSession,
    ProcessResourceMetric,
    BrowserTabSession,
    ContextSwitchEvent,
    InputActivityWindow,
    WorkSession,
)
from ..schemas import (
    AgentRegisterRequest,
    AgentRegisterResponse,
    ActivityBatchResponse,
    ActivityBatchProcessed,
)
from ..activity_validation import validate_activity_batch, validate_activity_batch_domain

router = APIRouter(tags=["agent"])


@router.post("/agent/register", response_model=AgentRegisterResponse)
def register_device(
    body: AgentRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Registers (or re-registers) a desktop agent for the authenticated user.

    Auth note: openapi.yaml did not originally mark this endpoint as
    requiring bearerAuth. Since full JWT auth was requested, it's been added
    here and the contract updated to match — a device can only ever be
    created under the identity of the employee whose agent is running, which
    is also what lets /activity/batch trust device ownership below.
    """
    existing = (
        db.query(Device)
        .filter(Device.user_id == current_user.id, Device.device_name == body.device_name)
        .first()
    )

    if existing:
        existing.os = body.os
        existing.agent_version = body.agent_version
        existing.last_seen = datetime.now(timezone.utc)
        existing.status = "ACTIVE"
        db.commit()
        return AgentRegisterResponse(device_id=existing.id, status="re-registered")

    device = Device(
        user_id=current_user.id,
        device_name=body.device_name,
        os=body.os,
        agent_version=body.agent_version,
        last_seen=datetime.now(timezone.utc),
        status="ACTIVE",
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return AgentRegisterResponse(device_id=device.id, status="registered")


def _get_or_create_application(db: Session, name: str, process_name: str, category: str) -> Application:
    app = db.query(Application).filter(Application.process_name == process_name).first()
    if app:
        return app
    app = Application(name=name, process_name=process_name, category=category)
    db.add(app)
    db.flush()  # get app.id without a full commit
    return app


@router.post("/activity/batch", response_model=ActivityBatchResponse)
@router.post("/agent/events/batch", response_model=ActivityBatchResponse)
def ingest_activity_batch(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schema_errors = validate_activity_batch(payload)
    if schema_errors:
        raise HTTPException(status_code=422, detail={"schema_errors": schema_errors})

    domain_errors = validate_activity_batch_domain(payload)
    if domain_errors:
        raise HTTPException(status_code=422, detail={"domain_errors": domain_errors})

    device = db.get(Device, payload["device_id"])
    if device is None or device.user_id != current_user.id:
        # Deliberately the same error whether the device doesn't exist or
        # belongs to someone else — don't leak which.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="device_id does not belong to the authenticated user",
        )

    # -----------------------------------------------------------------------
    # Backend Stage 2 — Session Reconstruction (T_gap = 15 minutes)
    # -----------------------------------------------------------------------
    period_start_dt = datetime.fromisoformat(payload["period_start"].replace("Z", "+00:00"))
    period_end_dt = datetime.fromisoformat(payload["period_end"].replace("Z", "+00:00"))
    input_activity_payload = payload.get("input_activity", {})
    batch_active_sec = input_activity_payload.get("active_seconds", 0)
    batch_idle_sec = input_activity_payload.get("idle_seconds", 0)

    T_GAP_SECONDS = 15.0 * 60.0  # 15 minutes
    latest_session = (
        db.query(WorkSession)
        .filter(WorkSession.user_id == current_user.id, WorkSession.device_id == device.id)
        .order_by(WorkSession.end_time.desc())
        .first()
    )

    current_work_session = None
    if latest_session and latest_session.end_time:
        delta_t = (period_start_dt - latest_session.end_time).total_seconds()
        if 0 <= delta_t <= T_GAP_SECONDS:
            # Delta t <= T_gap => Coalesce into existing session
            latest_session.end_time = max(latest_session.end_time, period_end_dt)
            latest_session.active_seconds += batch_active_sec
            latest_session.idle_seconds += batch_idle_sec
            current_work_session = latest_session

    if current_work_session is None:
        # Delta t > T_gap (or first session) => New session boundary
        current_work_session = WorkSession(
            user_id=current_user.id,
            device_id=device.id,
            start_time=period_start_dt,
            end_time=period_end_dt,
            active_seconds=batch_active_sec,
            idle_seconds=batch_idle_sec,
        )
        db.add(current_work_session)
        db.flush()

    application_session_count = 0
    browser_tab_count = 0

    for app_payload in payload.get("applications", []):
        application = _get_or_create_application(
            db,
            name=app_payload["name"],
            process_name=app_payload["process_name"],
            category=app_payload["category"],
        )

        session = ApplicationSession(
            user_id=current_user.id,
            device_id=device.id,
            work_session_id=current_work_session.id,
            application_id=application.id,
            start_time=app_payload["start_time"],
            end_time=app_payload["end_time"],
            duration_seconds=app_payload["duration_seconds"],
        )
        db.add(session)
        db.flush()
        application_session_count += 1

        resource_usage = app_payload.get("resource_usage")
        if resource_usage:
            db.add(
                ProcessResourceMetric(
                    application_session_id=session.id,
                    user_id=current_user.id,
                    device_id=device.id,
                    window_start=app_payload["start_time"],
                    window_end=app_payload["end_time"],
                    avg_cpu_percent=resource_usage["avg_cpu_percent"],
                    max_cpu_percent=resource_usage["max_cpu_percent"],
                    avg_gpu_percent=resource_usage["avg_gpu_percent"],
                    max_gpu_percent=resource_usage["max_gpu_percent"],
                    sample_count=resource_usage["sample_count"],
                )
            )

        for tab in app_payload.get("browser_tabs", []):
            db.add(
                BrowserTabSession(
                    application_session_id=session.id,
                    user_id=current_user.id,
                    device_id=device.id,
                    domain=tab["domain"],
                    start_time=tab["start_time"],
                    end_time=tab["end_time"],
                    duration_seconds=tab["duration_seconds"],
                )
            )
            browser_tab_count += 1

    context_switches = payload.get("context_switches") or {"events": []}
    context_switch_count = 0
    for event in context_switches.get("events", []):
        db.add(
            ContextSwitchEvent(
                user_id=current_user.id,
                device_id=device.id,
                work_session_id=current_work_session.id,
                switch_type=event["type"],
                from_context=event["from"],
                to_context=event["to"],
                timestamp=event["timestamp"],
            )
        )
        context_switch_count += 1

    input_activity = payload["input_activity"]
    db.add(
        InputActivityWindow(
            user_id=current_user.id,
            device_id=device.id,
            window_start=payload["period_start"],
            window_end=payload["period_end"],
            keystroke_count=input_activity["keystroke_count"],
            mouse_event_count=input_activity["mouse_event_count"],
            active_seconds=input_activity["active_seconds"],
            idle_seconds=input_activity["idle_seconds"],
        )
    )

    device.last_seen = datetime.now(timezone.utc)
    db.commit()

    return ActivityBatchResponse(
        status="accepted",
        batch_id=str(uuid.uuid4()),
        processed=ActivityBatchProcessed(
            application_sessions=application_session_count,
            browser_tab_sessions=browser_tab_count,
            context_switches=context_switch_count,
        ),
    )

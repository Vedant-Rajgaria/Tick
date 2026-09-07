"""
Employee-facing read endpoints.

Added to give the employee dashboard a real data source (it previously had
none — only auth and agent/activity-ingestion existed).
"""
from datetime import date as date_cls, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User, Application, ApplicationSession, InputActivityWindow, Task
from ..schemas import (
    EmployeeDashboardResponse,
    WorkPulseSegment,
    AppUsageItem,
    HourlyActivityPoint,
    TaskResponse,
    CompleteTaskResponse,
)

router = APIRouter(tags=["employee"])


def _format_duration(total_seconds: int) -> str:
    total_seconds = int(total_seconds or 0)
    hours, remainder = divmod(total_seconds, 3600)
    minutes = remainder // 60
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def _format_time(dt) -> str:
    if dt is None:
        return ""
    local_dt = dt.astimezone() if dt.tzinfo else dt
    return local_dt.strftime("%I:%M %p")


def build_employee_dashboard(
    db: Session,
    user_id: int,
    day: date_cls | None = None,
) -> EmployeeDashboardResponse:
    """Builds the dynamic dashboard data (work pulse, app usage, hourly activity graph,
    and active/idle metrics) for a given user from real database records."""
    session_query = db.query(ApplicationSession).filter(ApplicationSession.user_id == user_id)
    if day is not None:
        session_query = session_query.filter(cast(ApplicationSession.start_time, Date) == day)
    sessions = session_query.order_by(ApplicationSession.start_time.asc()).all()

    window_query = db.query(InputActivityWindow).filter(InputActivityWindow.user_id == user_id)
    if day is not None:
        window_query = window_query.filter(cast(InputActivityWindow.window_start, Date) == day)
    windows = window_query.order_by(InputActivityWindow.window_start.asc()).all()

    total_seconds = sum(s.duration_seconds or 0 for s in sessions) or 1

    work_pulse: list[WorkPulseSegment] = []
    per_app_seconds: dict[int, int] = {}
    per_app_last_end: dict[int, object] = {}

    for session in sessions:
        app = db.get(Application, session.application_id)
        app_name = app.name if app else "Unknown"
        app_category = app.category if app else "other"
        duration = session.duration_seconds or 0

        work_pulse.append(
            WorkPulseSegment(
                app=app_name,
                start=_format_time(session.start_time),
                end=_format_time(session.end_time),
                duration=_format_duration(duration),
                type="session-work" if app_category == "development" else "active-work",
                width=f"{round((duration / total_seconds) * 100, 1)}%",
            )
        )

        per_app_seconds[session.application_id] = (
            per_app_seconds.get(session.application_id, 0) + duration
        )
        if session.end_time and (
            session.application_id not in per_app_last_end
            or session.end_time > per_app_last_end[session.application_id]
        ):
            per_app_last_end[session.application_id] = session.end_time

    applications: list[AppUsageItem] = []
    for app_id, seconds in sorted(per_app_seconds.items(), key=lambda kv: -kv[1]):
        app = db.get(Application, app_id)
        applications.append(
            AppUsageItem(
                name=app.name if app else "Unknown",
                duration=_format_duration(seconds),
                category=app.category if app else "other",
                lastActive=_format_time(per_app_last_end.get(app_id)),
            )
        )

    # Active & Idle calculation
    if windows:
        active_seconds = sum(w.active_seconds for w in windows)
        idle_seconds = sum(w.idle_seconds for w in windows)
    else:
        active_seconds = sum(s.duration_seconds or 0 for s in sessions)
        idle_seconds = 0

    # Hourly Activity points across workday (09:00 to 18:00)
    hours_to_track = list(range(9, 19))
    hourly_activity: list[HourlyActivityPoint] = []
    for h in hours_to_track:
        hour_label = f"{h:02d}:00"
        h_active = 0
        if windows:
            for w in windows:
                w_time = w.window_start.astimezone() if w.window_start.tzinfo else w.window_start
                if w_time.hour == h:
                    h_active += w.active_seconds
        else:
            for s in sessions:
                s_time = s.start_time.astimezone() if s.start_time.tzinfo else s.start_time
                if s_time.hour == h:
                    h_active += s.duration_seconds or 0
        intensity = min(100.0, round((h_active / 3600.0) * 100.0, 1))
        hourly_activity.append(HourlyActivityPoint(hour=hour_label, intensityPercent=intensity))

    return EmployeeDashboardResponse(
        workPulse=work_pulse,
        applications=applications,
        hourlyActivity=hourly_activity,
        activeSeconds=active_seconds,
        idleSeconds=idle_seconds,
        sessionCount=len(sessions),
    )


@router.get("/employee/me/dashboard", response_model=EmployeeDashboardResponse)
def get_employee_dashboard(
    date: date_cls | None = Query(default=None, description="Optional date filter YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_employee_dashboard(db, current_user.id, day=date)


@router.get("/employee/me/tasks", response_model=list[TaskResponse])
def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tasks = (
        db.query(Task)
        .filter(Task.assigned_to == current_user.id)
        .order_by(
            Task.status.desc(),  # 'TODO', 'IN_PROGRESS' first, 'COMPLETED' after
            Task.created_at.desc(),
        )
        .all()
    )
    result = []
    for t in tasks:
        result.append(TaskResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            assigned_to=t.assigned_to,
            assigned_name=current_user.name,
            created_by=t.created_by,
            estimated_hours=float(t.estimated_hours),
            actual_hours=float(t.actual_hours) if t.actual_hours is not None else None,
            status=t.status,
            priority=t.priority,
            deadline=str(t.deadline) if t.deadline else None,
            required_skills=t.required_skills or [],
            created_at=t.created_at,
            completed_at=t.completed_at,
        ))
    return result


@router.post("/employee/me/tasks/{task_id}/complete", response_model=CompleteTaskResponse)
def complete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None or task.assigned_to != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )

    now = datetime.now(timezone.utc)
    task.status = "COMPLETED"
    task.completed_at = now

    # Calculate actual hours: based on elapsed working time or default ~85% of estimate
    if task.created_at:
        elapsed_hours = max(0.5, round((now - task.created_at).total_seconds() / 3600.0, 1))
        # Reasonable bounded actual hours relative to estimated
        task.actual_hours = min(float(task.estimated_hours) * 1.2, max(0.5, elapsed_hours))
    else:
        task.actual_hours = float(task.estimated_hours)

    db.commit()
    db.refresh(task)

    return CompleteTaskResponse(
        id=task.id,
        status=task.status,
        completed_at=task.completed_at,
        actual_hours=float(task.actual_hours),
        message=f"Task '{task.title}' successfully marked as completed."
    )
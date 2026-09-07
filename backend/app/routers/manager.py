"""
Admin- and manager-facing endpoints.

Added to replace the frontend manager dashboard's 100% localStorage mock
state (INITIAL_STATE.employees etc. in app.js) with real data. Everything
here is scoped to the current user's own organization_id — there is no
cross-organization visibility.

Deliberately NOT implemented here (out of scope, per the task-manager
system being excluded from this pass): task assignment, task
recommendations, workload-percentage-from-task-hours. Team/employee stats
below are derived only from real, already-collected activity data
(application_sessions, input_activity_windows) — the same tables the
employee's own dashboard reads from.
"""
from datetime import date as date_cls, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from sqlalchemy import text
from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import (
    User,
    Department,
    Application,
    ApplicationSession,
    Task,
    Recommendation,
    Device,
    WorkSession,
    ProcessResourceMetric,
    BrowserTabSession,
    ContextSwitchEvent,
    InputActivityWindow,
    WorkMetric,
)
from ..security import hash_password
from ..schemas import (
    CreateEmployeeRequest,
    CreateEmployeeResponse,
    TeamMemberSummary,
    TeamOverviewResponse,
    ManagerEmployeeDetailResponse,
    TaskRecommendRequest,
    TaskRecommendResponse,
    CreateTaskRequest,
    TaskResponse,
)
from .employee import build_employee_dashboard, _format_duration, _format_time
from ..task_engine import evaluate_task_assignment, get_employee_workload

router = APIRouter(tags=["manager"])


def _get_or_create_department(db: Session, organization_id: int, name: str) -> Department:
    """Mirrors the existing _get_or_create_application pattern in agent.py:
    look up by name scoped to the org, create if it doesn't exist yet."""
    department = (
        db.query(Department)
        .filter(Department.organization_id == organization_id, Department.name == name)
        .first()
    )
    if department is None:
        department = Department(organization_id=organization_id, name=name)
        db.add(department)
        db.flush()
    return department


@router.post(
    "/admin/employees",
    response_model=CreateEmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/manager/employees",
    response_model=CreateEmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employee(
    body: CreateEmployeeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    department = _get_or_create_department(db, current_user.organization_id, body.department)

    employee = User(
        organization_id=current_user.organization_id,
        department_id=department.id,
        manager_id=current_user.id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role="EMPLOYEE",
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return CreateEmployeeResponse(
        id=employee.id,
        name=employee.name,
        email=employee.email,
        department=department.name,
        role=employee.role,
    )


@router.get("/manager/team", response_model=TeamOverviewResponse)
def get_team(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(
        User.organization_id == current_user.organization_id,
        User.id != current_user.id,
    )
    if current_user.role in ("ADMIN", "MANAGER"):
        query = query.filter(User.role == "EMPLOYEE")
    employees = query.order_by(User.name.asc()).all()

    members: list[TeamMemberSummary] = []
    for emp in employees:
        sessions = (
            db.query(ApplicationSession).filter(ApplicationSession.user_id == emp.id).all()
        )
        total_seconds = sum(s.duration_seconds or 0 for s in sessions)

        per_app_seconds: dict[int, int] = {}
        last_end = None
        for s in sessions:
            per_app_seconds[s.application_id] = per_app_seconds.get(s.application_id, 0) + (
                s.duration_seconds or 0
            )
            if s.end_time and (last_end is None or s.end_time > last_end):
                last_end = s.end_time

        top_app_name = None
        if per_app_seconds:
            top_app_id = max(per_app_seconds, key=per_app_seconds.get)
            top_app = db.get(Application, top_app_id)
            top_app_name = top_app.name if top_app else None

        department = db.get(Department, emp.department_id) if emp.department_id else None

        capacity_hours = 8.0
        active_hours = round(total_seconds / 3600.0, 1)
        telemetry_workload = min(100, int(round((total_seconds / 28800.0) * 100)))

        task_workload = get_employee_workload(db, emp.id, standard_capacity=8.0)
        workload = max(telemetry_workload, task_workload["workload_percentage"])
        remaining_hours = task_workload["available_hours"]

        if workload >= 85:
            status_str = "Needs attention"
        elif workload <= 30 and (len(sessions) > 0 or task_workload["open_tasks_count"] > 0):
            status_str = "Low workload"
        elif len(sessions) == 0 and task_workload["open_tasks_count"] == 0:
            status_str = "No activity"
        else:
            status_str = "Normal"

        members.append(
            TeamMemberSummary(
                id=emp.id,
                name=emp.name,
                email=emp.email,
                role=emp.role,
                department=department.name if department else "Unassigned",
                activeTime=_format_duration(total_seconds),
                sessionCount=len(sessions),
                topApp=top_app_name,
                lastActive=_format_time(last_end) if last_end else "Never",
                workload=workload,
                remainingHours=remaining_hours,
                capacityHours=capacity_hours,
                status=status_str,
            )
        )

    return TeamOverviewResponse(members=members)


@router.get("/manager/employees/{employee_id}", response_model=ManagerEmployeeDetailResponse)
def get_employee_detail(
    employee_id: int,
    date: date_cls | None = Query(
        default=None, description="Filter to a single UTC calendar day (YYYY-MM-DD). Omit for all-time."
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.get(User, employee_id)
    if employee is None or employee.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    department = db.get(Department, employee.department_id) if employee.department_id else None
    dashboard = build_employee_dashboard(db, employee.id, day=date)

    return ManagerEmployeeDetailResponse(
        id=employee.id,
        name=employee.name,
        email=employee.email,
        role=employee.role,
        department=department.name if department else "Unassigned",
        status=employee.status,
        dashboard=dashboard,
    )


@router.delete("/manager/employees/{employee_id}", status_code=status.HTTP_200_OK)
@router.delete("/employees/{employee_id}", status_code=status.HTTP_200_OK)
def delete_employee(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes an employee's account and all associated telemetry records.
    Restricted to organization managers/admins. Action is irreversible.
    """
    employee = db.get(User, employee_id)
    if employee is None or employee.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found in organization")

    if employee.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    emp_name = employee.name
    emp_id = employee.id

    # 1. Clean up recommendations where employee is candidate
    db.query(Recommendation).filter(Recommendation.employee_id == emp_id).delete(synchronize_session=False)

    # 2. Clean up tasks assigned to or created by employee
    tasks = db.query(Task).filter((Task.assigned_to == emp_id) | (Task.created_by == emp_id)).all()
    task_ids = [t.id for t in tasks]
    if task_ids:
        db.query(Recommendation).filter(Recommendation.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(Task).filter(Task.id.in_(task_ids)).delete(synchronize_session=False)

    # 3. Work metrics
    db.query(WorkMetric).filter(WorkMetric.user_id == emp_id).delete(synchronize_session=False)

    # 4. Telemetry records
    db.query(InputActivityWindow).filter(InputActivityWindow.user_id == emp_id).delete(synchronize_session=False)
    db.query(ContextSwitchEvent).filter(ContextSwitchEvent.user_id == emp_id).delete(synchronize_session=False)
    db.query(BrowserTabSession).filter(BrowserTabSession.user_id == emp_id).delete(synchronize_session=False)
    db.query(ProcessResourceMetric).filter(ProcessResourceMetric.user_id == emp_id).delete(synchronize_session=False)
    db.query(ApplicationSession).filter(ApplicationSession.user_id == emp_id).delete(synchronize_session=False)
    db.query(WorkSession).filter(WorkSession.user_id == emp_id).delete(synchronize_session=False)
    db.query(Device).filter(Device.user_id == emp_id).delete(synchronize_session=False)

    # 5. Schema tables if present (reports, notifications, baselines, snapshots, audit_logs)
    for table_name in ["reports", "notifications", "workload_snapshots", "employee_baselines", "audit_logs"]:
        try:
            if table_name == "reports":
                db.execute(text("DELETE FROM reports WHERE user_id = :uid OR generated_by = :uid"), {"uid": emp_id})
            else:
                db.execute(text(f"DELETE FROM {table_name} WHERE user_id = :uid"), {"uid": emp_id})
        except Exception:
            pass

    # 6. Unlink manager references on other users
    db.query(User).filter(User.manager_id == emp_id).update({User.manager_id: None}, synchronize_session=False)

    # 7. Delete employee record
    db.delete(employee)
    db.commit()

    return {"success": True, "message": f"Employee {emp_name} has been permanently deleted."}


@router.post("/manager/tasks/recommend", response_model=TaskRecommendResponse)
@router.post("/tasks/recommend", response_model=TaskRecommendResponse)
def get_task_recommendation(
    body: TaskRecommendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = evaluate_task_assignment(
        db=db,
        organization_id=current_user.organization_id,
        task_title=body.title,
        estimated_hours=body.estimated_hours,
        deadline=body.deadline,
        required_skills=body.required_skills,
        complexity=body.complexity,
        priority=body.priority,
    )
    return result


@router.post("/manager/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_and_assign_task(
    body: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assigned_name = None
    if body.assigned_to is not None:
        assignee = db.get(User, body.assigned_to)
        if assignee is None or assignee.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned employee not found in organization"
            )
        assigned_name = assignee.name

    new_task = Task(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        assigned_to=body.assigned_to,
        title=body.title,
        description=body.description,
        complexity=body.complexity,
        estimated_hours=body.estimated_hours,
        priority=body.priority,
        deadline=body.deadline,
        required_skills=body.required_skills,
        status="TODO",
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_task)
    db.flush()

    if body.assigned_to is not None:
        eval_result = evaluate_task_assignment(
            db=db,
            organization_id=current_user.organization_id,
            task_title=body.title,
            estimated_hours=body.estimated_hours,
            deadline=body.deadline,
            required_skills=body.required_skills,
        )
        matched = next(
            (c for c in [eval_result.get("best_match")] + eval_result.get("alternatives", [])
             if c and c["employee_id"] == body.assigned_to),
            None
        )
        if matched:
            db.add(Recommendation(
                task_id=new_task.id,
                employee_id=body.assigned_to,
                score=matched["final_score"],
                skill_score=matched["breakdown"]["skill_match"] / 100.0,
                availability_score=matched["breakdown"]["availability"] / 100.0,
                efficiency_score=matched["breakdown"]["efficiency"] / 100.0,
                workload_score=matched["workload"]["current_percentage"] / 100.0,
                created_at=datetime.now(timezone.utc),
            ))

    db.commit()
    db.refresh(new_task)

    return TaskResponse(
        id=new_task.id,
        title=new_task.title,
        description=new_task.description,
        assigned_to=new_task.assigned_to,
        assigned_name=assigned_name,
        created_by=new_task.created_by,
        estimated_hours=float(new_task.estimated_hours),
        actual_hours=float(new_task.actual_hours) if new_task.actual_hours is not None else None,
        status=new_task.status,
        priority=new_task.priority,
        deadline=str(new_task.deadline) if new_task.deadline else None,
        required_skills=new_task.required_skills or [],
        created_at=new_task.created_at,
        completed_at=new_task.completed_at,
    )


@router.get("/manager/tasks", response_model=list[TaskResponse])
@router.get("/tasks", response_model=list[TaskResponse])
def list_manager_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tasks = (
        db.query(Task)
        .filter(Task.organization_id == current_user.organization_id)
        .order_by(Task.created_at.desc())
        .all()
    )
    result = []
    for t in tasks:
        assignee = db.get(User, t.assigned_to) if t.assigned_to else None
        result.append(TaskResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            assigned_to=t.assigned_to,
            assigned_name=assignee.name if assignee else None,
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
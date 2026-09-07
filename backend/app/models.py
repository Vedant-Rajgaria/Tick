"""
ORM models mirroring backend/fixtures/schema.sql exactly.

If you change a column here, you MUST update schema.sql (and re-run
scripts/setup_local_db.sh --reset) to match — see
docs/CONTRACT_CHANGE_PROCESS.md. This file does not issue DDL; schema.sql
remains the authoritative source of truth for the database structure.
"""
from datetime import datetime, date
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Numeric,
    Boolean,
    DateTime,
    Date,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # EMPLOYEE | MANAGER | ADMIN
    status: Mapped[str] = mapped_column(String, nullable=False, default="ACTIVE")
    skills: Mapped[list | None] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    devices: Mapped[list["Device"]] = relationship(back_populates="user")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_name: Mapped[str] = mapped_column(String, nullable=False)
    os: Mapped[str] = mapped_column(String, nullable=False)  # WINDOWS | MACOS | LINUX
    agent_version: Mapped[str] = mapped_column(String, nullable=False)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, nullable=False, default="ACTIVE")

    user: Mapped["User"] = relationship(back_populates="devices")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    process_name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active_seconds: Mapped[int] = mapped_column(Integer, default=0)
    idle_seconds: Mapped[int] = mapped_column(Integer, default=0)


class ApplicationSession(Base):
    __tablename__ = "application_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    work_session_id: Mapped[int | None] = mapped_column(ForeignKey("work_sessions.id"))


class ProcessResourceMetric(Base):
    __tablename__ = "process_resource_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_session_id: Mapped[int] = mapped_column(
        ForeignKey("application_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    avg_cpu_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    max_cpu_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    avg_gpu_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    max_gpu_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)


class BrowserTabSession(Base):
    __tablename__ = "browser_tab_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_session_id: Mapped[int] = mapped_column(
        ForeignKey("application_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)


class ContextSwitchEvent(Base):
    __tablename__ = "context_switch_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    work_session_id: Mapped[int | None] = mapped_column(ForeignKey("work_sessions.id"))
    switch_type: Mapped[str] = mapped_column(String, nullable=False)  # APP | TAB
    from_context: Mapped[str] = mapped_column(String, nullable=False)
    to_context: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InputActivityWindow(Base):
    __tablename__ = "input_activity_windows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    keystroke_count: Mapped[int] = mapped_column(Integer, default=0)
    mouse_event_count: Mapped[int] = mapped_column(Integer, default=0)
    active_seconds: Mapped[int] = mapped_column(Integer, default=0)
    idle_seconds: Mapped[int] = mapped_column(Integer, default=0)
    focus_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    camera_active: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    eye_z_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    complexity: Mapped[str | None] = mapped_column(String)
    estimated_hours: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    actual_hours: Mapped[float | None] = mapped_column(Numeric(6, 2))
    status: Mapped[str] = mapped_column(String, nullable=False, default="TODO")
    priority: Mapped[str | None] = mapped_column(String)
    deadline: Mapped[date | None] = mapped_column(Date)
    required_skills: Mapped[list | None] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    skill_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    availability_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    efficiency_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    workload_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WorkMetric(Base):
    __tablename__ = "work_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    active_seconds: Mapped[int] = mapped_column(Integer, default=0)
    idle_seconds: Mapped[int] = mapped_column(Integer, default=0)
    total_work_seconds: Mapped[int] = mapped_column(Integer, default=0)
    app_switch_count: Mapped[int] = mapped_column(Integer, default=0)
    tab_switch_count: Mapped[int] = mapped_column(Integer, default=0)
    keystroke_count: Mapped[int] = mapped_column(Integer, default=0)
    mouse_event_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_cpu_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    avg_gpu_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    session_count: Mapped[int] = mapped_column(Integer, default=0)
    average_session_seconds: Mapped[int] = mapped_column(Integer, default=0)
    tasks_completed: Mapped[int] = mapped_column(Integer, default=0)
    tasks_overdue: Mapped[int] = mapped_column(Integer, default=0)

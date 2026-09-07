"""
Pydantic models for auth + agent endpoints.

Deliberately NOT duplicating the activity-batch shape here — that payload's
one and only source of truth is
backend/app/schemas/activity_batch.schema.json (see
docs/CONTRACT_CHANGE_PROCESS.md). It's validated directly against that file
in app/activity_validation.py instead of being re-modeled in Pydantic, so
the two can't silently drift apart.
"""
from typing import Any
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
import email_validator
email_validator.TEST_ENVIRONMENT = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    role: str


class UserProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: str | None = None
    organization: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str


class RegisterRequest(BaseModel):
    """
    First-admin signup. Always creates a brand-new Organization and a
    single ADMIN user inside it — there is no "join an existing org" path
    (see docs/CONTRACT_CHANGE_PROCESS.md discussion before adding one).
    """
    org_name: str
    name: str
    email: EmailStr
    password: str


# Registration returns the same shape as a login — access + refresh tokens
# plus the created user — so the frontend can reuse its existing
# token-storage code path for both.
RegisterResponse = LoginResponse


class AgentRegisterRequest(BaseModel):
    device_name: str
    os: str = Field(pattern="^(WINDOWS|MACOS|LINUX)$")
    agent_version: str


class AgentRegisterResponse(BaseModel):
    device_id: int
    status: str


class ActivityBatchProcessed(BaseModel):
    application_sessions: int
    browser_tab_sessions: int
    context_switches: int


class ActivityBatchResponse(BaseModel):
    status: str
    batch_id: str
    processed: ActivityBatchProcessed



class WorkPulseSegment(BaseModel):
    app: str
    start: str
    end: str
    duration: str
    type: str
    width: str


class AppUsageItem(BaseModel):
    name: str
    duration: str
    category: str
    lastActive: str


class HourlyActivityPoint(BaseModel):
    """One hour-of-day bucket of recorded input activity, used to draw the
    'Useful Work Graph' from real input_activity_windows rows instead of a
    hardcoded intensity array. intensityPercent is active_seconds / 3600,
    capped at 100 — a simplification (see docs), not a calibrated metric."""
    hour: str
    intensityPercent: float


class EmployeeDashboardResponse(BaseModel):
    workPulse: list[WorkPulseSegment]
    applications: list[AppUsageItem]
    hourlyActivity: list[HourlyActivityPoint] = []
    activeSeconds: int = 0
    idleSeconds: int = 0
    sessionCount: int = 0


# ---------------------------------------------------------------------------
# Admin / manager-facing schemas (added to support real admin & manager
# dashboards — previously these were 100% mock on the frontend).
# ---------------------------------------------------------------------------

class CreateEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: str


class CreateEmployeeResponse(BaseModel):
    id: int
    name: str
    email: str
    department: str
    role: str


class TeamMemberSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: str
    activeTime: str
    sessionCount: int
    topApp: str | None = None
    lastActive: str
    workload: int = 0
    remainingHours: float = 8.0
    capacityHours: float = 8.0
    status: str = "Active"


class TeamOverviewResponse(BaseModel):
    members: list[TeamMemberSummary]


class ManagerEmployeeDetailResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: str
    status: str
    dashboard: EmployeeDashboardResponse


# ---------------------------------------------------------------------------
# Task Management & Assignment Engine Schemas
# ---------------------------------------------------------------------------

class TaskRecommendRequest(BaseModel):
    title: str
    estimated_hours: float
    deadline: date | None = None
    required_skills: list[str] = []
    complexity: str = "MEDIUM"
    priority: str = "HIGH"


class CandidateBreakdown(BaseModel):
    skill_match: int
    availability: int
    efficiency: int
    deadline_fit: int


class CandidateWorkload(BaseModel):
    current_percentage: int
    remaining_hours: float
    capacity_hours: float
    projected_percentage: int
    projected_hours: float


class CandidateRecommendation(BaseModel):
    employee_id: int
    name: str
    email: str
    role: str
    department: Any = "General"
    skills: list[str] = []
    is_feasible: bool = True
    match_percentage: int
    final_score: float
    base_score: float
    penalty: float
    breakdown: CandidateBreakdown
    workload: CandidateWorkload
    why_reasons: list[str] = []


class TaskRecommendResponse(BaseModel):
    task: dict
    best_match: CandidateRecommendation | None = None
    candidates: list[CandidateRecommendation] = []
    alternatives: list[CandidateRecommendation] = []
    candidates_evaluated: int = 0
    eligible_candidates: int = 0


class CreateTaskRequest(BaseModel):
    title: str
    description: str | None = None
    assigned_to: int | None = None
    estimated_hours: float
    deadline: date | None = None
    required_skills: list[str] = []
    complexity: str = "MEDIUM"
    priority: str = "HIGH"


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    assigned_to: int | None = None
    assigned_name: str | None = None
    created_by: int
    estimated_hours: float
    actual_hours: float | None = None
    status: str
    priority: str | None = None
    deadline: str | None = None
    required_skills: list[str] = []
    created_at: datetime
    completed_at: datetime | None = None


class CompleteTaskResponse(BaseModel):
    id: int
    status: str
    completed_at: datetime
    actual_hours: float
    message: str
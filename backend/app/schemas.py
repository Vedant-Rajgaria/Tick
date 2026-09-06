"""
Pydantic models for auth + agent endpoints.

Deliberately NOT duplicating the activity-batch shape here — that payload's
one and only source of truth is
backend/app/schemas/activity_batch.schema.json (see
docs/CONTRACT_CHANGE_PROCESS.md). It's validated directly against that file
in app/activity_validation.py instead of being re-modeled in Pydantic, so
the two can't silently drift apart.
"""
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str


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

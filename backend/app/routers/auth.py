from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User, Organization, Department
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenError,
)
from ..schemas import (
    LoginRequest,
    LoginResponse,
    UserOut,
    UserProfileResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    if user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    return LoginResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        user=UserOut(id=user.id, name=user.name, role=user.role),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Contract note: this endpoint is an addition to openapi.yaml's original
    /auth/login-only surface, made when full JWT auth (access + refresh) was
    requested. openapi.yaml has been updated alongside this file per
    docs/CONTRACT_CHANGE_PROCESS.md — keep them in sync if this changes again.
    """
    try:
        payload = decode_token(body.refresh_token, expected_type="refresh")
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

    user = db.get(User, int(payload["sub"]))
    if user is None or user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return RefreshResponse(access_token=create_access_token(user.id, user.role))


@router.post("/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    First-admin signup only: always creates a brand-new Organization and a
    single ADMIN user inside it. There is no "join an existing org" path —
    admins add employees afterwards via POST /admin/employees.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    org = Organization(name=body.org_name, created_at=datetime.now(timezone.utc))
    db.add(org)
    db.flush()  # assigns org.id without a full commit

    user = User(
        organization_id=org.id,
        department_id=None,
        manager_id=None,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role="ADMIN",
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return RegisterResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        user=UserOut(id=user.id, name=user.name, role=user.role),
    )


@router.get("/auth/me", response_model=UserProfileResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    department = db.get(Department, current_user.department_id) if current_user.department_id else None
    organization = db.get(Organization, current_user.organization_id) if current_user.organization_id else None
    return UserProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department=department.name if department else None,
        organization=organization.name if organization else None,
    )
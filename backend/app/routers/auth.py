from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenError,
)
from app.schemas import LoginRequest, LoginResponse, UserOut, RefreshRequest, RefreshResponse

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

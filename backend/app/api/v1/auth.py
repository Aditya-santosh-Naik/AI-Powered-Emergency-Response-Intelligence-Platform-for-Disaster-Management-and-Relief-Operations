"""Authentication endpoints (register, login, me)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas import TokenOut, UserLogin, UserOut, UserRegister
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account (defaults to reporter role)."""
    norm_email = payload.email.strip().lower()

    # Check email duplicate
    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Restrict admin role assignment via public register
    role = "reporter"
    if payload.role == "admin":
        # Check if any admin exists; if not, permit initial bootstrap, otherwise force reporter
        admin_check = await db.execute(select(User).where(User.role == "admin"))
        if not admin_check.scalar_one_or_none():
            role = "admin"
        else:
            role = "reporter"

    user = User(
        email=norm_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
        organization=payload.organization,
        phone=payload.phone,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user_id=str(user.id), email=user.email, role=user.role)
    user_out = UserOut.model_validate(user)
    return TokenOut(access_token=token, token_type="bearer", user=user_out)


@router.post("/login", response_model=TokenOut)
async def login_user(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password to receive JWT bearer access token."""
    norm_email = payload.email.strip().lower()

    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    token = create_access_token(user_id=str(user.id), email=user.email, role=user.role)
    user_out = UserOut.model_validate(user)
    return TokenOut(access_token=token, token_type="bearer", user=user_out)


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieve profile and permissions for currently authenticated user."""
    return UserOut.model_validate(current_user)

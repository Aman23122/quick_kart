from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from app.database import get_db
from app.auth.dependencies import get_current_user, require_super_admin, require_admin_or_super
from app.models.user import User, UserRole, ApprovalStatus

router = APIRouter(prefix="/api/users", tags=["users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    phone: str
    password: str
    role: UserRole


class UpdateUserRequest(BaseModel):
    role: Optional[UserRole] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    phone: str
    role: str
    is_active: bool
    approval_status: str
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=UserOut)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin_or_super),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    is_super = current_user["role"] == "super_admin"
    user = User(
        username=body.username,
        email=body.email,
        phone=body.phone,
        hashed_password=pwd_context.hash(body.password),
        role=body.role,
        is_active=is_super,
        approval_status=ApprovalStatus.approved if is_super else ApprovalStatus.pending,
        created_by=current_user["username"],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/pending", response_model=List[UserOut])
def list_pending(
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    return (
        db.query(User)
        .filter(User.approval_status == ApprovalStatus.pending)
        .order_by(User.created_at.desc())
        .all()
    )


@router.patch("/{user_id}/approve", response_model=UserOut)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.approval_status = ApprovalStatus.approved
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/reject", response_model=UserOut)
def reject_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.approval_status = ApprovalStatus.rejected
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

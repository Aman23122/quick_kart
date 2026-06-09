from __future__ import annotations
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.jwt_handler import verify_token
from app.config import settings


def _get_token(request: Request) -> Optional[str]:
    return request.cookies.get("access_token")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    token = _get_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    role: str = payload.get("role", "")
    email: str = payload.get("sub", "")

    if role == "super_admin":
        return {"id": None, "username": settings.SUPER_ADMIN_USERNAME, "role": "super_admin", "email": settings.SUPER_ADMIN_EMAIL}

    from app.models.user import User, ApprovalStatus
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    if user.approval_status == ApprovalStatus.pending:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending approval")
    if user.approval_status == ApprovalStatus.rejected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account rejected")

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value,
        "email": user.email,
    }


def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


def require_admin_or_super(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
from app.database import get_db
from app.auth.jwt_handler import create_access_token
from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import User, ApprovalStatus

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_COOKIE_OPTS = dict(
    key="access_token",
    httponly=True,
    samesite="lax",
    secure=False,
    max_age=settings.JWT_EXPIRE_MINUTES * 60,
)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    if (
        body.email == settings.SUPER_ADMIN_EMAIL
        and body.password == settings.SUPER_ADMIN_PASSWORD
    ):
        token = create_access_token({"sub": body.email, "role": "super_admin"})
        response.set_cookie(value=token, **_COOKIE_OPTS)
        return {"role": "super_admin", "username": settings.SUPER_ADMIN_USERNAME}

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.approval_status == ApprovalStatus.pending:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending approval from super admin")
    if user.approval_status == ApprovalStatus.rejected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account request was rejected")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been deactivated")

    token = create_access_token({"sub": user.email, "role": user.role.value})
    response.set_cookie(value=token, **_COOKIE_OPTS)
    return {"role": user.role.value, "username": user.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user

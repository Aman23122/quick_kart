from __future__ import annotations
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    inbound_validator = "inbound_validator"
    outbound_validator = "outbound_validator"
    po_executor = "po_executor"
    inspector = "inspector"


class ApprovalStatus(str, enum.Enum):
    approved = "approved"
    pending = "pending"
    rejected = "rejected"


class User(Base):
    __tablename__ = "auth_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(SAEnum(ApprovalStatus), default=ApprovalStatus.approved, nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

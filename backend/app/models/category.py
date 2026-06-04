from sqlalchemy import Boolean, Column, SmallInteger, Integer, String, TIMESTAMP, func
from app.database import Base


class Category(Base):
    __tablename__ = "category"

    cat_id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True, unique=True)
    image = Column(String(255), nullable=False)
    level = Column(SmallInteger, nullable=False, default=1)
    sequence = Column(Integer, nullable=False)
    is_deleted = Column(Boolean, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Subcategory(Base):
    __tablename__ = "subcategory"

    subcategory_id = Column(String(36), primary_key=True)
    cat_id = Column(String(36), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

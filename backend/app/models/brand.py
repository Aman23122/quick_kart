from sqlalchemy import Boolean, Column, String, Text, TIMESTAMP, func
from app.database import Base


class Brand(Base):
    __tablename__ = "brand"

    brand_id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    country_id = Column(String(36), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

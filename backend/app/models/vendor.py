from sqlalchemy import Boolean, Column, Integer, String, Text, TIMESTAMP, func
from app.database import Base


class Vendor(Base):
    __tablename__ = "vendor"

    vendor_id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    tax_id = Column(String(100), nullable=True)
    payment_terms = Column(String(255), nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

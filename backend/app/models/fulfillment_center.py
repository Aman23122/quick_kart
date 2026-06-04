from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text, TIMESTAMP, func
from app.database import Base


class FulfillmentCenter(Base):
    __tablename__ = "fulfillment_center"

    fulfillment_center_id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    store_code = Column(String(100), nullable=True, unique=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    lat = Column(Numeric(10, 8), nullable=True)
    lng = Column(Numeric(11, 8), nullable=True)
    contact_name = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(255), nullable=True)
    capacity = Column(Integer, nullable=True)
    temperature_controlled = Column(Boolean, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

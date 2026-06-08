from sqlalchemy import Boolean, Column, Integer, String, Text, TIMESTAMP, func
from app.database import Base


class AlertThreshold(Base):
    __tablename__ = "alert_threshold"

    threshold_id = Column(String(36), primary_key=True)
    variant_id = Column(String(36), nullable=False)
    fulfillment_center_id = Column(String(36), nullable=False)
    min_stock_level = Column(Integer, nullable=False)
    max_stock_level = Column(Integer, nullable=True)
    reorder_point = Column(Integer, nullable=True)
    reorder_qty = Column(Integer, nullable=True)
    expiry_alert_days = Column(Integer, nullable=False, default=7)
    alert_email = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class AlertLog(Base):
    __tablename__ = "alert_log"

    alert_id = Column(String(36), primary_key=True)
    threshold_id = Column(String(36), nullable=True)
    variant_id = Column(String(36), nullable=False)
    fulfillment_center_id = Column(String(36), nullable=False)
    alert_type = Column(String(50), nullable=False)
    current_qty = Column(Integer, nullable=True)
    threshold_qty = Column(Integer, nullable=True)
    batch_no = Column(String(100), nullable=True)
    message = Column(Text, nullable=True)
    is_resolved = Column(Boolean, nullable=False)
    resolved_at = Column(TIMESTAMP, nullable=True)
    resolved_by = Column(String(36), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

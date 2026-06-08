from sqlalchemy import Column, String, Text, TIMESTAMP, JSON, func
from app.database import Base


class ScheduledPOTemplate(Base):
    __tablename__ = "scheduled_po_template"

    slot_id               = Column(String(50), primary_key=True)
    label                 = Column(String(100), nullable=True)
    vendor_id             = Column(String(36), nullable=True)
    notes                 = Column(Text, nullable=True)
    items                 = Column(JSON, nullable=True)   # [{variant_id, ordered_qty, unit_cost}]
    cron_time             = Column(String(5), nullable=True)   # "HH:MM" — when to fire daily
    expected_receive_time = Column(String(5), nullable=True)   # "HH:MM" — expected delivery time
    updated_at            = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

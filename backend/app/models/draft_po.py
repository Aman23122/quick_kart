from sqlalchemy import Column, String, Text, TIMESTAMP, JSON, func
from app.database import Base


class DraftPO(Base):
    __tablename__ = "draft_po"

    draft_id = Column(String(36), primary_key=True)
    po_type = Column(String(50), nullable=False)
    slot_label = Column(String(50), nullable=False)
    scheduled_fire_at = Column(TIMESTAMP, nullable=False)
    grace_starts_at = Column(TIMESTAMP, nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    line_items = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

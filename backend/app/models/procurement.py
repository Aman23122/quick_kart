from sqlalchemy import Column, Integer, Numeric, String, Text, Date, TIMESTAMP, BigInteger, func
from app.database import Base


class Procurement(Base):
    __tablename__ = "procurement"

    procurement_id = Column(String(36), primary_key=True)
    vendor_id = Column(String(36), nullable=False)
    fulfillment_center_id = Column(String(36), nullable=False)
    vendor_invoice_number = Column(BigInteger, nullable=True)
    po_number = Column(String(100), nullable=True, unique=True)
    status = Column(String(50), nullable=False, default="draft")
    total_amount = Column(Numeric(14, 2), nullable=True)
    expected_receive_date = Column(Date, nullable=True)
    expected_receive_time = Column(String(5), nullable=True)  # "HH:MM"
    actual_received_date = Column(Date, nullable=True)
    actual_received_time = Column(String(5), nullable=True)  # "HH:MM"
    notes = Column(Text, nullable=True)
    created_by = Column(String(36), nullable=True)
    approved_by = Column(String(36), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class ProcurementItem(Base):
    __tablename__ = "procurement_item"

    procurement_item_id = Column(String(36), primary_key=True)
    procurement_id = Column(String(36), nullable=False)
    variant_id = Column(String(36), nullable=False)
    ordered_qty = Column(Integer, nullable=False)
    temperature_measured = Column(Integer, nullable=False)
    received_qty = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(14, 2), nullable=True)
    batch_no = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    sell_before_date = Column(Date, nullable=False)

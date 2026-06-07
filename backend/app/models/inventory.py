from sqlalchemy import Column, Integer, Numeric, String, Text, Date, TIMESTAMP, DateTime, func
from app.database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    inventory_id = Column(String(36), primary_key=True)
    variant_id = Column(String(36), nullable=False)
    fulfillment_center_id = Column(String(36), nullable=False)
    qty = Column(Integer, nullable=False)
    expiry_date = Column(Date, nullable=True)
    cost_price = Column(Numeric(12, 2), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    sell_before_date = Column(Date, nullable=False)
    batch_no = Column(String(100), nullable=True)
    dispatch_cutoff = Column(DateTime, nullable=True)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transaction"

    transaction_id = Column(String(36), primary_key=True)
    inventory_id = Column(String(36), nullable=True)
    variant_id = Column(String(36), nullable=False)
    fulfillment_center_id = Column(String(36), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    qty_change = Column(Integer, nullable=False)
    qty_before = Column(Integer, nullable=False)
    qty_after = Column(Integer, nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(String(36), nullable=True)
    batch_no = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

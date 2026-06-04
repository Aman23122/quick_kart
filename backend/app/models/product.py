from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text, TIMESTAMP, BigInteger, func
from app.database import Base


class Product(Base):
    __tablename__ = "product"

    product_id = Column(String(36), primary_key=True)
    brand_id = Column(String(36), nullable=True)
    product_name = Column(String(255), nullable=False)
    subcategory_id = Column(String(36), nullable=True)
    cat_id = Column(String(36), nullable=True)
    description = Column(Text, nullable=True)
    product_image = Column(String(500), nullable=True)
    type = Column(String(50), nullable=True)
    shelf_life = Column(String(100), nullable=True)
    country_of_origin = Column(String(100), nullable=True)
    tax_name = Column(String(100), nullable=True)
    tax_per = Column(Numeric(5, 2), nullable=False)
    hide = Column(Boolean, nullable=False)
    availability = Column(Boolean, nullable=False, default=True)
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    partner_id = Column(String(36), nullable=True)
    added_by = Column(String(36), nullable=True)
    approved = Column(Boolean, nullable=False)
    partner_approved = Column(Boolean, nullable=False)
    is_deleted = Column(Boolean, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class ProductVariant(Base):
    __tablename__ = "product_variant"

    variant_id = Column(String(36), primary_key=True)
    product_id = Column(String(36), nullable=False)
    variant_name = Column(String(255), nullable=True)
    sell_before_days = Column(Integer, nullable=False)
    temperature_required = Column(Integer, nullable=False)
    ean = Column(BigInteger, nullable=True)
    product_code = Column(String(100), nullable=True)
    base_mrp = Column(Numeric(12, 2), nullable=True)
    base_price = Column(Numeric(12, 2), nullable=True)
    buying_price = Column(Numeric(12, 2), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(50), nullable=True)
    min_ord_qty = Column(Integer, nullable=False, default=1)
    max_ord_qty = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    is_deleted = Column(Boolean, nullable=False)
    added_by = Column(String(36), nullable=True)
    partner_id = Column(String(36), nullable=True)
    approved = Column(Boolean, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

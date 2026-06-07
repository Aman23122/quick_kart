from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from pydantic import BaseModel
from app.database import get_db
from app.models import Product, ProductVariant, Brand, AlertThreshold
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings

router = APIRouter(prefix="/api/products", tags=["Products"])

FC_ID = settings.FULFILLMENT_CENTER_ID


@router.get("/brands")
def list_brands(db: Session = Depends(get_db)):
    brands = db.query(Brand).filter(Brand.is_active == True).order_by(Brand.name).all()
    return [{"brand_id": b.brand_id, "name": b.name} for b in brands]


@router.get("")
def list_products(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
):
    query = db.query(Product).filter(Product.is_deleted == False)
    if q:
        query = query.filter(Product.product_name.ilike(f"%{q}%"))
    if brand_id:
        query = query.filter(Product.brand_id == brand_id)
    products = query.order_by(desc(Product.created_at)).all()

    result = []
    for p in products:
        brand = db.get(Brand, p.brand_id) if p.brand_id else None
        variants = db.query(ProductVariant).filter(
            ProductVariant.product_id == p.product_id,
            ProductVariant.is_deleted == False,
        ).all()
        result.append({
            "product_id": p.product_id,
            "product_name": p.product_name,
            "brand_id": p.brand_id,
            "brand_name": brand.name if brand else "—",
            "type": p.type,
            "description": p.description,
            "variant_count": len(variants),
            "variants": [
                {
                    "variant_id": v.variant_id,
                    "variant_name": v.variant_name,
                    "unit": v.unit,
                    "quantity": float(v.quantity) if v.quantity else None,
                    "base_price": float(v.base_price) if v.base_price else None,
                    "base_mrp": float(v.base_mrp) if v.base_mrp else None,
                    "buying_price": float(v.buying_price) if v.buying_price else None,
                    "sell_before_days": v.sell_before_days,
                    "temperature_required": v.temperature_required,
                }
                for v in variants
            ],
        })
    return {"total": len(result), "data": result}


class CreateProductPayload(BaseModel):
    product_name: str
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    type: str = "other"
    description: Optional[str] = None
    # Variant fields
    unit: str
    quantity: float = 1
    base_price: float
    base_mrp: Optional[float] = None
    buying_price: float
    sell_before_days: int
    temperature_required: int = 0
    # Threshold fields
    min_stock_level: int
    max_stock_level: int
    reorder_point: int
    reorder_qty: int


@router.post("")
def create_product(payload: CreateProductPayload, db: Session = Depends(get_db)):
    # Resolve or create brand
    brand_id = payload.brand_id
    if not brand_id and payload.brand_name:
        brand = db.query(Brand).filter(Brand.name.ilike(payload.brand_name.strip())).first()
        if not brand:
            brand = Brand(brand_id=new_id(), name=payload.brand_name.strip(), is_active=True)
            db.add(brand)
            db.flush()
        brand_id = brand.brand_id

    product = Product(
        product_id=new_id(),
        brand_id=brand_id,
        product_name=payload.product_name.strip(),
        type=payload.type,
        description=payload.description,
        tax_per=0,
        hide=False,
        availability=True,
        approved=True,
        partner_approved=True,
        is_deleted=False,
    )
    db.add(product)
    db.flush()

    variant = ProductVariant(
        variant_id=new_id(),
        product_id=product.product_id,
        variant_name="Standard",
        unit=payload.unit,
        quantity=payload.quantity,
        base_price=payload.base_price,
        base_mrp=payload.base_mrp or payload.base_price,
        buying_price=payload.buying_price,
        sell_before_days=payload.sell_before_days,
        temperature_required=payload.temperature_required,
        min_ord_qty=1,
        is_deleted=False,
        approved=True,
    )
    db.add(variant)
    db.flush()

    threshold = AlertThreshold(
        threshold_id=new_id(),
        variant_id=variant.variant_id,
        fulfillment_center_id=FC_ID,
        min_stock_level=payload.min_stock_level,
        max_stock_level=payload.max_stock_level,
        reorder_point=payload.reorder_point,
        reorder_qty=payload.reorder_qty,
        expiry_alert_days=3,
        is_active=True,
        created_at=now(),
        updated_at=now(),
    )
    db.add(threshold)
    db.commit()

    return {
        "product_id": product.product_id,
        "variant_id": variant.variant_id,
        "product_name": product.product_name,
    }


@router.get("/variants/search")
def search_variants(q: str = Query(""), db: Session = Depends(get_db)):
    """Search variants by product name or variant name for dropdown."""
    query = (
        db.query(ProductVariant, Product)
        .join(Product, Product.product_id == ProductVariant.product_id)
        .filter(ProductVariant.is_deleted == False)
    )
    if q.strip():
        query = query.filter(
            or_(
                ProductVariant.variant_name.ilike(f"%{q}%"),
                Product.product_name.ilike(f"%{q}%"),
                ProductVariant.product_code.ilike(f"%{q}%"),
            )
        )
    rows = (
        query.order_by(Product.product_name, ProductVariant.variant_name)
        .limit(30)
        .all()
    )
    result = []
    for variant, product in rows:
        brand = db.get(Brand, product.brand_id) if product.brand_id else None
        result.append({
            "variant_id": variant.variant_id,
            "variant_name": variant.variant_name,
            "product_name": product.product_name,
            "brand_name": brand.name if brand else "",
            "unit": variant.unit,
            "sell_before_days": variant.sell_before_days,
            "temperature_required": variant.temperature_required,
            "buying_price": float(variant.buying_price) if variant.buying_price else None,
            "base_price": float(variant.base_price) if variant.base_price else None,
        })
    return result


class QuickAddPayload(BaseModel):
    product_name: str
    brand_name: Optional[str] = None
    type: str = "other"
    variant_name: str
    unit: str = "piece"
    quantity: float = 1
    base_mrp: float = 0
    sell_before_days: int = 7
    temperature_required: int = 0


@router.post("/quick-add")
def quick_add_product(payload: QuickAddPayload, db: Session = Depends(get_db)):
    """Create a minimal product + variant for use in inbound entry."""
    brand_id = None
    if payload.brand_name and payload.brand_name.strip():
        brand = (
            db.query(Brand)
            .filter(Brand.name.ilike(payload.brand_name.strip()))
            .first()
        )
        if not brand:
            brand = Brand(brand_id=new_id(), name=payload.brand_name.strip(), is_active=True)
            db.add(brand)
            db.flush()
        brand_id = brand.brand_id

    product = Product(
        product_id=new_id(),
        brand_id=brand_id,
        product_name=payload.product_name.strip(),
        type=payload.type,
        tax_per=0,
        hide=False,
        availability=True,
        approved=False,
        partner_approved=False,
        is_deleted=False,
    )
    db.add(product)
    db.flush()

    variant = ProductVariant(
        variant_id=new_id(),
        product_id=product.product_id,
        variant_name=payload.variant_name.strip(),
        sell_before_days=payload.sell_before_days,
        temperature_required=payload.temperature_required,
        base_mrp=payload.base_mrp,
        quantity=payload.quantity,
        unit=payload.unit,
        min_ord_qty=1,
        is_deleted=False,
        approved=False,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)

    return {
        "variant_id": variant.variant_id,
        "variant_name": variant.variant_name,
        "product_name": product.product_name,
        "brand_name": payload.brand_name or "",
        "unit": variant.unit,
        "sell_before_days": variant.sell_before_days,
        "temperature_required": variant.temperature_required,
        "buying_price": None,
        "base_price": None,
    }

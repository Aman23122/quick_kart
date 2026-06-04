from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from app.database import get_db
from app.models import Product, ProductVariant, Brand
from app.utils.id_gen import new_id

router = APIRouter(prefix="/api/products", tags=["Products"])


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

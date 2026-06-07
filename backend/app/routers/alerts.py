from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import AlertLog, ProductVariant, Product, Brand
from app.utils.time_utils import format_ts, now

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("")
def list_alerts(
    db: Session = Depends(get_db),
    alert_type: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(AlertLog)
    if alert_type:
        q = q.filter(AlertLog.alert_type == alert_type)
    if is_resolved is not None:
        q = q.filter(AlertLog.is_resolved == is_resolved)

    total = q.count()
    rows = q.order_by(desc(AlertLog.created_at)).offset(skip).limit(limit).all()

    result = []
    for a in rows:
        variant = db.get(ProductVariant, a.variant_id)
        product = db.get(Product, variant.product_id) if variant else None
        brand = db.get(Brand, product.brand_id) if product and product.brand_id else None
        result.append({
            "alert_id": a.alert_id,
            "variant_id": a.variant_id,
            "variant_name": variant.variant_name if variant else a.variant_id,
            "product_name": product.product_name if product else "",
            "brand_name": brand.name if brand else "",
            "alert_type": a.alert_type,
            "current_qty": a.current_qty,
            "threshold_qty": a.threshold_qty,
            "message": a.message,
            "is_resolved": a.is_resolved,
            "resolved_at": format_ts(a.resolved_at),
            "created_at": format_ts(a.created_at),
        })

    return {"total": total, "data": result}


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(AlertLog, alert_id)
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(404, "Alert not found")
    alert.is_resolved = True
    alert.resolved_at = now()
    alert.resolved_by = "admin"
    db.commit()
    return {"status": "resolved"}

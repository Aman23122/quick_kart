from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from pydantic import BaseModel
from app.database import get_db
from sqlalchemy import asc
from app.models import Inventory, ProductVariant, Product, Brand, AlertThreshold
from app.utils.time_utils import format_ts, now
from app.config import settings

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

FC_ID = settings.FULFILLMENT_CENTER_ID


class ThresholdUpdate(BaseModel):
    min_stock_level: Optional[int] = None
    max_stock_level: Optional[int] = None
    reorder_point: Optional[int] = None
    reorder_qty: Optional[int] = None
    expiry_alert_days: Optional[int] = None


def _card_status(qty: int, min_level: int, max_level: Optional[int], sell_before: Optional[date], blocked: bool) -> str:
    if blocked or qty == 0:
        return "red"
    pct = (qty / max_level * 100) if max_level else 100
    days_left = (sell_before - date.today()).days if sell_before else 999
    if pct <= 20 or days_left <= 2:
        return "orange"
    return "green"


@router.get("/grid")
def get_inventory_grid(
    db: Session = Depends(get_db),
    brand_id: Optional[str] = Query(None),
    cat_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
):
    rows = (
        db.query(Inventory)
        .filter(Inventory.fulfillment_center_id == FC_ID)
        .order_by(asc(Inventory.sell_before_date))
        .all()
    )

    agg: dict = {}
    for r in rows:
        vid = r.variant_id
        if vid not in agg:
            agg[vid] = {
                "total_qty": 0,
                "earliest_sell_before": r.sell_before_date,
                "oldest_created_at": r.created_at,
                "batch_count": 0,
                "batches": [],
            }
        agg[vid]["total_qty"] += r.qty
        agg[vid]["batch_count"] += 1

        if r.sell_before_date and (
            agg[vid]["earliest_sell_before"] is None
            or r.sell_before_date < agg[vid]["earliest_sell_before"]
        ):
            agg[vid]["earliest_sell_before"] = r.sell_before_date

        if r.created_at and (
            agg[vid]["oldest_created_at"] is None
            or r.created_at < agg[vid]["oldest_created_at"]
        ):
            agg[vid]["oldest_created_at"] = r.created_at

        days_left = (r.sell_before_date - date.today()).days if r.sell_before_date else None

        from datetime import datetime as _dt
        cutoff = r.dispatch_cutoff
        cutoff_expired = cutoff is not None and cutoff < _dt.now()

        agg[vid]["batches"].append({
            "inventory_id": r.inventory_id,
            "batch_no": r.batch_no or None,
            "qty": r.qty,
            "sell_before_date": str(r.sell_before_date) if r.sell_before_date else None,
            "expiry_date": str(r.expiry_date) if r.expiry_date else None,
            "days_until_expiry": days_left,
            "created_at": format_ts(r.created_at),
            "dispatch_cutoff": cutoff.isoformat() if cutoff else None,
            "dispatch_cutoff_expired": cutoff_expired,
        })

    result = []
    for vid, agg_data in agg.items():
        variant = db.get(ProductVariant, vid)
        if not variant:
            continue

        product = db.get(Product, variant.product_id) if variant else None
        if product and brand_id and product.brand_id != brand_id:
            continue
        if product and cat_id and product.cat_id != cat_id:
            continue

        brand = db.get(Brand, product.brand_id) if product and product.brand_id else None
        threshold = (
            db.query(AlertThreshold)
            .filter(
                AlertThreshold.variant_id == vid,
                AlertThreshold.fulfillment_center_id == FC_ID,
            )
            .first()
        )

        qty = agg_data["total_qty"]
        min_level = threshold.min_stock_level if threshold else 0
        max_level = threshold.max_stock_level if threshold else None
        sell_before = agg_data["earliest_sell_before"]
        days_left = (sell_before - date.today()).days if sell_before else None

        from app.services.shelf_life_checker import check_dispatch_block
        shelf = check_dispatch_block(db, vid)
        blocked = shelf.blocked

        card_status = _card_status(qty, min_level, max_level, sell_before, blocked)

        if status_filter and card_status != status_filter:
            continue

        result.append({
            "variant_id": vid,
            "variant_name": variant.variant_name,
            "product_name": product.product_name if product else "",
            "brand_name": brand.name if brand else "",
            "brand_id": product.brand_id if product else None,
            "cat_id": product.cat_id if product else None,
            "total_qty": qty,
            "min_stock_level": min_level,
            "max_stock_level": max_level,
            "reorder_point": threshold.reorder_point if threshold else None,
            "reorder_qty": threshold.reorder_qty if threshold else None,
            "sell_before_date": str(sell_before) if sell_before else None,
            "days_until_expiry": days_left,
            "batch_count": agg_data["batch_count"],
            "batches": agg_data["batches"],
            "blocked": blocked,
            "block_reason": shelf.reason,
            "card_status": card_status,
            "oldest_intake": format_ts(agg_data["oldest_created_at"]),
            "threshold_id": threshold.threshold_id if threshold else None,
        })

    return {"data": result}


@router.delete("/batch/{inventory_id}")
def delete_batch(inventory_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    from app.models import InventoryTransaction

    batch = db.get(Inventory, inventory_id)
    if not batch:
        raise HTTPException(404, "Batch not found")

    today = date.today()
    is_expired = batch.sell_before_date and batch.sell_before_date < today
    is_empty = batch.qty == 0

    if not is_expired and not is_empty:
        raise HTTPException(
            400,
            "Batch can only be deleted if quantity is 0 or it is expired"
        )

    db.query(InventoryTransaction).filter(
        InventoryTransaction.inventory_id == inventory_id
    ).update({"inventory_id": None})

    db.delete(batch)
    db.commit()
    return {"status": "deleted", "inventory_id": inventory_id}


@router.patch("/threshold/{threshold_id}")
def update_threshold(
    threshold_id: str,
    payload: ThresholdUpdate,
    db: Session = Depends(get_db),
):
    threshold = db.get(AlertThreshold, threshold_id)
    if not threshold:
        from fastapi import HTTPException
        raise HTTPException(404, "Threshold not found")

    if payload.min_stock_level is not None:
        threshold.min_stock_level = payload.min_stock_level
    if payload.max_stock_level is not None:
        threshold.max_stock_level = payload.max_stock_level
    if payload.reorder_point is not None:
        threshold.reorder_point = payload.reorder_point
    if payload.reorder_qty is not None:
        threshold.reorder_qty = payload.reorder_qty
    if payload.expiry_alert_days is not None:
        threshold.expiry_alert_days = payload.expiry_alert_days

    threshold.updated_at = now()
    db.commit()
    return {"status": "updated"}

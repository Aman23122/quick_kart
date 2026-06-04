"""Shelf-life checker: dispatch blocking and wastage alert generation."""
from __future__ import annotations
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.models import SystemConfig, ProcurementItem, Inventory, AlertLog
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings


PRODUCT_RULES: dict[str, tuple[str, str]] = {
    # keyword → (config_key, unit)
    "milk": ("milk_max_hours", "hours"),
    "paneer": ("paneer_curd_bread_batter_max_days", "days"),
    "curd": ("paneer_curd_bread_batter_max_days", "days"),
    "bread": ("paneer_curd_bread_batter_max_days", "days"),
    "batter": ("paneer_curd_bread_batter_max_days", "days"),
    "butter": ("butter_max_days", "days"),
}


def _get_cfg(db: Session, key: str, default: str) -> str:
    row = db.get(SystemConfig, key)
    return row.config_value if row else default


def _get_product_name(db: Session, variant_id: str) -> str:
    from app.models import ProductVariant, Product
    v = db.get(ProductVariant, variant_id)
    if not v:
        return ""
    p = db.get(Product, v.product_id)
    return (p.product_name or "").lower() if p else ""


@dataclass
class ShelfLifeResult:
    blocked: bool
    reason: str = ""


def check_dispatch_block(
    db: Session,
    variant_id: str,
    procurement_item_id: str | None = None,
) -> ShelfLifeResult:
    """Returns blocked=True if the item is too old to dispatch."""
    product_name = _get_product_name(db, variant_id)

    for keyword, (config_key, unit) in PRODUCT_RULES.items():
        if keyword not in product_name:
            continue

        limit = int(_get_cfg(db, config_key, "999"))

        # Find oldest relevant procurement batch
        item = (
            db.query(ProcurementItem)
            .filter(ProcurementItem.variant_id == variant_id)
            .filter(ProcurementItem.procurement_item_id == procurement_item_id)
            .first()
            if procurement_item_id
            else (
                db.query(ProcurementItem)
                .filter(ProcurementItem.variant_id == variant_id)
                .order_by(ProcurementItem.created_at.asc())
                .first()
            )
        )
        if not item:
            return ShelfLifeResult(False)

        age = datetime.now() - item.created_at
        if unit == "hours":
            if age > timedelta(hours=limit):
                return ShelfLifeResult(
                    True,
                    f"{keyword.capitalize()} is {age.total_seconds()/3600:.1f}h old — limit is {limit}h"
                )
        else:
            if age > timedelta(days=limit):
                return ShelfLifeResult(
                    True,
                    f"{keyword.capitalize()} is {age.days}d old — limit is {limit} days"
                )

    return ShelfLifeResult(False)


def check_wastage_alerts(db: Session) -> int:
    """Scan inventory for fruits/veg older than configured days. Create alert_log entries."""
    days_limit = int(_get_cfg(db, "fruits_veg_wastage_alert_days", "2"))
    cutoff = datetime.now() - timedelta(days=days_limit)
    fc_id = settings.FULFILLMENT_CENTER_ID

    from app.models import ProductVariant, Product
    stale_rows = (
        db.query(Inventory)
        .filter(
            Inventory.fulfillment_center_id == fc_id,
            Inventory.qty > 0,
            Inventory.created_at <= cutoff,
        )
        .all()
    )

    created = 0
    for row in stale_rows:
        product_name = _get_product_name(db, row.variant_id)
        is_fresh = any(k in product_name for k in ("fruit", "vegetable", "veg", "fresh", "cut", "tomato", "onion", "potato"))
        if not is_fresh:
            continue

        existing = (
            db.query(AlertLog)
            .filter(
                AlertLog.variant_id == row.variant_id,
                AlertLog.alert_type == "wastage_risk",
                AlertLog.is_resolved == False,
            )
            .first()
        )
        if existing:
            continue

        db.add(AlertLog(
            alert_id=new_id(),
            threshold_id=None,
            variant_id=row.variant_id,
            fulfillment_center_id=fc_id,
            alert_type="wastage_risk",
            current_qty=row.qty,
            threshold_qty=0,
            message=f"SALE ALERT: {product_name} has been in stock for >{days_limit} days without orders.",
            is_resolved=False,
            created_at=now(),
        ))
        created += 1

    if created:
        db.commit()

    return created

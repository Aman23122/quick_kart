"""Shelf-life checker: dispatch blocking and wastage alert generation."""
from __future__ import annotations
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import Inventory, AlertLog
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings


def _get_cfg(db: Session, key: str, default: str) -> str:
    from app.models import SystemConfig
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
    """Returns blocked=True only if ALL available stock has passed its dispatch_cutoff.
    If at least one valid batch exists (no cutoff or cutoff not expired), product is dispatchable."""
    fc_id = settings.FULFILLMENT_CENTER_ID
    current = datetime.now()

    # If any batch can still be dispatched, the product is NOT blocked
    dispatchable = (
        db.query(Inventory)
        .filter(
            Inventory.variant_id == variant_id,
            Inventory.fulfillment_center_id == fc_id,
            Inventory.qty > 0,
            Inventory.sell_before_date >= current.date(),
            or_(
                Inventory.dispatch_cutoff.is_(None),
                Inventory.dispatch_cutoff >= current,
            ),
        )
        .first()
    )
    if dispatchable:
        return ShelfLifeResult(False)

    # No dispatchable batch — check if blocked stock (expired window) is the reason
    blocked_batch = (
        db.query(Inventory)
        .filter(
            Inventory.variant_id == variant_id,
            Inventory.fulfillment_center_id == fc_id,
            Inventory.qty > 0,
            Inventory.dispatch_cutoff.isnot(None),
            Inventory.dispatch_cutoff < current,
            Inventory.sell_before_date >= current.date(),
        )
        .first()
    )

    if blocked_batch:
        cutoff_str = blocked_batch.dispatch_cutoff.strftime("%d %b %H:%M")
        product_name = _get_product_name(db, variant_id)
        return ShelfLifeResult(
            True,
            f"{product_name.capitalize()} dispatch window closed (cutoff: {cutoff_str}). "
            f"All available stock is past its dispatch window."
        )

    return ShelfLifeResult(False)


def check_dispatch_cutoff_alerts(db: Session) -> int:
    """Raise dispatch_blocked alerts for dairy/fresh batches whose dispatch window has expired."""
    from app.services import notification_service
    fc_id = settings.FULFILLMENT_CENTER_ID
    current = datetime.now()

    expired_batches = (
        db.query(Inventory)
        .filter(
            Inventory.fulfillment_center_id == fc_id,
            Inventory.qty > 0,
            Inventory.dispatch_cutoff.isnot(None),
            Inventory.dispatch_cutoff < current,
            Inventory.sell_before_date >= current.date(),
        )
        .all()
    )

    created = 0
    for batch in expired_batches:
        existing = (
            db.query(AlertLog)
            .filter(
                AlertLog.variant_id == batch.variant_id,
                AlertLog.alert_type == "dispatch_blocked",
                AlertLog.is_resolved == False,
            )
            .first()
        )
        product_name = _get_product_name(db, batch.variant_id)
        cutoff_str = batch.dispatch_cutoff.strftime("%d %b %H:%M") if batch.dispatch_cutoff else ""
        msg = (
            f"Dispatch window closed for {product_name} "
            f"(batch {batch.batch_no or 'N/A'}) — cutoff was {cutoff_str}. "
            f"{batch.qty} units cannot be dispatched."
        )

        if existing:
            existing.current_qty = batch.qty
            existing.message = msg
            existing.created_at = now()
        else:
            db.add(AlertLog(
                alert_id=new_id(),
                threshold_id=None,
                variant_id=batch.variant_id,
                fulfillment_center_id=fc_id,
                alert_type="dispatch_blocked",
                current_qty=batch.qty,
                threshold_qty=0,
                message=msg,
                is_resolved=False,
                created_at=now(),
            ))
            notification_service.push(
                f"Dispatch window expired: {product_name} batch {batch.batch_no or 'N/A'} ({batch.qty} units blocked).",
                ntype="dispatch_blocked",
            )
            created += 1

    if expired_batches:
        db.commit()

    return created


def _get_pre_dispatch_alert_minutes(db: Session, product_name: str) -> int:
    name = product_name.lower()
    if "milk" in name:
        key = "pre_dispatch_alert_milk_min"
    elif any(k in name for k in ("paneer", "curd", "yoghurt", "yogurt", "dahi")):
        key = "pre_dispatch_alert_paneer_min"
    elif any(k in name for k in ("bread", "batter", "roti")):
        key = "pre_dispatch_alert_bread_min"
    elif "butter" in name:
        key = "pre_dispatch_alert_butter_min"
    elif any(k in name for k in ("meat", "chicken", "fish", "mutton", "poultry")):
        key = "pre_dispatch_alert_meat_min"
    else:
        key = "pre_dispatch_alert_default_min"
    return int(_get_cfg(db, key, "60"))


def _fire_pre_dispatch_alert_job(inventory_id: str) -> None:
    """APScheduler job — fires at exactly (dispatch_cutoff - alert_minutes). Creates the sales alert."""
    from app.database import SessionLocal
    from app.services import notification_service

    db = SessionLocal()
    try:
        batch = db.get(Inventory, inventory_id)
        if not batch or batch.qty <= 0:
            return

        current = datetime.now()
        # If dispatch window already closed by the time this fires, skip — dispatch_blocked handles it
        if batch.dispatch_cutoff and batch.dispatch_cutoff <= current:
            return

        existing = (
            db.query(AlertLog)
            .filter(
                AlertLog.variant_id == batch.variant_id,
                AlertLog.alert_type == "approaching_dispatch_cutoff",
                AlertLog.is_resolved == False,
            )
            .first()
        )

        product_name = _get_product_name(db, batch.variant_id)
        minutes_left = (
            max(0, int((batch.dispatch_cutoff - current).total_seconds() / 60))
            if batch.dispatch_cutoff else 0
        )
        cutoff_str = batch.dispatch_cutoff.strftime("%d %b %H:%M") if batch.dispatch_cutoff else "N/A"
        msg = (
            f"SALES ALERT: {product_name.capitalize()} (batch {batch.batch_no or 'N/A'}) "
            f"dispatch window closes at {cutoff_str} ({minutes_left} min left) — "
            f"run an offer now to clear {batch.qty} units!"
        )

        if existing:
            existing.current_qty = batch.qty
            existing.message = msg
        else:
            db.add(AlertLog(
                alert_id=new_id(),
                threshold_id=None,
                variant_id=batch.variant_id,
                fulfillment_center_id=batch.fulfillment_center_id,
                alert_type="approaching_dispatch_cutoff",
                current_qty=batch.qty,
                threshold_qty=0,
                message=msg,
                is_resolved=False,
                created_at=now(),
            ))
            notification_service.push(
                f"Sales alert: {product_name.capitalize()} dispatch window closing in {minutes_left} min — make an offer!",
                ntype="approaching_dispatch_cutoff",
            )

        db.commit()
    finally:
        db.close()


def schedule_pre_dispatch_alert(
    db: Session,
    inventory_id: str,
    variant_id: str,
    dispatch_cutoff: datetime,
) -> None:
    """Schedule a one-time APScheduler job to fire at exactly (dispatch_cutoff - alert_minutes)."""
    from app.services.po_scheduler import scheduler
    from apscheduler.triggers.date import DateTrigger

    product_name = _get_product_name(db, variant_id)
    alert_minutes = _get_pre_dispatch_alert_minutes(db, product_name)
    fire_at = dispatch_cutoff - timedelta(minutes=alert_minutes)

    # misfire_grace_time=86400 ensures the job fires even if the server was restarted
    # and the scheduled time was missed by up to 24h (DateTrigger default is only 1s)
    scheduler.add_job(
        _fire_pre_dispatch_alert_job,
        DateTrigger(run_date=fire_at),
        id=f"pre_dispatch_{inventory_id}",
        replace_existing=True,
        args=[inventory_id],
        misfire_grace_time=86400,
    )


def check_wastage_alerts(db: Session) -> int:
    """Scan inventory for fruits/veg older than configured days. Create alert_log entries."""
    days_limit = int(_get_cfg(db, "fruits_veg_wastage_alert_days", "2"))
    cutoff = datetime.now() - timedelta(days=days_limit)
    fc_id = settings.FULFILLMENT_CENTER_ID

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

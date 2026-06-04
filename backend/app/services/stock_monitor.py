"""Low stock monitor: checks thresholds after every inventory change."""
from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import AlertThreshold, AlertLog, Inventory, SystemConfig
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings
from app import services as svc_module


def _get_cfg(db: Session, key: str, default: str) -> str:
    row = db.get(SystemConfig, key)
    return row.config_value if row else default


def get_current_qty(db: Session, variant_id: str, fc_id: str) -> int:
    result = (
        db.query(func.sum(Inventory.qty))
        .filter(
            Inventory.variant_id == variant_id,
            Inventory.fulfillment_center_id == fc_id,
            Inventory.qty > 0,
        )
        .scalar()
    )
    return int(result or 0)


def check_and_alert(db: Session, variant_id: str) -> bool:
    """Returns True if a new alert was created."""
    fc_id = settings.FULFILLMENT_CENTER_ID
    current_qty = get_current_qty(db, variant_id, fc_id)

    threshold = (
        db.query(AlertThreshold)
        .filter(
            AlertThreshold.variant_id == variant_id,
            AlertThreshold.fulfillment_center_id == fc_id,
            AlertThreshold.is_active == True,
        )
        .first()
    )

    if not threshold:
        # Fallback: use percentage-based rule if no threshold row exists
        pct = int(_get_cfg(db, "low_stock_pct_threshold", "20"))
        # Without max_stock_level we cannot compute %; skip
        return False

    min_level = threshold.min_stock_level
    max_level = threshold.max_stock_level or 0
    pct_threshold = int(_get_cfg(db, "low_stock_pct_threshold", "20"))

    pct_min = int(max_level * pct_threshold / 100) if max_level else min_level
    effective_min = max(min_level, pct_min)

    if current_qty > effective_min:
        return False

    # Avoid duplicate unresolved alerts
    existing = (
        db.query(AlertLog)
        .filter(
            AlertLog.variant_id == variant_id,
            AlertLog.alert_type == "low_stock",
            AlertLog.is_resolved == False,
        )
        .first()
    )
    if existing:
        return False

    db.add(AlertLog(
        alert_id=new_id(),
        threshold_id=threshold.threshold_id,
        variant_id=variant_id,
        fulfillment_center_id=fc_id,
        alert_type="low_stock",
        current_qty=current_qty,
        threshold_qty=effective_min,
        message=(
            f"Low stock: current qty {current_qty} has breached minimum level {effective_min}. "
            f"Reorder qty suggested: {threshold.reorder_qty or 'N/A'}. "
            f"[Simulated email dispatched to procurement team]"
        ),
        is_resolved=False,
        created_at=now(),
    ))
    db.commit()

    # Push UI notification
    from app.services import notification_service
    notification_service.push(
        message=f"Low stock alert triggered for variant {variant_id}. Email simulated to procurement.",
        ntype="low_stock",
        variant_id=variant_id,
    )

    return True

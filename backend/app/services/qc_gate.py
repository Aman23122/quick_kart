"""QC Gate: validates time windows and temperature for inbound items."""
from __future__ import annotations
from datetime import datetime, time
from sqlalchemy.orm import Session
from app.models import SystemConfig, ProductVariant


def _get_cfg(db: Session, key: str) -> str:
    row = db.get(SystemConfig, key)
    return row.config_value if row else ""


def _parse_time(t: str) -> time:
    h, m = t.split(":")
    return time(int(h), int(m))


def _get_category_type(db: Session, variant_id: str) -> str:
    """Return a simplified category type string for the variant."""
    from app.models import Product
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        return "unknown"
    product = db.get(Product, variant.product_id)
    if not product:
        return "unknown"
    # Normalise product type to lowercase for rule matching
    ptype = (product.type or "").lower()
    return ptype


class QCResult:
    def __init__(self, passed: bool, reason: str = ""):
        self.passed = passed
        self.reason = reason


def validate_inbound(
    db: Session,
    variant_id: str,
    temperature_measured: int,
    received_at: datetime | None = None,
) -> QCResult:
    now = received_at or datetime.now()
    current_time = now.time()

    temp_threshold = int(_get_cfg(db, "temp_rejection_threshold") or "8")
    dairy_start = _parse_time(_get_cfg(db, "dairy_inbound_window_start") or "04:00")
    dairy_end = _parse_time(_get_cfg(db, "dairy_inbound_window_end") or "10:00")
    fresh_cutoff = _parse_time(_get_cfg(db, "fresh_inbound_cutoff") or "12:30")

    variant = db.get(ProductVariant, variant_id)
    if not variant:
        return QCResult(False, f"Variant {variant_id} not found")

    category_type = _get_category_type(db, variant_id)

    # Temperature gate for chilled/dairy items
    if variant.temperature_required > 0 and temperature_measured > temp_threshold:
        return QCResult(
            False,
            f"Temperature {temperature_measured}°C exceeds threshold {temp_threshold}°C"
        )

    # Time window: dairy
    is_dairy = any(k in category_type for k in ("dairy", "milk", "paneer", "curd", "butter", "cheese"))
    if is_dairy:
        if not (dairy_start <= current_time <= dairy_end):
            return QCResult(
                False,
                f"Dairy inbound outside allowed window ({dairy_start}–{dairy_end}). "
                f"Current time: {current_time.strftime('%H:%M')}"
            )

    # Time window: fresh produce
    is_fresh = any(k in category_type for k in ("fruit", "vegetable", "veg", "fresh", "cut"))
    if is_fresh:
        if current_time > fresh_cutoff:
            return QCResult(
                False,
                f"Fresh produce inbound past cutoff ({fresh_cutoff}). "
                f"Current time: {current_time.strftime('%H:%M')}"
            )

    return QCResult(True, "Passed QC")

from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, datetime, time as dt_time
from pydantic import BaseModel
from app.database import get_db
from app.services.csv_processor import process_inbound_csv
from app.services.qc_gate import validate_inbound
from datetime import timedelta
from app.models import Procurement, ProcurementItem, ProductVariant, Vendor, Inventory, Product, Brand, SystemConfig
from app.services import notification_service
from app.services.stock_monitor import check_and_alert, auto_resolve_if_restocked
from app.utils.time_utils import format_ts, now
from app.utils.id_gen import new_id
from app.config import settings

# (keywords, config_key) — first match wins; most specific rules listed first
_DISPATCH_RULES: list[tuple[tuple[str, ...], str]] = [
    (("milk",),                                              "dispatch_window_milk_min"),
    (("paneer", "curd", "yoghurt", "yogurt", "dahi"),        "dispatch_window_paneer_curd_min"),
    (("bread",),                                             "dispatch_window_bread_batter_min"),
    (("batter",),                                            "dispatch_window_bread_batter_min"),
    (("butter",),                                            "dispatch_window_butter_min"),
    (("meat", "chicken", "mutton", "beef", "lamb", "fish"),  "dispatch_window_meat_min"),
]
# Fallback config key for anything that is generically dairy/fresh/frozen but didn't match above
_DAIRY_FALLBACK_KEYWORDS = ("dairy", "cheese", "fresh", "fruit", "vegetable", "veg", "cut", "frozen")
_DAIRY_FALLBACK_KEY = "dairy_dispatch_window_minutes"


def _get_dispatch_minutes(db: Session, variant_id: str) -> int | None:
    """Return dispatch window in minutes for this variant, or None if no window applies."""
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        return None
    product = db.get(Product, variant.product_id)
    if not product:
        return None
    # search both product name and product type so "Amul Fresh Milk" matches "milk" in name
    haystack = f"{(product.product_name or '')} {(product.type or '')}".lower()

    for keywords, config_key in _DISPATCH_RULES:
        if any(kw in haystack for kw in keywords):
            row = db.get(SystemConfig, config_key)
            if row and row.config_value:
                return int(row.config_value)

    # generic dairy/fresh fallback
    if any(k in haystack for k in _DAIRY_FALLBACK_KEYWORDS):
        row = db.get(SystemConfig, _DAIRY_FALLBACK_KEY)
        if row and row.config_value:
            return int(row.config_value)

    return None


def _build_dispatch_cutoff(db: Session, variant_id: str) -> datetime | None:
    minutes = _get_dispatch_minutes(db, variant_id)
    if minutes is None:
        return None
    return now() + timedelta(minutes=minutes)


class ReceiveItemDetail(BaseModel):
    procurement_item_id: str
    received_qty: int
    temperature_measured: int
    expiry_date: Optional[str] = None
    sell_before_date: str
    batch_no: Optional[str] = None


class ReceivePOPayload(BaseModel):
    vendor_invoice_number: int
    actual_receive_date: Optional[str] = None   # "YYYY-MM-DD"
    actual_receive_time: Optional[str] = None   # "HH:MM"
    items: List[ReceiveItemDetail]


class ManualInboundItem(BaseModel):
    variant_id: str
    ordered_qty: int
    received_qty: int
    temperature_measured: int
    unit_cost: float
    expiry_date: Optional[str] = None
    sell_before_date: str
    batch_no: Optional[str] = None


class ManualInboundPayload(BaseModel):
    vendor_id: str
    vendor_invoice_number: int
    expected_receive_date: Optional[str] = None
    expected_receive_time: Optional[str] = None  # "HH:MM"
    notes: Optional[str] = None
    items: List[ManualInboundItem]

router = APIRouter(prefix="/api/inbound", tags=["Inbound"])

FC_ID = settings.FULFILLMENT_CENTER_ID


@router.post("/upload-csv")
async def upload_inbound_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = process_inbound_csv(db, content)
    return result


@router.get("/pending")
def get_pending_approvals(db: Session = Depends(get_db)):
    """All inbound shipments awaiting admin approval."""
    rows = (
        db.query(Procurement, ProcurementItem)
        .join(ProcurementItem, ProcurementItem.procurement_id == Procurement.procurement_id)
        .filter(Procurement.status == "pending_approval")
        .order_by(desc(Procurement.created_at))
        .all()
    )

    result = []
    for proc, item in rows:
        variant = db.get(ProductVariant, item.variant_id)
        vendor = db.get(Vendor, proc.vendor_id)
        product = db.get(Product, variant.product_id) if variant else None
        brand = db.get(Brand, product.brand_id) if product and product.brand_id else None

        temp_threshold = 8
        from app.models import SystemConfig
        cfg = db.get(SystemConfig, "temp_rejection_threshold")
        if cfg:
            temp_threshold = int(cfg.config_value)

        on_time = None
        on_time_diff_minutes = None
        if proc.expected_receive_date:
            actual_date = proc.actual_received_date or (proc.created_at.date() if proc.created_at else None)
            if actual_date:
                if proc.expected_receive_time:
                    exp_time = dt_time(23, 59)
                    try:
                        h, m = proc.expected_receive_time.split(":")
                        exp_time = dt_time(int(h), int(m))
                    except ValueError:
                        pass
                    expected_dt = datetime.combine(proc.expected_receive_date, exp_time)
                    actual_time = dt_time(23, 59)
                    if proc.actual_received_time:
                        try:
                            h, m = proc.actual_received_time.split(":")
                            actual_time = dt_time(int(h), int(m))
                        except ValueError:
                            pass
                    actual_dt = datetime.combine(actual_date, actual_time)
                    on_time = actual_dt <= expected_dt
                    on_time_diff_minutes = int((expected_dt - actual_dt).total_seconds() / 60)
                else:
                    # No expected time — date-only comparison, no time diff shown
                    on_time = actual_date <= proc.expected_receive_date
                    on_time_diff_minutes = None

        result.append({
            "procurement_id": proc.procurement_id,
            "procurement_item_id": item.procurement_item_id,
            "po_number": proc.po_number,
            "vendor_name": vendor.name if vendor else proc.vendor_id,
            "vendor_id": proc.vendor_id,
            "variant_id": item.variant_id,
            "variant_name": variant.variant_name if variant else item.variant_id,
            "product_name": product.product_name if product else "",
            "brand_name": brand.name if brand else "",
            "ordered_qty": item.ordered_qty,
            "received_qty": item.received_qty,
            "temperature_measured": item.temperature_measured,
            "temp_threshold": temp_threshold,
            "temp_ok": item.temperature_measured <= temp_threshold,
            "unit_cost": float(item.unit_cost),
            "total_cost": float(item.total_cost or 0),
            "batch_no": item.batch_no,
            "expiry_date": str(item.expiry_date) if item.expiry_date else None,
            "sell_before_date": str(item.sell_before_date),
            "created_at": format_ts(proc.created_at),
            "on_time": on_time,
            "on_time_diff_minutes": on_time_diff_minutes,
        })

    return {"total": len(result), "data": result}


@router.post("/{procurement_id}/approve")
def approve_inbound(procurement_id: str, db: Session = Depends(get_db)):
    """Approve a pending inbound shipment — writes to inventory."""
    proc = db.get(Procurement, procurement_id)
    if not proc:
        raise HTTPException(404, "Procurement not found")
    if proc.status not in ("pending_approval", "rejected"):
        raise HTTPException(400, f"Cannot approve — current status is '{proc.status}'")

    items = (
        db.query(ProcurementItem)
        .filter(ProcurementItem.procurement_id == procurement_id)
        .all()
    )

    to_schedule = []
    for item in items:
        inv_id = new_id()
        cutoff = _build_dispatch_cutoff(db, item.variant_id)
        db.add(Inventory(
            inventory_id=inv_id,
            variant_id=item.variant_id,
            fulfillment_center_id=FC_ID,
            qty=item.received_qty,
            expiry_date=item.expiry_date,
            cost_price=item.unit_cost,
            sell_before_date=item.sell_before_date,
            batch_no=item.batch_no,
            dispatch_cutoff=cutoff,
            created_at=now(),
            updated_at=now(),
        ))
        if cutoff:
            to_schedule.append((inv_id, item.variant_id, cutoff))

    proc.status = "approved"
    proc.actual_received_date = now().date()
    proc.updated_at = now()
    db.commit()

    from app.services.shelf_life_checker import schedule_pre_dispatch_alert
    for inv_id, variant_id, cutoff in to_schedule:
        schedule_pre_dispatch_alert(db, inv_id, variant_id, cutoff)

    # Run stock monitor for all approved variants
    for item in items:
        auto_resolve_if_restocked(db, item.variant_id)
        check_and_alert(db, item.variant_id)

    notification_service.push(
        f"Inbound PO {proc.po_number} approved — {len(items)} item(s) added to inventory.",
        ntype="info",
    )

    return {"status": "approved", "procurement_id": procurement_id, "items_added": len(items)}


@router.post("/{procurement_id}/reject")
def reject_inbound(procurement_id: str, db: Session = Depends(get_db)):
    """Reject a pending inbound shipment."""
    proc = db.get(Procurement, procurement_id)
    if not proc:
        raise HTTPException(404, "Procurement not found")
    if proc.status != "pending_approval":
        raise HTTPException(400, f"Cannot reject — current status is '{proc.status}'")

    proc.status = "rejected"
    proc.updated_at = now()
    db.commit()

    notification_service.push(
        f"Inbound PO {proc.po_number} rejected by admin.",
        ntype="inbound_rejected",
    )

    return {"status": "rejected", "procurement_id": procurement_id}


@router.get("/ledger")
def get_inbound_ledger(
    db: Session = Depends(get_db),
    search: str = Query("", alias="search"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    q = (
        db.query(Procurement, ProcurementItem)
        .join(ProcurementItem, ProcurementItem.procurement_id == Procurement.procurement_id)
    )

    if date_from:
        q = q.filter(Procurement.created_at >= date_from)
    if date_to:
        q = q.filter(Procurement.created_at < date_to + timedelta(days=1))
    if status:
        q = q.filter(Procurement.status == status)

    total = q.count()
    rows = q.order_by(desc(Procurement.created_at)).offset(skip).limit(limit).all()

    result = []
    for proc, item in rows:
        variant = db.get(ProductVariant, item.variant_id)
        vendor = db.get(Vendor, proc.vendor_id)
        product = db.get(Product, variant.product_id) if variant else None

        on_time = None
        on_time_diff_minutes = None
        if proc.expected_receive_date:
            actual_date = proc.actual_received_date or (proc.created_at.date() if proc.created_at else None)
            if actual_date:
                if proc.expected_receive_time:
                    # Expected time was specified — full datetime comparison
                    exp_time = dt_time(23, 59)
                    try:
                        h, m = proc.expected_receive_time.split(":")
                        exp_time = dt_time(int(h), int(m))
                    except ValueError:
                        pass
                    expected_dt = datetime.combine(proc.expected_receive_date, exp_time)
                    actual_time = dt_time(23, 59)
                    if proc.actual_received_time:
                        try:
                            h, m = proc.actual_received_time.split(":")
                            actual_time = dt_time(int(h), int(m))
                        except ValueError:
                            pass
                    actual_dt = datetime.combine(actual_date, actual_time)
                    on_time = actual_dt <= expected_dt
                    on_time_diff_minutes = int((expected_dt - actual_dt).total_seconds() / 60)
                else:
                    # No expected time — date-only comparison, no time diff shown
                    on_time = actual_date <= proc.expected_receive_date
                    on_time_diff_minutes = None

        result.append({
            "procurement_id": proc.procurement_id,
            "po_number": proc.po_number,
            "vendor_name": vendor.name if vendor else proc.vendor_id,
            "vendor_id": proc.vendor_id,
            "variant_id": item.variant_id,
            "variant_name": variant.variant_name if variant else item.variant_id,
            "product_name": product.product_name if product else "",
            "ordered_qty": item.ordered_qty,
            "received_qty": item.received_qty,
            "temperature_measured": item.temperature_measured,
            "unit_cost": float(item.unit_cost),
            "total_cost": float(item.total_cost or 0),
            "batch_no": item.batch_no,
            "expiry_date": str(item.expiry_date) if item.expiry_date else None,
            "sell_before_date": str(item.sell_before_date),
            "expected_receive_date": str(proc.expected_receive_date) if proc.expected_receive_date else None,
            "expected_receive_time": proc.expected_receive_time,
            "on_time": on_time,
            "on_time_diff_minutes": on_time_diff_minutes,
            "status": proc.status,
            "created_at": format_ts(proc.created_at),
        })

    return {"total": total, "data": result}


@router.post("/receive/{procurement_id}")
def receive_against_po(procurement_id: str, payload: ReceivePOPayload, db: Session = Depends(get_db)):
    """Receive stock against an existing draft/sent PO — runs QC, sets pending_approval."""
    proc = db.get(Procurement, procurement_id)
    if not proc:
        raise HTTPException(404, "PO not found")
    if proc.status not in ("draft", "sent"):
        raise HTTPException(400, f"Cannot receive — PO status is '{proc.status}'")

    proc.vendor_invoice_number = payload.vendor_invoice_number
    if payload.actual_receive_date:
        try:
            proc.actual_received_date = datetime.strptime(payload.actual_receive_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    proc.actual_received_time = payload.actual_receive_time or None
    passed = 0
    failed = 0
    rows = []

    for receive in payload.items:
        item = db.get(ProcurementItem, receive.procurement_item_id)
        if not item or item.procurement_id != procurement_id:
            rows.append({"procurement_item_id": receive.procurement_item_id, "status": "error", "reason": "Item not found"})
            continue

        qc = validate_inbound(db, item.variant_id, receive.temperature_measured)

        expiry = None
        if receive.expiry_date:
            try:
                expiry = datetime.strptime(receive.expiry_date, "%Y-%m-%d").date()
            except ValueError:
                pass

        try:
            sell_before = datetime.strptime(receive.sell_before_date, "%Y-%m-%d").date()
        except ValueError:
            rows.append({"procurement_item_id": receive.procurement_item_id, "status": "error", "reason": "Invalid sell_before_date"})
            continue

        item.received_qty = receive.received_qty
        item.temperature_measured = receive.temperature_measured
        item.expiry_date = expiry
        item.sell_before_date = sell_before
        item.batch_no = receive.batch_no
        item.total_cost = item.received_qty * float(item.unit_cost)

        if qc.passed:
            passed += 1
        else:
            failed += 1

        rows.append({
            "procurement_item_id": receive.procurement_item_id,
            "variant_id": item.variant_id,
            "status": "passed" if qc.passed else "failed",
            "reason": qc.reason,
        })

    proc.status = "pending_approval" if passed > 0 else "rejected"
    proc.updated_at = now()
    db.commit()

    if passed > 0:
        notification_service.push(
            f"PO {proc.po_number} received — {passed} item(s) pending approval.",
            ntype="pending_approval",
        )
    if failed > 0:
        notification_service.push(
            f"{failed} item(s) from PO {proc.po_number} failed QC.",
            ntype="inbound_rejected",
        )

    return {
        "procurement_id": procurement_id,
        "po_number": proc.po_number,
        "status": proc.status,
        "passed": passed,
        "failed": failed,
        "rows": rows,
    }


@router.post("/manual")
def submit_manual_inbound(payload: ManualInboundPayload, db: Session = Depends(get_db)):
    """Submit inbound via form (JSON) — same QC + approval flow as CSV."""
    pending = 0
    rejected = 0
    rows = []

    for item in payload.items:
        qc = validate_inbound(db, item.variant_id, item.temperature_measured)
        status = "pending_approval" if qc.passed else "rejected"

        proc_id = new_id()
        po_number = f"PO-{proc_id[:8].upper()}"
        total_cost = item.received_qty * item.unit_cost

        expiry = None
        if item.expiry_date:
            try:
                expiry = datetime.strptime(item.expiry_date, "%Y-%m-%d").date()
            except ValueError:
                pass

        try:
            sell_before = datetime.strptime(item.sell_before_date, "%Y-%m-%d").date()
        except ValueError:
            rows.append({"variant_id": item.variant_id, "status": "error", "reason": "Invalid sell_before_date"})
            continue

        exp_date = None
        if payload.expected_receive_date:
            try:
                exp_date = datetime.strptime(payload.expected_receive_date, "%Y-%m-%d").date()
            except ValueError:
                pass

        proc = Procurement(
            procurement_id=proc_id,
            vendor_id=payload.vendor_id,
            fulfillment_center_id=FC_ID,
            vendor_invoice_number=payload.vendor_invoice_number,
            po_number=po_number,
            status=status,
            total_amount=total_cost,
            notes=payload.notes,
            expected_receive_date=exp_date,
            expected_receive_time=payload.expected_receive_time or None,
            created_at=now(),
            updated_at=now(),
        )
        db.add(proc)

        proc_item = ProcurementItem(
            procurement_item_id=new_id(),
            procurement_id=proc_id,
            variant_id=item.variant_id,
            ordered_qty=item.ordered_qty,
            received_qty=item.received_qty,
            temperature_measured=item.temperature_measured,
            unit_cost=item.unit_cost,
            total_cost=total_cost,
            batch_no=item.batch_no,
            expiry_date=expiry,
            sell_before_date=sell_before,
        )
        db.add(proc_item)

        if status == "pending_approval":
            pending += 1
        else:
            rejected += 1

        rows.append({"variant_id": item.variant_id, "status": status, "reason": qc.reason})

    db.commit()

    if pending > 0:
        notification_service.push(
            f"{pending} manual inbound item(s) submitted for approval.",
            ntype="pending_approval",
        )
    if rejected > 0:
        notification_service.push(
            f"{rejected} manual inbound item(s) rejected by QC.",
            ntype="inbound_rejected",
        )

    return {
        "processed": len(payload.items),
        "pending_approval": pending,
        "rejected": rejected,
        "rows": rows,
    }

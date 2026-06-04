from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.services.csv_processor import process_inbound_csv
from app.services.qc_gate import validate_inbound
from app.models import Procurement, ProcurementItem, ProductVariant, Vendor, Inventory, Product, Brand
from app.services import notification_service
from app.services.stock_monitor import check_and_alert
from app.utils.time_utils import format_ts, now
from app.utils.id_gen import new_id
from app.config import settings


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
        })

    return {"total": len(result), "data": result}


@router.post("/{procurement_id}/approve")
def approve_inbound(procurement_id: str, db: Session = Depends(get_db)):
    """Approve a pending inbound shipment — writes to inventory."""
    proc = db.get(Procurement, procurement_id)
    if not proc:
        raise HTTPException(404, "Procurement not found")
    if proc.status != "pending_approval":
        raise HTTPException(400, f"Cannot approve — current status is '{proc.status}'")

    items = (
        db.query(ProcurementItem)
        .filter(ProcurementItem.procurement_id == procurement_id)
        .all()
    )

    for item in items:
        db.add(Inventory(
            inventory_id=new_id(),
            variant_id=item.variant_id,
            fulfillment_center_id=FC_ID,
            qty=item.received_qty,
            expiry_date=item.expiry_date,
            cost_price=item.unit_cost,
            sell_before_date=item.sell_before_date,
            created_at=now(),
            updated_at=now(),
        ))

    proc.status = "approved"
    proc.updated_at = now()
    db.commit()

    # Run stock monitor for all approved variants
    for item in items:
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
        q = q.filter(Procurement.created_at <= date_to)
    if status:
        q = q.filter(Procurement.status == status)

    total = q.count()
    rows = q.order_by(desc(Procurement.created_at)).offset(skip).limit(limit).all()

    result = []
    for proc, item in rows:
        variant = db.get(ProductVariant, item.variant_id)
        vendor = db.get(Vendor, proc.vendor_id)
        result.append({
            "procurement_id": proc.procurement_id,
            "po_number": proc.po_number,
            "vendor_name": vendor.name if vendor else proc.vendor_id,
            "vendor_id": proc.vendor_id,
            "variant_id": item.variant_id,
            "variant_name": variant.variant_name if variant else item.variant_id,
            "ordered_qty": item.ordered_qty,
            "received_qty": item.received_qty,
            "temperature_measured": item.temperature_measured,
            "unit_cost": float(item.unit_cost),
            "total_cost": float(item.total_cost or 0),
            "batch_no": item.batch_no,
            "expiry_date": str(item.expiry_date) if item.expiry_date else None,
            "sell_before_date": str(item.sell_before_date),
            "status": proc.status,
            "created_at": format_ts(proc.created_at),
        })

    return {"total": total, "data": result}


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

        proc = Procurement(
            procurement_id=proc_id,
            vendor_id=payload.vendor_id,
            fulfillment_center_id=FC_ID,
            vendor_invoice_number=payload.vendor_invoice_number,
            po_number=po_number,
            status=status,
            total_amount=total_cost,
            notes=payload.notes,
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

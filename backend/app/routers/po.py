from __future__ import annotations
from typing import Optional, Any, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.database import get_db
from app.models import DraftPO, Procurement, ProcurementItem, Vendor, ProductVariant, Product, Brand
from app.services.po_scheduler import get_next_run_times, _create_draft
from app.utils.time_utils import format_ts, now
from app.utils.id_gen import new_id
from app.config import settings

router = APIRouter(prefix="/api/po", tags=["PO Scheduler"])

FC_ID = settings.FULFILLMENT_CENTER_ID


class ManualPOItem(BaseModel):
    variant_id: str
    ordered_qty: int
    unit_cost: float


class ManualPOPayload(BaseModel):
    vendor_id: str
    expected_receive_date: Optional[str] = None
    expected_receive_time: Optional[str] = None
    notes: Optional[str] = None
    items: List[ManualPOItem]


class DraftPOUpdate(BaseModel):
    line_items: Optional[list] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@router.get("/drafts")
def list_drafts(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 20,
):
    q = db.query(DraftPO)
    if status:
        q = q.filter(DraftPO.status == status)
    total = q.count()
    rows = q.order_by(desc(DraftPO.created_at)).offset(skip).limit(limit).all()

    return {
        "total": total,
        "data": [
            {
                "draft_id": d.draft_id,
                "po_type": d.po_type,
                "slot_label": d.slot_label,
                "status": d.status,
                "grace_starts_at": format_ts(d.grace_starts_at),
                "scheduled_fire_at": format_ts(d.scheduled_fire_at),
                "line_items": d.line_items or [],
                "notes": d.notes,
                "created_at": format_ts(d.created_at),
            }
            for d in rows
        ],
    }


@router.patch("/draft/{draft_id}")
def update_draft(draft_id: str, payload: DraftPOUpdate, db: Session = Depends(get_db)):
    draft = db.get(DraftPO, draft_id)
    if not draft:
        raise HTTPException(404, "Draft PO not found")
    if draft.status not in ("draft",):
        raise HTTPException(400, f"Cannot edit draft with status '{draft.status}'")

    if payload.line_items is not None:
        draft.line_items = payload.line_items
    if payload.notes is not None:
        draft.notes = payload.notes
    if payload.status is not None:
        if payload.status not in ("draft", "overridden"):
            raise HTTPException(400, "Status must be 'draft' or 'overridden'")
        draft.status = payload.status

    db.commit()
    return {"status": "updated", "draft_id": draft_id}


@router.post("/trigger")
def manual_trigger(
    po_type: str = Query(...),
    slot_label: str = Query(...),
):
    _create_draft(po_type=po_type, slot_label=slot_label, fire_in_minutes=10)
    return {"status": "draft_created", "po_type": po_type, "slot_label": slot_label}


@router.get("/schedule")
def get_schedule():
    return {"jobs": get_next_run_times()}


# ─── Manual PO endpoints ──────────────────────────────────────────────────────

@router.post("/manual")
def create_manual_po(payload: ManualPOPayload, db: Session = Depends(get_db)):
    """Create a manual draft Procurement PO with line items."""
    vendor = db.get(Vendor, payload.vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")

    proc_id = new_id()
    po_number = f"MPO-{proc_id[:8].upper()}"

    exp_date = None
    if payload.expected_receive_date:
        try:
            exp_date = datetime.strptime(payload.expected_receive_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    total_amount = sum(i.ordered_qty * i.unit_cost for i in payload.items)
    default_sbd = date.today() + timedelta(days=7)

    proc = Procurement(
        procurement_id=proc_id,
        vendor_id=payload.vendor_id,
        fulfillment_center_id=FC_ID,
        vendor_invoice_number=None,
        po_number=po_number,
        status="draft",
        total_amount=total_amount,
        expected_receive_date=exp_date,
        expected_receive_time=payload.expected_receive_time or None,
        notes=payload.notes,
        created_at=now(),
        updated_at=now(),
    )
    db.add(proc)
    db.flush()

    for item in payload.items:
        db.add(ProcurementItem(
            procurement_item_id=new_id(),
            procurement_id=proc_id,
            variant_id=item.variant_id,
            ordered_qty=item.ordered_qty,
            received_qty=0,
            temperature_measured=0,
            unit_cost=item.unit_cost,
            total_cost=item.ordered_qty * item.unit_cost,
            sell_before_date=default_sbd,
        ))

    db.commit()
    return {"procurement_id": proc_id, "po_number": po_number, "status": "draft"}


@router.get("/open")
def get_open_pos(db: Session = Depends(get_db)):
    """List open Procurements (draft/sent) for Stock Entry dropdown."""
    rows = (
        db.query(Procurement)
        .filter(Procurement.status.in_(["draft", "sent"]))
        .order_by(desc(Procurement.created_at))
        .all()
    )

    result = []
    for proc in rows:
        vendor = db.get(Vendor, proc.vendor_id)
        items = (
            db.query(ProcurementItem)
            .filter(ProcurementItem.procurement_id == proc.procurement_id)
            .all()
        )
        item_list = []
        for item in items:
            variant = db.get(ProductVariant, item.variant_id)
            product = db.get(Product, variant.product_id) if variant else None
            brand = db.get(Brand, product.brand_id) if product and product.brand_id else None
            item_list.append({
                "procurement_item_id": item.procurement_item_id,
                "variant_id": item.variant_id,
                "variant_name": variant.variant_name if variant else item.variant_id,
                "product_name": product.product_name if product else "",
                "brand_name": brand.name if brand else "",
                "ordered_qty": item.ordered_qty,
                "unit_cost": float(item.unit_cost),
                "sell_before_days": variant.sell_before_days if variant else 7,
                "temperature_required": variant.temperature_required if variant else 0,
            })
        result.append({
            "procurement_id": proc.procurement_id,
            "po_number": proc.po_number,
            "vendor_id": proc.vendor_id,
            "vendor_name": vendor.name if vendor else proc.vendor_id,
            "status": proc.status,
            "expected_receive_date": str(proc.expected_receive_date) if proc.expected_receive_date else None,
            "expected_receive_time": proc.expected_receive_time,
            "notes": proc.notes,
            "total_amount": float(proc.total_amount or 0),
            "items": item_list,
            "created_at": format_ts(proc.created_at),
        })

    return {"total": len(result), "data": result}


@router.patch("/{procurement_id}/send")
def mark_po_sent(procurement_id: str, db: Session = Depends(get_db)):
    """Mark a draft PO as sent to vendor."""
    proc = db.get(Procurement, procurement_id)
    if not proc:
        raise HTTPException(404, "PO not found")
    if proc.status != "draft":
        raise HTTPException(400, f"Cannot send — current status is '{proc.status}'")
    proc.status = "sent"
    proc.updated_at = now()
    db.commit()
    return {"status": "sent", "procurement_id": procurement_id, "po_number": proc.po_number}

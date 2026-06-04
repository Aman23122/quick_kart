from __future__ import annotations
from typing import Optional, Any, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.database import get_db
from app.models import Procurement, ProcurementItem, Vendor, ProductVariant, Product, Brand, ScheduledPOTemplate
from app.services.po_scheduler import get_next_run_times
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


# ─── Scheduled PO Templates ──────────────────────────────────────────────────

class TemplateItem(BaseModel):
    variant_id: str
    ordered_qty: int
    unit_cost: float

class TemplateUpdate(BaseModel):
    vendor_id: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[TemplateItem]] = None


@router.get("/template/{slot_id}")
def get_template(slot_id: str, db: Session = Depends(get_db)):
    tmpl = db.get(ScheduledPOTemplate, slot_id)
    if not tmpl:
        raise HTTPException(404, f"Template '{slot_id}' not found")

    vendor = db.get(Vendor, tmpl.vendor_id) if tmpl.vendor_id else None

    enriched_items = []
    for it in (tmpl.items or []):
        variant = db.get(ProductVariant, it["variant_id"])
        product = db.get(Product, variant.product_id) if variant else None
        enriched_items.append({
            "variant_id": it["variant_id"],
            "product_name": product.product_name if product else "",
            "variant_name": variant.variant_name if variant else "",
            "ordered_qty": it["ordered_qty"],
            "unit_cost": it["unit_cost"],
        })

    return {
        "slot_id": tmpl.slot_id,
        "vendor_id": tmpl.vendor_id,
        "vendor_name": vendor.name if vendor else "",
        "notes": tmpl.notes or "",
        "items": enriched_items,
    }


@router.put("/template/{slot_id}")
def update_template(slot_id: str, payload: TemplateUpdate, db: Session = Depends(get_db)):
    tmpl = db.get(ScheduledPOTemplate, slot_id)
    if not tmpl:
        raise HTTPException(404, f"Template '{slot_id}' not found")
    if payload.vendor_id is not None:
        tmpl.vendor_id = payload.vendor_id
    if payload.notes is not None:
        tmpl.notes = payload.notes
    if payload.items is not None:
        tmpl.items = [{"variant_id": i.variant_id, "ordered_qty": i.ordered_qty, "unit_cost": i.unit_cost} for i in payload.items]
    db.commit()
    return {"status": "updated", "slot_id": slot_id}

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date
from app.database import get_db
from app.services.csv_processor import process_inbound_csv
from app.models import Procurement, ProcurementItem, ProductVariant, Vendor
from app.utils.time_utils import format_ts

router = APIRouter(prefix="/api/inbound", tags=["Inbound"])


@router.post("/upload-csv")
async def upload_inbound_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = process_inbound_csv(db, content)
    return result


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

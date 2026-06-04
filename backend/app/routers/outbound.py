from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date
from app.database import get_db
from app.services.csv_processor import process_outbound_csv
from app.models import SalesOrder, OrderLineItem, ProductVariant
from app.utils.time_utils import format_ts

router = APIRouter(prefix="/api/outbound", tags=["Outbound"])


@router.post("/upload-csv")
async def upload_outbound_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = process_outbound_csv(db, content)
    return result


@router.get("/ledger")
def get_outbound_ledger(
    db: Session = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    q = (
        db.query(SalesOrder, OrderLineItem)
        .join(OrderLineItem, OrderLineItem.order_id == SalesOrder.order_id)
    )

    if date_from:
        q = q.filter(SalesOrder.created_at >= date_from)
    if date_to:
        q = q.filter(SalesOrder.created_at <= date_to)
    if status:
        q = q.filter(SalesOrder.order_status == status)

    total = q.count()
    rows = q.order_by(desc(SalesOrder.created_at)).offset(skip).limit(limit).all()

    result = []
    for order, line in rows:
        variant = db.get(ProductVariant, line.variant_id)
        result.append({
            "order_id": order.order_id,
            "user_id": order.user_id,
            "variant_id": line.variant_id,
            "variant_name": variant.variant_name if variant else line.variant_id,
            "quantity": line.quantity,
            "unit_price": float(line.unit_price),
            "total_price": float(line.total_price or 0),
            "order_status": order.order_status,
            "payment_status": order.payment_status,
            "created_at": format_ts(order.created_at),
        })

    return {"total": total, "data": result}

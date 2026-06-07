from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date
from pydantic import BaseModel
from app.database import get_db
from app.services.csv_processor import process_outbound_csv
from app.services.fefo_engine import allocate, preview_allocate
from app.services.shelf_life_checker import check_dispatch_block
from app.services.stock_monitor import check_and_alert
from app.services import notification_service
from app.models import SalesOrder, OrderLineItem, ProductVariant, Product, Brand, AlertLog
from app.utils.time_utils import format_ts, now
from app.utils.id_gen import new_id
from app.config import settings

router = APIRouter(prefix="/api/outbound", tags=["Outbound"])

FC_ID = settings.FULFILLMENT_CENTER_ID


class ManualOrderItem(BaseModel):
    variant_id: str
    quantity: int
    unit_price: float


class ManualOrderPayload(BaseModel):
    customer_name: str
    notes: Optional[str] = None
    items: List[ManualOrderItem]


@router.post("/manual")
def create_manual_order(payload: ManualOrderPayload, db: Session = Depends(get_db)):
    """Create a manual sales order — goes straight to pending_approval."""
    total = sum(i.quantity * i.unit_price for i in payload.items)

    order = SalesOrder(
        order_id=new_id(),
        user_id="WALKIN-CUSTOMER",   # FK placeholder; actual name stored in order_instruction
        fullfillment_center_id=FC_ID,
        total_price=round(total, 2),
        price_without_delivery=round(total, 2),
        delivery_charge=0,
        cod_charges=0,
        payment_status="pending",
        paid_by_wallet=0,
        rem_price=0,
        reserve_amount=0,
        coupon_discount=0,
        time_slot_discount=0,
        dboy_incentive=0,
        del_partner_tip=0,
        order_status="pending_approval",
        cancel_by_store=False,
        refunded_amount=0,
        si_payment_flag=False,
        deduction_amt=0,
        notify_flag=False,
        notification_send_end=False,
        is_subscription=False,
        repeat_orders=0,
        trail_discount=0,
        aft_com_order_dis=0,
        is_offer_product=False,
        order_missing_status=False,
        pastorecentrder=False,
        order_instruction=payload.customer_name,   # customer name shown in pending panel
        special_instruction=payload.notes,
    )
    db.add(order)
    db.flush()

    for item in payload.items:
        variant = db.get(ProductVariant, item.variant_id)
        line = OrderLineItem(
            order_line_id=new_id(),
            order_id=order.order_id,
            variant_id=item.variant_id,
            product_id=variant.product_id if variant else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=round(item.quantity * item.unit_price, 2),
            discount=0,
            discount_per=0,
            is_subscription_item=False,
        )
        db.add(line)

    db.commit()

    notification_service.push(
        f"New sales order from {payload.customer_name} — {len(payload.items)} item(s) pending approval.",
        ntype="pending_approval",
    )

    return {"order_id": order.order_id, "status": order.order_status, "total": float(order.total_price)}


@router.post("/upload-csv")
async def upload_outbound_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = process_outbound_csv(db, content)
    return result


@router.get("/pending")
def get_pending_outbound(db: Session = Depends(get_db)):
    """All outbound orders awaiting admin approval, with FEFO batch preview."""
    orders = (
        db.query(SalesOrder)
        .filter(SalesOrder.order_status == "pending_approval")
        .order_by(desc(SalesOrder.created_at))
        .all()
    )

    result = []
    for order in orders:
        lines = (
            db.query(OrderLineItem)
            .filter(OrderLineItem.order_id == order.order_id)
            .all()
        )

        line_details = []
        for line in lines:
            variant = db.get(ProductVariant, line.variant_id)
            product = db.get(Product, variant.product_id) if variant else None
            brand = db.get(Brand, product.brand_id) if product and product.brand_id else None

            shelf = check_dispatch_block(db, line.variant_id)
            preview = preview_allocate(db, line.variant_id, FC_ID, line.quantity)

            line_details.append({
                "order_line_id": line.order_line_id,
                "variant_id": line.variant_id,
                "variant_name": variant.variant_name if variant else line.variant_id,
                "product_name": product.product_name if product else "",
                "brand_name": brand.name if brand else "",
                "qty_requested": line.quantity,
                "unit_price": float(line.unit_price),
                "shelf_blocked": shelf.blocked,
                "block_reason": shelf.reason,
                "fefo_preview": {
                    "fulfilled": preview.fulfilled,
                    "qty_fulfilled": preview.qty_fulfilled,
                    "shortage": preview.shortage,
                    "batches": [
                        {
                            "inventory_id": b.inventory_id,
                            "batch_no": b.batch_no,
                            "sell_before_date": b.sell_before_date,
                            "expiry_date": b.expiry_date,
                            "qty_available": b.qty_available,
                            "qty_to_dispatch": b.qty_to_dispatch,
                            "days_until_expiry": b.days_until_expiry,
                            "temperature_measured": b.temperature_measured,
                            "dispatch_blocked": b.dispatch_blocked,
                            "dispatch_cutoff": b.dispatch_cutoff,
                        }
                        for b in preview.batches
                    ],
                },
            })

        result.append({
            "order_id": order.order_id,
            "user_id": order.order_instruction or order.user_id,
            "estimated_total": float(order.total_price or 0),
            "created_at": format_ts(order.created_at),
            "lines": line_details,
        })

    return {"total": len(result), "data": result}


def _upsert_alert(db: Session, variant_id: str, alert_type: str, current_qty: int, threshold_qty: int, message: str) -> None:
    """Create or refresh an unresolved alert of the given type for this variant."""
    existing = (
        db.query(AlertLog)
        .filter(AlertLog.variant_id == variant_id, AlertLog.alert_type == alert_type, AlertLog.is_resolved == False)
        .first()
    )
    if existing:
        existing.current_qty = current_qty
        existing.threshold_qty = threshold_qty
        existing.message = message
        existing.created_at = now()
    else:
        db.add(AlertLog(
            alert_id=new_id(),
            threshold_id=None,
            variant_id=variant_id,
            fulfillment_center_id=FC_ID,
            alert_type=alert_type,
            current_qty=current_qty,
            threshold_qty=threshold_qty,
            message=message,
            is_resolved=False,
            created_at=now(),
        ))
    db.commit()


@router.post("/{order_id}/approve")
def approve_outbound(order_id: str, db: Session = Depends(get_db)):
    """Approve a pending outbound order — runs FEFO and deducts inventory."""
    order = db.get(SalesOrder, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.order_status != "pending_approval":
        raise HTTPException(400, f"Cannot approve — current status is '{order.order_status}'")

    lines = (
        db.query(OrderLineItem)
        .filter(OrderLineItem.order_id == order_id)
        .all()
    )

    total = 0.0
    dispatch_summary = []
    for line in lines:
        fefo = allocate(
            db, line.variant_id, FC_ID, line.quantity,
            reference_type="sales_order",
            reference_id=order_id,
        )

        line.quantity = fefo.qty_fulfilled
        line.total_price = round(fefo.qty_fulfilled * float(line.unit_price), 2)
        total += fefo.qty_fulfilled * float(line.unit_price)

        if fefo.shortage > 0:
            shelf = check_dispatch_block(db, line.variant_id)
            if shelf.blocked:
                notification_service.push(
                    f"Dispatch BLOCKED for variant {line.variant_id}: {shelf.reason}",
                    ntype="dispatch_blocked",
                    variant_id=line.variant_id,
                )
                _upsert_alert(db, line.variant_id, "dispatch_blocked", fefo.qty_fulfilled, line.quantity,
                              f"Dispatch blocked for order {order_id[:8]}: {shelf.reason}")
            else:
                _upsert_alert(db, line.variant_id, "stock_shortage", fefo.qty_fulfilled, line.quantity,
                              f"Stock shortage for order {order_id[:8]}: requested {line.quantity}, fulfilled {fefo.qty_fulfilled}, short by {fefo.shortage}.")

        dispatch_summary.append({
            "variant_id": line.variant_id,
            "status": "fulfilled" if fefo.fulfilled else "partial",
            "qty_fulfilled": fefo.qty_fulfilled,
            "shortage": fefo.shortage,
        })

    order.order_status = "confirmed"
    order.total_price = round(total, 2)
    order.updated_at = now()
    db.commit()

    dispatched_variants = {s["variant_id"] for s in dispatch_summary if s.get("status") in ("fulfilled", "partial")}
    for vid in dispatched_variants:
        check_and_alert(db, vid)

    notification_service.push(
        f"Outbound order {order_id[:8]}… approved and dispatched — {len(dispatch_summary)} line(s).",
        ntype="info",
    )

    return {"status": "confirmed", "order_id": order_id, "lines": dispatch_summary}


@router.post("/{order_id}/reject")
def reject_outbound(order_id: str, db: Session = Depends(get_db)):
    """Reject a pending outbound order."""
    order = db.get(SalesOrder, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.order_status != "pending_approval":
        raise HTTPException(400, f"Cannot reject — current status is '{order.order_status}'")

    order.order_status = "cancelled"
    order.updated_at = now()
    db.commit()

    notification_service.push(
        f"Outbound order {order_id[:8]}… rejected by admin.",
        ntype="info",
    )

    return {"status": "cancelled", "order_id": order_id}


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

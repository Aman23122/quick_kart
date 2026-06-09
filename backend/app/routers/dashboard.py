from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.database import get_db
from app.models import Inventory, AlertLog, Procurement, ProcurementItem, SalesOrder, OrderLineItem, ProductVariant, Product, Brand, Vendor
from app.config import settings
from app.utils.time_utils import format_ts

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

FC_ID = settings.FULFILLMENT_CENTER_ID


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    today = date.today()
    yesterday = today - timedelta(days=1)

    total_skus = (
        db.query(func.count(func.distinct(Inventory.variant_id)))
        .filter(Inventory.fulfillment_center_id == FC_ID, Inventory.qty > 0)
        .scalar() or 0
    )

    low_stock_count = (
        db.query(func.count(AlertLog.alert_id))
        .filter(AlertLog.alert_type == "low_stock", AlertLog.is_resolved == False)
        .scalar() or 0
    )

    wastage_alerts = (
        db.query(func.count(AlertLog.alert_id))
        .filter(AlertLog.alert_type == "wastage_risk", AlertLog.is_resolved == False)
        .scalar() or 0
    )

    near_expiry = (
        db.query(func.count(func.distinct(Inventory.variant_id)))
        .filter(
            Inventory.fulfillment_center_id == FC_ID,
            Inventory.qty > 0,
            Inventory.sell_before_date <= today + timedelta(days=2),
            Inventory.sell_before_date >= today,
        )
        .scalar() or 0
    )

    today_inbound = (
        db.query(func.count(Procurement.procurement_id))
        .filter(func.date(Procurement.created_at) == today)
        .scalar() or 0
    )

    today_outbound = (
        db.query(func.count(SalesOrder.order_id))
        .filter(func.date(SalesOrder.created_at) == today)
        .scalar() or 0
    )

    today_inbound_value = (
        db.query(func.sum(ProcurementItem.received_qty * ProcurementItem.unit_cost))
        .join(Procurement, Procurement.procurement_id == ProcurementItem.procurement_id)
        .filter(
            func.date(Procurement.created_at) == today,
            Procurement.status == "approved",
        )
        .scalar() or 0
    )

    today_outbound_value = (
        db.query(func.sum(OrderLineItem.quantity * OrderLineItem.unit_price))
        .join(SalesOrder, SalesOrder.order_id == OrderLineItem.order_id)
        .filter(
            func.date(SalesOrder.created_at) == today,
            SalesOrder.order_status == "confirmed",
        )
        .scalar() or 0
    )

    total_inventory_value = (
        db.query(func.sum(Inventory.qty * Inventory.cost_price))
        .filter(Inventory.fulfillment_center_id == FC_ID, Inventory.qty > 0)
        .scalar() or 0
    )

    return {
        "total_skus": total_skus,
        "low_stock_count": low_stock_count,
        "wastage_alerts": wastage_alerts,
        "near_expiry_count": near_expiry,
        "today_inbound": today_inbound,
        "today_outbound": today_outbound,
        "today_inbound_value": round(float(today_inbound_value), 2),
        "today_outbound_value": round(float(today_outbound_value), 2),
        "total_inventory_value": round(float(total_inventory_value), 2),
    }


@router.get("/today-inbound")
def get_today_inbound_detail(db: Session = Depends(get_db)):
    """Line-level breakdown of all inbound shipments today (all statuses)."""
    today = date.today()
    rows = (
        db.query(Procurement, ProcurementItem)
        .join(ProcurementItem, ProcurementItem.procurement_id == Procurement.procurement_id)
        .filter(
            func.date(Procurement.created_at) == today,
        )
        .order_by(Procurement.created_at)
        .all()
    )

    result = []
    for proc, item in rows:
        variant = db.get(ProductVariant, item.variant_id)
        product = db.get(Product, variant.product_id) if variant else None
        brand = db.get(Brand, product.brand_id) if product and product.brand_id else None
        vendor = db.get(Vendor, proc.vendor_id)
        result.append({
            "procurement_id": proc.procurement_id,
            "status": proc.status,
            "po_number": proc.po_number,
            "vendor_name": vendor.name if vendor else proc.vendor_id,
            "product_name": product.product_name if product else "",
            "brand_name": brand.name if brand else "",
            "variant_name": variant.variant_name if variant else item.variant_id,
            "batch_no": item.batch_no or "—",
            "received_qty": item.received_qty,
            "unit_cost": float(item.unit_cost),
            "total_cost": round(float(item.received_qty * item.unit_cost), 2),
            "received_at": format_ts(proc.created_at),
        })

    total_value = sum(r["total_cost"] for r in result if r["status"] == "approved")
    return {"total_value": round(total_value, 2), "data": result}


@router.get("/today-outbound")
def get_today_outbound_detail(db: Session = Depends(get_db)):
    """Line-level breakdown of all outbound orders created today (all statuses)."""
    today = date.today()
    rows = (
        db.query(SalesOrder, OrderLineItem)
        .join(OrderLineItem, OrderLineItem.order_id == SalesOrder.order_id)
        .filter(
            func.date(SalesOrder.created_at) == today,
        )
        .order_by(SalesOrder.created_at)
        .all()
    )

    result = []
    for order, line in rows:
        variant = db.get(ProductVariant, line.variant_id)
        product = db.get(Product, variant.product_id) if variant else None
        brand = db.get(Brand, product.brand_id) if product and product.brand_id else None
        result.append({
            "order_id": order.order_id,
            "order_status": order.order_status,
            "customer_name": order.order_instruction or order.user_id,
            "product_name": product.product_name if product else "",
            "brand_name": brand.name if brand else "",
            "variant_name": variant.variant_name if variant else line.variant_id,
            "quantity": line.quantity,
            "unit_price": float(line.unit_price),
            "total_price": round(float(line.total_price or 0), 2),
            "dispatched_at": format_ts(order.updated_at or order.created_at),
        })

    total_value = sum(r["total_price"] for r in result if r["order_status"] == "confirmed")
    return {"total_value": round(total_value, 2), "data": result}


@router.get("/notifications")
def get_notifications():
    from app.services import notification_service
    return {"data": notification_service.get_all()}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    from app.services import notification_service
    notification_service.mark_read(notification_id)
    return {"status": "ok"}

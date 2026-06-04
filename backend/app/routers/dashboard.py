from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.database import get_db
from app.models import Inventory, AlertLog, Procurement, SalesOrder
from app.config import settings

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
        "total_inventory_value": round(float(total_inventory_value), 2),
    }


@router.get("/notifications")
def get_notifications():
    from app.services import notification_service
    return {"data": notification_service.get_all()}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    from app.services import notification_service
    notification_service.mark_read(notification_id)
    return {"status": "ok"}

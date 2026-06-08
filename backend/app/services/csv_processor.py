"""CSV processor: parse, validate, and bulk-write inbound/outbound CSVs."""
from __future__ import annotations
import io
import pandas as pd
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.models import (
    Procurement, ProcurementItem, Inventory,
    SalesOrder, OrderLineItem, ProductVariant,
)
from app.services.qc_gate import validate_inbound
from app.services.fefo_engine import allocate
from app.services.shelf_life_checker import check_dispatch_block
from app.services.stock_monitor import check_and_alert
from app.services import notification_service
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings

FC_ID = settings.FULFILLMENT_CENTER_ID

INBOUND_REQUIRED = [
    "vendor_id", "variant_id", "ordered_qty", "received_qty",
    "temperature_measured", "unit_cost", "expiry_date", "sell_before_date",
]

OUTBOUND_REQUIRED = [
    "user_id", "variant_id", "quantity", "unit_price",
]


def _parse_date(val) -> date | None:
    if pd.isna(val) or val == "":
        return None
    if isinstance(val, date):
        return val
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


def process_inbound_csv(db: Session, file_bytes: bytes) -> dict:
    df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = [c for c in INBOUND_REQUIRED if c not in df.columns]
    if missing:
        return {"error": f"Missing columns: {missing}"}

    results = []
    for _, row in df.iterrows():
        variant_id = str(row["variant_id"]).strip()
        temp = int(float(row.get("temperature_measured", 0)))
        received_qty = int(float(row.get("received_qty", 0)))
        ordered_qty = int(float(row.get("ordered_qty", 0)))
        unit_cost = float(row.get("unit_cost", 0))
        vendor_id = str(row["vendor_id"]).strip()
        expiry_date = _parse_date(row.get("expiry_date"))
        sell_before_date = _parse_date(row.get("sell_before_date"))
        batch_no = str(row.get("batch_no", "")).strip() or None
        vendor_invoice = int(float(row.get("vendor_invoice_number", 0))) or 0

        if not sell_before_date:
            results.append({"variant_id": variant_id, "status": "error", "reason": "Missing sell_before_date"})
            continue

        qc = validate_inbound(db, variant_id, temp)

        if not qc.passed:
            # QC failed — create rejected procurement, no further action
            procurement_id = new_id()
            po_number = f"PO-{now().strftime('%Y%m%d%H%M%S')}-{procurement_id[:6]}"
            db.add(Procurement(
                procurement_id=procurement_id,
                vendor_id=vendor_id,
                fulfillment_center_id=FC_ID,
                vendor_invoice_number=vendor_invoice,
                po_number=po_number,
                status="rejected",
                total_amount=round(received_qty * unit_cost, 2),
                actual_received_date=date.today(),
                created_at=now(),
                updated_at=now(),
            ))
            db.add(ProcurementItem(
                procurement_item_id=new_id(),
                procurement_id=procurement_id,
                variant_id=variant_id,
                ordered_qty=ordered_qty,
                temperature_measured=temp,
                received_qty=received_qty,
                unit_cost=unit_cost,
                total_cost=round(received_qty * unit_cost, 2),
                batch_no=batch_no,
                expiry_date=expiry_date,
                sell_before_date=sell_before_date,
                created_at=now(),
            ))
            notification_service.push(
                f"Inbound QC FAILED for variant {variant_id}: {qc.reason}",
                ntype="inbound_rejected",
                variant_id=variant_id,
            )
            results.append({"variant_id": variant_id, "status": "rejected", "reason": qc.reason})
            continue

        # QC passed — store as pending_approval, do NOT write to inventory yet
        procurement_id = new_id()
        po_number = f"PO-{now().strftime('%Y%m%d%H%M%S')}-{procurement_id[:6]}"
        db.add(Procurement(
            procurement_id=procurement_id,
            vendor_id=vendor_id,
            fulfillment_center_id=FC_ID,
            vendor_invoice_number=vendor_invoice,
            po_number=po_number,
            status="pending_approval",
            total_amount=round(received_qty * unit_cost, 2),
            actual_received_date=date.today(),
            created_at=now(),
            updated_at=now(),
        ))
        db.add(ProcurementItem(
            procurement_item_id=new_id(),
            procurement_id=procurement_id,
            variant_id=variant_id,
            ordered_qty=ordered_qty,
            temperature_measured=temp,
            received_qty=received_qty,
            unit_cost=unit_cost,
            total_cost=round(received_qty * unit_cost, 2),
            batch_no=batch_no,
            expiry_date=expiry_date,
            sell_before_date=sell_before_date,
            created_at=now(),
        ))
        results.append({"variant_id": variant_id, "status": "pending_approval", "reason": ""})

    db.commit()

    pending_count = sum(1 for r in results if r["status"] == "pending_approval")
    rejected_count = sum(1 for r in results if r["status"] == "rejected")

    if pending_count:
        notification_service.push(
            f"{pending_count} inbound item(s) awaiting your approval — review temperatures, quantities & expiry before accepting to inventory.",
            ntype="pending_approval",
        )
    if rejected_count:
        notification_service.push(
            f"{rejected_count} inbound item(s) failed QC and were rejected.",
            ntype="inbound_rejected",
        )

    return {"processed": len(results), "pending_approval": pending_count, "rejected": rejected_count, "rows": results}


def process_outbound_csv(db: Session, file_bytes: bytes) -> dict:
    df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = [c for c in OUTBOUND_REQUIRED if c not in df.columns]
    if missing:
        return {"error": f"Missing columns: {missing}"}

    results = []
    order_id = new_id()
    user_id = str(df.iloc[0]["user_id"]).strip()

    # Stage the order as pending_approval — FEFO runs only after admin approves
    order = SalesOrder(
        order_id=order_id,
        user_id=user_id,
        fullfillment_center_id=FC_ID,
        total_price=0,
        delivery_charge=0,
        cod_charges=0,
        paid_by_wallet=0,
        rem_price=0,
        reserve_amount=0,
        coupon_discount=0,
        time_slot_discount=0,
        dboy_incentive=0,
        del_partner_tip=0,
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
        order_status="pending_approval",
        payment_status="pending",
        created_at=now(),
        updated_at=now(),
    )
    db.add(order)
    db.flush()  # ensures sales_order row exists before line item FK insert

    estimated_total = 0.0
    for _, row in df.iterrows():
        variant_id = str(row["variant_id"]).strip()
        qty = int(float(row.get("quantity", 0)))
        unit_price = float(row.get("unit_price", 0))
        mrp = float(row.get("mrp", unit_price))

        # Store the request as-is — no FEFO, no shelf check yet
        line = OrderLineItem(
            order_line_id=new_id(),
            order_id=order_id,
            variant_id=variant_id,
            product_id=None,
            quantity=qty,
            unit_price=unit_price,
            mrp=mrp,
            total_price=round(qty * unit_price, 2),
            discount=0,
            discount_per=0,
            is_subscription_item=False,
            created_at=now(),
        )
        db.add(line)
        estimated_total += qty * unit_price
        results.append({"variant_id": variant_id, "status": "pending_approval", "qty_requested": qty})

    order.total_price = round(estimated_total, 2)
    db.commit()

    notification_service.push(
        f"New outbound order {order_id[:8]}… is awaiting approval — {len(results)} line item(s). Review batches before dispatching.",
        ntype="pending_approval",
    )

    return {"order_id": order_id, "processed": len(results), "pending_approval": len(results), "rows": results}

"""APScheduler-based scheduled PO scheduler.

When the configured time fires, reads the slot's template and creates a real
Procurement PO (status=sent) directly — no grace window, no draft step.

Expected receive date logic:
  00:00–03:59  → same calendar day, 10:00
  04:00–23:59  → next calendar day, 10:00
"""
from datetime import datetime, timedelta, time as dtime
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import SessionLocal
from app.models import (
    ScheduledPOTemplate, Procurement, ProcurementItem,
    Vendor, ProductVariant, Product, SystemConfig,
)
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app.config import settings

FC_ID = settings.FULFILLMENT_CENTER_ID

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


# ── Config helper ─────────────────────────────────────────────────────────────

def _read_time(db, key: str, fallback: str) -> tuple[int, int]:
    row = db.get(SystemConfig, key)
    raw = row.config_value if row else fallback
    try:
        h, m = raw.strip().split(":")
        return int(h), int(m)
    except Exception:
        h, m = fallback.split(":")
        return int(h), int(m)


# ── Core job ──────────────────────────────────────────────────────────────────

def _fire_scheduled_po(slot_id: str) -> Optional[str]:
    db = SessionLocal()
    try:
        tmpl = db.get(ScheduledPOTemplate, slot_id)
        if not tmpl or not tmpl.vendor_id or not tmpl.items:
            print(f"[PO Scheduler] No template / empty template for '{slot_id}', skipping")
            return None

        fire_time = now()

        # Expected receive date
        t = fire_time.time()
        if dtime(0, 0) <= t < dtime(4, 0):
            recv_date = fire_time.date()
        else:
            recv_date = fire_time.date() + timedelta(days=1)
        recv_time_str = tmpl.expected_receive_time or "10:00"

        total_amount = sum(i["ordered_qty"] * i["unit_cost"] for i in tmpl.items)

        proc_id = new_id()
        po_number = f"SPO-{proc_id[:8].upper()}"

        proc = Procurement(
            procurement_id=proc_id,
            vendor_id=tmpl.vendor_id,
            fulfillment_center_id=FC_ID,
            po_number=po_number,
            status="sent",
            total_amount=total_amount,
            expected_receive_date=recv_date,
            expected_receive_time=recv_time_str,
            notes=tmpl.notes or None,
            created_at=fire_time,
            updated_at=fire_time,
        )
        db.add(proc)
        db.flush()

        item_summaries = []
        for it in tmpl.items:
            variant = db.get(ProductVariant, it["variant_id"])
            product = db.get(Product, variant.product_id) if variant else None
            sell_before = fire_time.date() + timedelta(days=variant.sell_before_days if variant else 7)

            db.add(ProcurementItem(
                procurement_item_id=new_id(),
                procurement_id=proc_id,
                variant_id=it["variant_id"],
                ordered_qty=it["ordered_qty"],
                received_qty=0,
                temperature_measured=variant.temperature_required if variant else 0,
                unit_cost=it["unit_cost"],
                total_cost=it["ordered_qty"] * it["unit_cost"],
                sell_before_date=sell_before,
            ))

            p_name = product.product_name if product else it["variant_id"]
            v_name = variant.variant_name if variant else ""
            label = f"{p_name} — {v_name}" if v_name else p_name
            item_summaries.append(f"{label} ×{it['ordered_qty']} @ ₹{it['unit_cost']}")

        db.commit()

        vendor = db.get(Vendor, tmpl.vendor_id)
        vendor_name = vendor.name if vendor else tmpl.vendor_id
        recv_str = f"{recv_date.strftime('%d %b')} {recv_time_str}"

        from app.services import notification_service
        notification_service.push(
            message=f"PO Auto-Sent → {vendor_name} | {', '.join(item_summaries)} | Delivery: {recv_str}",
            ntype="po_sent",
            extra={"procurement_id": proc_id, "po_number": po_number},
        )
        print(f"[PO Scheduler] Auto-sent {po_number} → {vendor_name} ({slot_id})")
        return po_number
    finally:
        db.close()


# ── Setup ─────────────────────────────────────────────────────────────────────

def setup_jobs():
    db = SessionLocal()
    try:
        default_h, default_m = _read_time(db, "po_dairy_evening_grace_time", "18:20")
        templates = db.query(ScheduledPOTemplate).all()
    finally:
        db.close()

    slot_ids = [t.slot_id for t in templates]

    # Remove jobs whose templates were deleted
    for job in scheduler.get_jobs():
        if job.id not in slot_ids:
            scheduler.remove_job(job.id)

    # Add / update a job for every template using its own cron_time (fallback to global config)
    for tmpl in templates:
        if tmpl.cron_time:
            try:
                h, m = map(int, tmpl.cron_time.strip().split(":"))
            except Exception:
                h, m = default_h, default_m
        else:
            h, m = default_h, default_m

        scheduler.add_job(
            _fire_scheduled_po,
            CronTrigger(hour=h, minute=m),
            id=tmpl.slot_id,
            args=[tmpl.slot_id],
            replace_existing=True,
        )
        print(f"[PO Scheduler] {tmpl.slot_id} fires at {h:02d}:{m:02d}")
    print(f"[PO Scheduler] {len(slot_ids)} job(s) scheduled")


def get_next_run_times() -> list[dict]:
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "job_id": job.id,
            "next_run": next_run.strftime("%Y-%m-%d %H:%M:%S") if next_run else None,
        })
    return jobs

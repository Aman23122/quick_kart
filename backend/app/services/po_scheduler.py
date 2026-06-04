"""APScheduler-based PO grace-window scheduler."""
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import SessionLocal
from app.models import DraftPO, SystemConfig
from app.utils.id_gen import new_id
from app.utils.time_utils import now


scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


# ── Config helpers ────────────────────────────────────────────────────────────

def _read_time(db, key: str, fallback: str) -> tuple[int, int]:
    """Return (hour, minute) from a HH:MM config key, or fallback if missing/malformed."""
    row = db.get(SystemConfig, key)
    raw = row.config_value if row else fallback
    try:
        h, m = raw.strip().split(":")
        return int(h), int(m)
    except Exception:
        h, m = fallback.split(":")
        return int(h), int(m)


# ── Grace window creators ────────────────────────────────────────────────────

def _create_draft(po_type: str, slot_label: str, fire_in_minutes: int = 10):
    db = SessionLocal()
    try:
        grace_time = now()
        fire_time = grace_time + timedelta(minutes=fire_in_minutes)

        draft = DraftPO(
            draft_id=new_id(),
            po_type=po_type,
            slot_label=slot_label,
            scheduled_fire_at=fire_time,
            grace_starts_at=grace_time,
            status="draft",
            line_items=[],
            created_at=grace_time,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

        from app.services import notification_service
        notification_service.push(
            message=(
                f"Grace window OPEN: {po_type.upper()} {slot_label} Draft PO created. "
                f"You have 10 minutes to review before auto-send."
            ),
            ntype="po_draft_ready",
            extra={"draft_id": draft.draft_id, "fire_at": str(fire_time)},
        )
        print(f"[PO Scheduler] Draft PO created: {po_type} / {slot_label} → fires at {fire_time}")
    finally:
        db.close()


def _fire_draft(po_type: str, slot_label: str):
    """Auto-send drafts that are still in 'draft' status."""
    db = SessionLocal()
    try:
        pending = (
            db.query(DraftPO)
            .filter(
                DraftPO.po_type == po_type,
                DraftPO.slot_label == slot_label,
                DraftPO.status == "draft",
            )
            .all()
        )
        for draft in pending:
            draft.status = "sent"
            print(f"[PO Scheduler] Auto-sent draft {draft.draft_id} ({po_type}/{slot_label})")

        db.commit()

        if pending:
            from app.services import notification_service
            notification_service.push(
                message=f"PO auto-sent: {po_type.upper()} {slot_label} — {len(pending)} draft(s) dispatched.",
                ntype="po_sent",
            )
    finally:
        db.close()


# ── Job definitions ───────────────────────────────────────────────────────────

def setup_jobs():
    db = SessionLocal()
    try:
        dairy_g_h,  dairy_g_m  = _read_time(db, "po_dairy_evening_grace_time",        "18:20")
        dairy_f_h,  dairy_f_m  = _read_time(db, "po_dairy_evening_fire_time",         "18:30")
        meat_g_h,   meat_g_m   = _read_time(db, "po_meat_morning_grace_time",         "11:50")
        meat_f_h,   meat_f_m   = _read_time(db, "po_meat_morning_fire_time",          "12:00")
        mf_g_h,     mf_g_m     = _read_time(db, "po_meat_flowers_evening_grace_time", "18:20")
        mf_f_h,     mf_f_m     = _read_time(db, "po_meat_flowers_evening_fire_time",  "18:30")
    finally:
        db.close()

    # Dairy Evening
    scheduler.add_job(_create_draft, CronTrigger(hour=dairy_g_h, minute=dairy_g_m),
                      id="dairy_grace_evening", args=["dairy", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft,   CronTrigger(hour=dairy_f_h, minute=dairy_f_m),
                      id="dairy_fire_evening",  args=["dairy", "evening"],
                      replace_existing=True)

    # Meat Morning
    scheduler.add_job(_create_draft, CronTrigger(hour=meat_g_h, minute=meat_g_m),
                      id="meat_grace_morning",  args=["meat", "morning"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft,   CronTrigger(hour=meat_f_h, minute=meat_f_m),
                      id="meat_fire_morning",   args=["meat", "morning"],
                      replace_existing=True)

    # Meat/Flowers Evening (share the same config slot)
    scheduler.add_job(_create_draft, CronTrigger(hour=mf_g_h, minute=mf_g_m),
                      id="flowers_grace_evening", args=["flowers", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft,   CronTrigger(hour=mf_f_h, minute=mf_f_m),
                      id="flowers_fire_evening",  args=["flowers", "evening"],
                      replace_existing=True)

    scheduler.add_job(_create_draft, CronTrigger(hour=mf_g_h, minute=mf_g_m),
                      id="meat_grace_evening",    args=["meat", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft,   CronTrigger(hour=mf_f_h, minute=mf_f_m),
                      id="meat_fire_evening",     args=["meat", "evening"],
                      replace_existing=True)

    print(f"[PO Scheduler] Jobs configured: dairy_evening={dairy_g_h:02d}:{dairy_g_m:02d}/{dairy_f_h:02d}:{dairy_f_m:02d} "
          f"meat_morning={meat_g_h:02d}:{meat_g_m:02d}/{meat_f_h:02d}:{meat_f_m:02d} "
          f"meat_flowers_evening={mf_g_h:02d}:{mf_g_m:02d}/{mf_f_h:02d}:{mf_f_m:02d}")


def get_next_run_times() -> list[dict]:
    """Return all scheduled jobs with their next fire time."""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "job_id": job.id,
            "next_run": next_run.strftime("%Y-%m-%d %H:%M:%S") if next_run else None,
        })
    return jobs

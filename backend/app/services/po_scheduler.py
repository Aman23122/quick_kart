"""APScheduler-based PO grace-window scheduler."""
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import SessionLocal
from app.models import DraftPO
from app.utils.id_gen import new_id
from app.utils.time_utils import now
from app import services as _svc


scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


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
    # Dairy evening: grace at 18:20, fire at 18:30
    scheduler.add_job(_create_draft, CronTrigger(hour=18, minute=20),
                      id="dairy_grace_evening", args=["dairy", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft, CronTrigger(hour=18, minute=30),
                      id="dairy_fire_evening", args=["dairy", "evening"],
                      replace_existing=True)

    # Meat morning: grace at 11:50, fire at 12:00
    scheduler.add_job(_create_draft, CronTrigger(hour=11, minute=50),
                      id="meat_grace_morning", args=["meat", "morning"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft, CronTrigger(hour=12, minute=0),
                      id="meat_fire_morning", args=["meat", "morning"],
                      replace_existing=True)

    # Flowers evening: grace at 18:20, fire at 18:30
    scheduler.add_job(_create_draft, CronTrigger(hour=18, minute=20),
                      id="flowers_grace_evening", args=["flowers", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft, CronTrigger(hour=18, minute=30),
                      id="flowers_fire_evening", args=["flowers", "evening"],
                      replace_existing=True)

    # Meat evening: grace at 18:20, fire at 18:30
    scheduler.add_job(_create_draft, CronTrigger(hour=18, minute=20),
                      id="meat_grace_evening", args=["meat", "evening"],
                      replace_existing=True)
    scheduler.add_job(_fire_draft, CronTrigger(hour=18, minute=30),
                      id="meat_fire_evening", args=["meat", "evening"],
                      replace_existing=True)


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

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from sqlalchemy import text
from app.database import engine
from app.models import *  # noqa: F401, F403 — registers all ORM models
from app.database import Base
from app.auth.dependencies import get_current_user


def _run_migrations():
    migrations = [
        "ALTER TABLE procurement ADD COLUMN expected_receive_time VARCHAR(5) NULL",
        "ALTER TABLE procurement MODIFY COLUMN vendor_invoice_number BIGINT NULL",
        "ALTER TABLE procurement ADD COLUMN actual_received_time VARCHAR(5) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN label VARCHAR(100) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN cron_time VARCHAR(5) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN expected_receive_time VARCHAR(5) NULL",
        "ALTER TABLE inventory ADD COLUMN batch_no VARCHAR(100) NULL",
        "ALTER TABLE inventory ADD COLUMN dispatch_cutoff DATETIME NULL",
        "ALTER TABLE alert_log ADD COLUMN batch_no VARCHAR(100) NULL",
        "ALTER TABLE procurement_item ADD COLUMN damaged_qty INT NOT NULL DEFAULT 0",
        "ALTER TABLE order_line_item ADD COLUMN original_qty INT NULL",
        "ALTER TABLE order_line_item ADD COLUMN dispatch_qty INT NULL",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass


from app.routers import inbound, outbound, inventory, alerts, po, config, dashboard, vendors, products
from app.routers.auth_router import router as auth_router
from app.routers.user_router import router as user_router
from app.services.po_scheduler import scheduler, setup_jobs
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()

    setup_jobs()

    from app.services.shelf_life_checker import check_dispatch_cutoff_alerts, schedule_pre_dispatch_alert
    from app.models.inventory import Inventory as InventoryModel
    from app.database import SessionLocal
    from apscheduler.triggers.interval import IntervalTrigger

    def _run_dispatch_cutoff_check():
        db = SessionLocal()
        try:
            check_dispatch_cutoff_alerts(db)
        finally:
            db.close()

    scheduler.add_job(
        _run_dispatch_cutoff_check,
        IntervalTrigger(minutes=15),
        id="dispatch_cutoff_check",
        replace_existing=True,
    )

    def _reschedule_existing_batches():
        from datetime import datetime as _dt
        db = SessionLocal()
        try:
            batches = (
                db.query(InventoryModel)
                .filter(
                    InventoryModel.dispatch_cutoff.isnot(None),
                    InventoryModel.dispatch_cutoff > _dt.now(),
                    InventoryModel.qty > 0,
                )
                .all()
            )
            for batch in batches:
                schedule_pre_dispatch_alert(db, batch.inventory_id, batch.variant_id, batch.dispatch_cutoff)
            print(f"[Scheduler] Rescheduled pre-dispatch alerts for {len(batches)} batch(es).")
        finally:
            db.close()

    _reschedule_existing_batches()

    scheduler.start()
    print(f"[Scheduler] Started with {len(scheduler.get_jobs())} jobs.")

    yield

    scheduler.shutdown(wait=False)
    print("[Scheduler] Stopped.")


app = FastAPI(
    title="QuickKart Inventory Management API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no auth required)
app.include_router(auth_router)

# User management (auth enforced inside each endpoint via require_super_admin / require_admin_or_super)
app.include_router(user_router)

# All existing business routes require a valid session
_auth = [Depends(get_current_user)]
app.include_router(inbound.router, dependencies=_auth)
app.include_router(outbound.router, dependencies=_auth)
app.include_router(inventory.router, dependencies=_auth)
app.include_router(alerts.router, dependencies=_auth)
app.include_router(po.router, dependencies=_auth)
app.include_router(config.router, dependencies=_auth)
app.include_router(dashboard.router, dependencies=_auth)
app.include_router(vendors.router, dependencies=_auth)
app.include_router(products.router, dependencies=_auth)


@app.get("/")
def root():
    return {"status": "QuickKart API running", "docs": "/docs"}

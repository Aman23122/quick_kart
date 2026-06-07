import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from sqlalchemy import text
from app.database import engine
from app.models import *  # noqa: F401, F403 — registers all ORM models
from app.database import Base


def _run_migrations():
    """Add new nullable columns to existing tables without dropping data."""
    migrations = [
        "ALTER TABLE procurement ADD COLUMN expected_receive_time VARCHAR(5) NULL",
        "ALTER TABLE procurement MODIFY COLUMN vendor_invoice_number BIGINT NULL",
        "ALTER TABLE procurement ADD COLUMN actual_received_time VARCHAR(5) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN label VARCHAR(100) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN cron_time VARCHAR(5) NULL",
        "ALTER TABLE scheduled_po_template ADD COLUMN expected_receive_time VARCHAR(5) NULL",
        "ALTER TABLE inventory ADD COLUMN batch_no VARCHAR(100) NULL",
        "ALTER TABLE inventory ADD COLUMN dispatch_cutoff DATETIME NULL",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # Column already exists
from app.routers import inbound, outbound, inventory, alerts, po, config, dashboard, vendors, products
from app.services.po_scheduler import scheduler, setup_jobs
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables (new tables like draft_po, system_config)
    Base.metadata.create_all(bind=engine)
    _run_migrations()

    # Start APScheduler
    setup_jobs()

    # Check dispatch cutoff expiry every 15 minutes
    from app.services.shelf_life_checker import check_dispatch_cutoff_alerts
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

app.include_router(inbound.router)
app.include_router(outbound.router)
app.include_router(inventory.router)
app.include_router(alerts.router)
app.include_router(po.router)
app.include_router(config.router)
app.include_router(dashboard.router)
app.include_router(vendors.router)
app.include_router(products.router)


@app.get("/")
def root():
    return {"status": "QuickKart API running", "docs": "/docs"}

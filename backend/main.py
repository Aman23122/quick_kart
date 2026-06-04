import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine
from app.models import *  # noqa: F401, F403 — registers all ORM models
from app.database import Base
from app.routers import inbound, outbound, inventory, alerts, po, config, dashboard, vendors, products
from app.services.po_scheduler import scheduler, setup_jobs
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables (new tables like draft_po, system_config)
    Base.metadata.create_all(bind=engine)

    # Start APScheduler
    setup_jobs()
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

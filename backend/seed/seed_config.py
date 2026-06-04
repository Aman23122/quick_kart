"""Run once: seeds system_config defaults and one fulfillment_center row."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine
from app.models import SystemConfig, FulfillmentCenter
from app.database import Base

Base.metadata.create_all(bind=engine)

CONFIG_DEFAULTS = [
    ("temp_rejection_threshold", "8", "Max °C for chilled/dairy acceptance gate"),
    ("dairy_inbound_window_start", "04:00", "Earliest allowed dairy inbound time (HH:MM)"),
    ("dairy_inbound_window_end", "10:00", "Latest allowed dairy inbound time (HH:MM)"),
    ("fresh_inbound_cutoff", "12:30", "Latest allowed fruits/veg/fresh-cut inbound (HH:MM)"),
    ("milk_max_hours", "24", "Dispatch block: Milk older than N hours"),
    ("paneer_curd_bread_batter_max_days", "2", "Dispatch block: Paneer/Curd/Bread/Batter older than N days"),
    ("butter_max_days", "5", "Dispatch block: Fresh Butter older than N days"),
    ("fruits_veg_wastage_alert_days", "2", "Days in stock before wastage Sale Alert is created"),
    ("low_stock_pct_threshold", "20", "% of max_stock_level that triggers low-stock alert"),
]

FC_ROW = {
    "fulfillment_center_id": "FC-001",
    "name": "QuickKart Central Warehouse",
    "store_code": "QK-CW-01",
    "address": "Plot 12, Industrial Area, Sector 5",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001",
    "country": "India",
    "contact_name": "Warehouse Manager",
    "contact_phone": "9876543210",
    "contact_email": "wh@quickkart.in",
    "capacity": 10000,
    "temperature_controlled": True,
    "is_active": True,
}


def run():
    db = SessionLocal()
    try:
        for key, value, desc in CONFIG_DEFAULTS:
            existing = db.get(SystemConfig, key)
            if not existing:
                db.add(SystemConfig(config_key=key, config_value=value, description=desc))
                print(f"  [+] Seeded config: {key} = {value}")
            else:
                print(f"  [=] Already exists: {key}")

        fc = db.get(FulfillmentCenter, FC_ROW["fulfillment_center_id"])
        if not fc:
            db.add(FulfillmentCenter(**FC_ROW))
            print(f"  [+] Seeded fulfillment center: {FC_ROW['name']}")
        else:
            print(f"  [=] FC already exists: {FC_ROW['fulfillment_center_id']}")

        db.commit()
        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()

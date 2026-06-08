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
    ("dairy_dispatch_window_minutes", "1440", "Minutes after inbound approval within which dairy/fresh batches can be dispatched (1440 = 24h; set small e.g. 10 for demo)"),
    ("dispatch_window_milk_min",          "1440",  "Milk: dispatch window in minutes after inbound approval (1440 = 24h)"),
    ("dispatch_window_paneer_curd_min",   "2880",  "Paneer / Curd / Yoghurt: dispatch window in minutes (2880 = 48h)"),
    ("dispatch_window_bread_batter_min",  "2880",  "Bread / Batter: dispatch window in minutes (2880 = 48h)"),
    ("dispatch_window_butter_min",        "7200",  "Fresh Butter: dispatch window in minutes (7200 = 5 days)"),
    ("dispatch_window_meat_min",          "1440",  "Meat / Poultry / Fish: dispatch window in minutes (1440 = 24h)"),
    ("fruits_veg_wastage_alert_days", "2", "Days in stock before wastage Sale Alert is created"),
    ("low_stock_pct_threshold", "20", "% of max_stock_level that triggers low-stock alert"),
    ("po_dairy_evening_grace_time", "18:20", "Dairy Evening: time scheduler triggers draft PO creation (HH:MM, Asia/Kolkata)"),
    ("po_meat_morning_grace_time",  "11:50", "Meat Morning: time scheduler triggers draft PO creation (HH:MM, Asia/Kolkata)"),
    ("pre_dispatch_alert_milk_min",         "60",  "Milk: alert sales team X minutes before dispatch block (60 = 1h before)"),
    ("pre_dispatch_alert_paneer_min",        "60",  "Paneer / Curd / Yoghurt: alert sales team X minutes before dispatch block"),
    ("pre_dispatch_alert_bread_min",         "45",  "Bread / Batter: alert sales team X minutes before dispatch block"),
    ("pre_dispatch_alert_butter_min",        "60",  "Butter: alert sales team X minutes before dispatch block"),
    ("pre_dispatch_alert_meat_min",          "60",  "Meat / Poultry / Fish: alert sales team X minutes before dispatch block"),
    ("pre_dispatch_alert_default_min",       "60",  "Default: alert sales team X minutes before dispatch block (fallback for all other products)"),
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

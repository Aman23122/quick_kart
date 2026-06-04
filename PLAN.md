# Smart Inventory & Perishable Goods Management System — Architecture Plan

## Decisions Made

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite, Shadcn UI, Tailwind CSS, Zustand (state), Axios, TanStack Query, Lucide React |
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2.0 ORM, Uvicorn, APScheduler |
| Database | MySQL — `inventory_sales_db`, host: localhost:3306, user: root |
| Auth | None (open demo) |
| Email | UI toast/badge notification + `alert_log` DB write |
| Scheduler | APScheduler real clock-based cron + manual demo trigger endpoint |
| FC Scope | Single Fulfillment Center (set via `FULFILLMENT_CENTER_ID` in `.env`) |
| Config | New `system_config` DB table, editable via Settings UI |

---

## New Tables (Beyond Provided Schema)

### `system_config`
Stores all globally editable business rules.
```sql
config_key VARCHAR(100) PK
config_value VARCHAR(255)
description TEXT
updated_at TIMESTAMP
```
Default rows seeded:
| Key | Default |
|---|---|
| temp_rejection_threshold | 8 |
| dairy_inbound_window_start | 04:00 |
| dairy_inbound_window_end | 10:00 |
| fresh_inbound_cutoff | 12:30 |
| milk_max_hours | 24 |
| paneer_curd_bread_batter_max_days | 2 |
| butter_max_days | 5 |
| fruits_veg_wastage_alert_days | 2 |
| low_stock_pct_threshold | 20 |

### `draft_po`
Grace-window PO drafts before scheduler fires.
```sql
draft_id VARCHAR(36) PK
po_type VARCHAR(50)          -- 'dairy' | 'meat' | 'flowers'
slot_label VARCHAR(50)       -- 'morning' | 'evening'
scheduled_fire_at TIMESTAMP  -- when auto-send fires
grace_starts_at TIMESTAMP    -- when draft was created (10 min before)
status VARCHAR(20)           -- 'draft' | 'sent' | 'overridden'
line_items JSON
notes TEXT
created_at TIMESTAMP
```

---

## Directory & File Tree

```
quick_kart/
│
├── PLAN.md                           ← This file
│
├── backend/
│   ├── .env
│   ├── requirements.txt
│   ├── main.py                       # FastAPI app init, router registration, CORS, scheduler start
│   │
│   ├── app/
│   │   ├── config.py                 # pydantic-settings: DB URL, FC_ID, APP_PORT
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, Base, get_db
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── brand.py
│   │   │   ├── category.py
│   │   │   ├── vendor.py
│   │   │   ├── product.py            # Product + ProductVariant
│   │   │   ├── fulfillment_center.py
│   │   │   ├── procurement.py        # Procurement + ProcurementItem
│   │   │   ├── inventory.py          # Inventory + InventoryTransaction
│   │   │   ├── alert.py              # AlertThreshold + AlertLog
│   │   │   ├── order.py              # SalesOrder + OrderLineItem
│   │   │   ├── system_config.py      # NEW
│   │   │   └── draft_po.py           # NEW
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── inbound.py
│   │   │   ├── outbound.py
│   │   │   ├── inventory.py
│   │   │   ├── alert.py
│   │   │   ├── po.py
│   │   │   └── config.py
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── inbound.py            # POST /inbound/upload-csv, GET /inbound/ledger
│   │   │   ├── outbound.py           # POST /outbound/upload-csv, GET /outbound/ledger
│   │   │   ├── inventory.py          # GET /inventory/grid, PATCH /inventory/{id}
│   │   │   ├── alerts.py             # GET /alerts, POST /alerts/{id}/resolve
│   │   │   ├── po.py                 # GET /po/drafts, PATCH /po/draft/{id}, POST /po/trigger
│   │   │   ├── config.py             # GET /config, PUT /config/{key}
│   │   │   └── dashboard.py          # GET /dashboard/summary
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── fefo_engine.py        # Sort inventory by sell_before_date ASC, deduct batches
│   │   │   ├── qc_gate.py            # Time window + temperature gate validation
│   │   │   ├── shelf_life_checker.py # Dispatch block rules + wastage alert triggers
│   │   │   ├── stock_monitor.py      # Min stock breach → alert_log writer
│   │   │   ├── po_scheduler.py       # APScheduler job definitions + draft PO creator
│   │   │   ├── csv_processor.py      # Parse, validate, bulk write inbound/outbound CSVs
│   │   │   └── notification_service.py # In-memory notification queue for UI toasts
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── time_utils.py         # YYYY-MM-DD HH:MM:SS formatter
│   │       └── id_gen.py             # UUID4 wrapper
│   │
│   └── seed/
│       ├── seed_config.py            # Seeds system_config defaults
│       └── seed_fc.py                # Seeds one fulfillment_center row
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── components.json               # Shadcn UI config
│   ├── index.html
│   │
│   ├── public/
│   │   └── sample_csvs/
│   │       ├── inbound_sample.csv
│   │       └── outbound_sample.csv
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                   # React Router v6 routes
│       │
│       ├── lib/
│       │   ├── axios.ts              # Axios instance (base URL from env)
│       │   ├── utils.ts              # cn() + date formatters
│       │   └── constants.ts          # Category slug maps, shelf-life labels
│       │
│       ├── store/
│       │   ├── useNotificationStore.ts
│       │   └── useConfigStore.ts
│       │
│       ├── hooks/
│       │   ├── useInventory.ts
│       │   ├── useAlerts.ts
│       │   ├── usePODrafts.ts
│       │   └── useDashboard.ts
│       │
│       ├── services/
│       │   ├── inboundApi.ts
│       │   ├── outboundApi.ts
│       │   ├── inventoryApi.ts
│       │   ├── alertApi.ts
│       │   ├── poApi.ts
│       │   └── configApi.ts
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── Topbar.tsx
│       │   │
│       │   ├── shared/
│       │   │   ├── DataTable.tsx
│       │   │   ├── DateRangePicker.tsx
│       │   │   ├── CSVUploader.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   └── ExportButton.tsx
│       │   │
│       │   ├── inventory/
│       │   │   ├── InventoryCard.tsx
│       │   │   ├── InventoryFilters.tsx
│       │   │   └── ThresholdEditModal.tsx
│       │   │
│       │   ├── po/
│       │   │   ├── CountdownTimer.tsx
│       │   │   ├── DraftPOCard.tsx
│       │   │   ├── DraftPOModal.tsx
│       │   │   └── SchedulerLog.tsx
│       │   │
│       │   └── notifications/
│       │       └── NotificationPanel.tsx
│       │
│       └── pages/
│           ├── Dashboard.tsx
│           ├── InboundLedger.tsx
│           ├── OutboundLedger.tsx
│           ├── InventoryGrid.tsx
│           ├── POMonitor.tsx
│           ├── AlertLog.tsx
│           └── Settings.tsx
```

---

## Business Logic Reference

### 1. QC Gate (qc_gate.py)
- Read `dairy_inbound_window_start/end` and `fresh_inbound_cutoff` from `system_config`.
- Read `temp_rejection_threshold` from `system_config`.
- If `product_variant.temperature_required > 0` AND `temperature_measured > threshold` → status = `rejected`.
- If category is Dairy AND current time outside window → status = `rejected`.
- If category is Fruits/Veg/Fresh Cuts AND current time > cutoff → status = `rejected`.

### 2. FEFO Engine (fefo_engine.py)
- Query `inventory` WHERE `variant_id = X` AND `qty > 0` ORDER BY `sell_before_date ASC`.
- Loop through batches, deducting qty until order quantity is satisfied.
- Write one `inventory_transaction` row per batch touched.
- Return list of allocations with batch details.

### 3. Shelf-Life Checker (shelf_life_checker.py)
- On outbound dispatch, check `procurement_item.created_at` for the batch.
- Rules (from `system_config`):
  - Milk: `created_at` > 24h ago → BLOCK
  - Paneer / Curd / Bread / Batter: `created_at` > 2 days ago → BLOCK
  - Fresh Butter: `created_at` > 5 days ago → BLOCK
- Wastage alert: Fruits/Veg with `inventory.created_at` > 2 days AND qty > 0 → create `alert_log` entry with `alert_type = 'wastage_risk'`.

### 4. Stock Monitor (stock_monitor.py)
- After every inbound/outbound write, query `alert_threshold` for the variant+FC.
- If `current_qty <= min_stock_level` OR `current_qty <= (max_stock_level * low_stock_pct / 100)` → insert `alert_log` with `alert_type = 'low_stock'`.
- Push to `notification_service` queue.

### 5. PO Scheduler (po_scheduler.py)
APScheduler jobs (6 total):
| Job | Cron Time | Action |
|---|---|---|
| dairy_grace | 18:20 daily | Create draft_po (type=dairy, slot=evening) |
| dairy_fire | 18:30 daily | Set draft status=sent if not overridden |
| meat_grace_morning | 11:50 daily | Create draft_po (type=meat, slot=morning) |
| meat_fire_morning | 12:00 daily | Auto-send meat morning draft |
| flowers_grace_evening | 18:20 daily | Create draft_po (type=flowers, slot=evening) |
| flowers_fire_evening | 18:30 daily | Auto-send flowers evening draft |

Manual trigger: `POST /api/po/trigger?type=dairy&slot=evening` for demo.

---

## Data Flow

### Inbound CSV
```
Upload → csv_processor → qc_gate (per row)
  PASS → write procurement + procurement_item + inventory
  FAIL → row status='rejected', no inventory write
→ stock_monitor (check thresholds) → alert_log if breached
→ notification_service → UI toast
```

### Outbound CSV
```
Upload → csv_processor → shelf_life_checker (dispatch block check)
  BLOCKED → row status='blocked', reason logged
  PASS → fefo_engine (sort by sell_before_date ASC, deduct batches)
→ write sales_order + order_line_item + inventory_transaction
→ stock_monitor → alert_log if threshold breached
→ notification_service → UI toast
```

---

## Timestamp Format
**ALL timestamps must use:** `YYYY-MM-DD HH:MM:SS`  
Enforced in `time_utils.py` via `format_ts()` helper applied at every write point.

---

## DB Credentials (.env)
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=inventory_sales_db
DB_USER=root
DB_PASSWORD=12345678
FULFILLMENT_CENTER_ID=<seeded at init>
APP_PORT=8000
```

---

## Implementation Phases

- [x] Plan documented
- [ ] Phase 1: Backend Foundation (requirements, .env, config, database, all models)
- [ ] Phase 2: Business Logic Services (time_utils, qc_gate, fefo, shelf_life, stock_monitor, notifications)
- [ ] Phase 3: CSV Processing + All Routers + PO Scheduler
- [ ] Phase 4: Frontend Shell (Vite, Tailwind, Shadcn, AppShell, shared components)
- [ ] Phase 5: All Feature Pages (Dashboard, Inbound, Outbound, Inventory, PO, Alerts, Settings)
- [ ] Phase 6: Sample CSVs + seed scripts + final polish

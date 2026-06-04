# QuickKart — Smart Inventory & Perishable Goods Management System

## Quick Start

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Seed the database (run once)
python seed/seed_config.py

# Start the API server
uvicorn main:app --reload --port 8000
```
API docs available at: http://localhost:8000/docs

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend available at: http://localhost:5173

---

## DB Credentials
Stored in `backend/.env` — edit before starting if your MySQL credentials differ.

---

## Demo Flow (Client Presentation)

1. **Open** http://localhost:5173 — Dashboard shows live KPIs
2. **Inbound Ledger** → Drag-drop `public/sample_csvs/inbound_sample.csv`  
   - Watch QC gate accept/reject rows based on temperature and time windows
3. **Inventory Grid** → Color-coded cards appear (green/orange/red)  
   - Click gear icon on any card to edit stock thresholds inline
4. **Outbound Ledger** → Drag-drop `public/sample_csvs/outbound_sample.csv`  
   - FEFO engine deducts from oldest batches first
   - Dispatch-blocked items show "blocked" status with reason
5. **PO Monitor** → Click "Trigger Demo PO" to open a grace-window draft  
   - 10-minute countdown visible; click "Edit Quantities" to modify before auto-send
6. **Alert Log** → View all low-stock, wastage-risk, and dispatch-blocked alerts
7. **Settings** → Live-edit temperature thresholds, shelf-life rules, time windows

---

## Architecture Summary

| Component | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Shadcn UI (Radix) |
| Backend | FastAPI + SQLAlchemy 2.0 + Uvicorn |
| Database | MySQL (`inventory_sales_db`) |
| Scheduler | APScheduler (background cron jobs) |
| State | Zustand + TanStack Query |

See `PLAN.md` for full architecture documentation.

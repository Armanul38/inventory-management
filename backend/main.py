from contextlib import asynccontextmanager
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the root directory is in the path for proper module resolution
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import init_db
from backend.routers.auth import router as auth_router
from backend.routers.inventory import router as inventory_router
from backend.routers.production import router as production_router
from backend.routers.finished_goods import router as finished_goods_router
from backend.routers.audit import router as audit_router
from backend.routers.suppliers import router as suppliers_router
from backend.routers.customers import router as customers_router
from backend.routers.sales import router as sales_router
from backend.routers.accounts import router as accounts_router
from backend.routers.reports import router as reports_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed default data
    init_db()
    yield

app = FastAPI(
    title="Inventory & Production Management API",
    description=(
        "Backend API for tracking Company Inventory, Work-In-Progress, Finished Goods, "
        "Suppliers, Customers, Sales, and Accounts Ledger."
    ),
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing routers ──────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(production_router, prefix="/api/v1")
app.include_router(finished_goods_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")

# ── New routers ───────────────────────────────────────────────────────────────
app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Inventory & Production Management System API v2.0 is running.",
        "docs": "/docs",
    }
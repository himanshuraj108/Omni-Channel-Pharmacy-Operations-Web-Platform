"""
Inventory Service - Main Application
Handles: Products, Batches, Stock Ledger, Low Stock Alerts
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routes import products_router, batches_router, stock_router, transfers_router
from app.database import init_db
from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Inventory Service...")
    await init_db()
    yield
    logger.info("Inventory Service shutting down...")


app = FastAPI(
    title="Pharmacy Inventory Service",
    description="Product Catalog, Batch Management & Stock Tracking",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products_router, prefix="/api/v1/products", tags=["Products"])
app.include_router(batches_router, prefix="/api/v1/batches", tags=["Batches"])
app.include_router(stock_router, prefix="/api/v1/stock", tags=["Stock"])
app.include_router(transfers_router, prefix="/api/v1/transfers", tags=["Transfers"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "inventory-service"}

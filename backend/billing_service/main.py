"""
Billing Service - Main Application
Handles: Prescriptions, Sales Orders, POS, GST-compliant invoicing
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routes import prescriptions_router, orders_router
from app.database import init_db
from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Pharmacy Billing Service",
    description="Prescription Management, POS Billing & GST-compliant Invoicing",
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

app.include_router(prescriptions_router, prefix="/api/v1/prescriptions", tags=["Prescriptions"])
app.include_router(orders_router, prefix="/api/v1/orders", tags=["Sales Orders"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "billing-service"}

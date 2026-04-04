"""
AI/ML Service - Main Application
Capabilities: Demand Forecasting, Anomaly Detection, Conversational Query (Text-to-SQL)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routes import forecast_router, anomaly_router, query_router, expiry_router
from app.config import settings
from app.database import get_pools, close_pool

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI/ML Service...")
    # Warm up DB pools on startup
    await get_pools()
    yield
    logger.info("AI/ML Service shutting down...")
    await close_pool()


app = FastAPI(
    title="Pharmacy AI/ML Service",
    description="Demand Forecasting, Anomaly Detection & Conversational BI",
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

app.include_router(forecast_router, prefix="/api/v1/ai/forecast", tags=["Demand Forecast"])
app.include_router(anomaly_router, prefix="/api/v1/ai/anomaly", tags=["Anomaly Detection"])
app.include_router(query_router, prefix="/api/v1/ai/query", tags=["Conversational Query"])
app.include_router(expiry_router, prefix="/api/v1/ai/expiry", tags=["Expiry Risk"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-service"}

"""
AI Service - FastAPI Route Handlers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.forecasting import DemandForecaster
from app.anomaly import BillingAnomalyDetector, StockAnomalyDetector
from app.query_engine import ConversationalQueryEngine

forecast_router = APIRouter()
anomaly_router = APIRouter()
query_router = APIRouter()
expiry_router = APIRouter()

# Shared instances (in production: use DI container)
billing_detector = BillingAnomalyDetector()
stock_detector = StockAnomalyDetector()


# ─── Demand Forecast ──────────────────────────────────────────────────────────

@forecast_router.get("/branches/{branch_id}/products/{product_id}")
async def get_forecast(branch_id: int, product_id: str, current_stock: int = Query(0)):
    forecaster = DemandForecaster(db_conn=None)
    result = await forecaster.forecast(
        product_id=product_id,
        branch_id=branch_id,
        product_name="Product",
        current_stock=current_stock,
    )
    return {
        "product_id": result.product_id,
        "branch_id": result.branch_id,
        "forecast": [
            {
                "date": f.date, "predicted_demand": f.predicted_demand,
                "lower_bound": f.lower_bound, "upper_bound": f.upper_bound,
                "confidence": f.confidence,
            }
            for f in result.forecast
        ],
        "recommendation": result.recommendation,
        "reorder_date": result.reorder_date,
        "suggested_quantity": result.suggested_quantity,
        "model_accuracy": result.model_accuracy,
        "generated_at": result.generated_at,
    }


@forecast_router.get("/branches/{branch_id}/summary")
async def get_branch_forecast_summary(branch_id: int):
    """Top 10 products needing reorder for a branch"""
    # In production: iterate top-selling products and run forecasts
    return {
        "branch_id": branch_id,
        "reorder_needed": [],
        "generated_at": "2024-01-01T00:00:00Z",
    }


# ─── Anomaly Detection ────────────────────────────────────────────────────────

class TransactionPayload(BaseModel):
    order_id: str
    branch_id: int
    grand_total: float
    discount_amount: float = 0
    subtotal: float
    items: List[dict] = []
    has_schedule_h: bool = False
    has_schedule_x: bool = False
    is_return: bool = False
    created_at: str
    payment_mode: str = "CASH"


@anomaly_router.post("/transactions/score")
async def score_transaction(payload: TransactionPayload):
    """Score a single transaction for anomalies (called post-sale)"""
    anomaly = billing_detector.detect(payload.model_dump(), payload.branch_id)
    if anomaly:
        return {
            "is_anomaly": True,
            "anomaly_score": anomaly.anomaly_score,
            "severity": anomaly.severity,
            "description": anomaly.description,
            "explanation": anomaly.shap_explanation,
            "recommended_action": anomaly.recommended_action,
        }
    return {"is_anomaly": False, "anomaly_score": 0.0}


@anomaly_router.get("/branches/{branch_id}/recent")
async def get_recent_anomalies(branch_id: int, days: int = Query(7, le=90)):
    """Retrieve recent detected anomalies for a branch"""
    # In production: query anomaly_log table
    return {"branch_id": branch_id, "anomalies": [], "period_days": days}


# ─── Conversational Query ─────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    branch_id: Optional[int] = None


@query_router.post("")
async def conversational_query(body: QueryRequest):
    """Process a natural language business question"""
    engine = ConversationalQueryEngine(db_conn=None, openai_client=None)
    result = await engine.query(
        question=body.question,
        user_id="demo_user",
        branch_id=body.branch_id,
    )
    return {
        "question": result.question,
        "answer": result.answer,
        "data": result.data[:100],  # Cap response payload
        "chart_type": result.chart_type,
        "row_count": result.row_count,
        "execution_time_ms": round(result.execution_time_ms, 2),
        "disclaimer": result.disclaimer,
        "query_id": result.query_id,
    }


# ─── Expiry Risk ──────────────────────────────────────────────────────────────

@expiry_router.get("/branches/{branch_id}")
async def get_expiry_risk(branch_id: int, risk_level: str = Query("ALL")):
    """Get expiry risk summary for a branch"""
    # In production: query batches table grouped by risk category
    return {
        "branch_id": branch_id,
        "summary": {
            "CRITICAL": {"count": 0, "value": 0},
            "WARNING": {"count": 0, "value": 0},
            "WATCH": {"count": 0, "value": 0},
            "SAFE": {"count": 0, "value": 0},
        },
        "items": [],
        "generated_at": "2024-01-01T00:00:00Z",
    }

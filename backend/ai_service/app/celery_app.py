"""
Celery Application - Background Task Worker
Handles: Demand forecast batch jobs, anomaly detection sweeps, email notifications
"""
from celery import Celery
from celery.utils.log import get_task_logger
import os

logger = get_task_logger(__name__)

# ─── Celery App Initialization ────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/4")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

celery_app = Celery(
    "pharma_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.celery_app"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.celery_app.run_demand_forecast": {"queue": "forecast"},
        "app.celery_app.run_anomaly_sweep": {"queue": "anomaly"},
        "app.celery_app.send_notification_email": {"queue": "notifications"},
    },
)


# ─── Background Tasks ─────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="app.celery_app.run_demand_forecast", max_retries=3)
def run_demand_forecast(self, branch_id: int, product_id: str):
    """Run demand forecast for a product at a branch"""
    try:
        logger.info(f"Running demand forecast: branch={branch_id}, product={product_id}")
        # In production: instantiate DemandForecaster and run
        # forecaster = DemandForecaster(db_conn=None)
        # result = asyncio.run(forecaster.forecast(product_id, branch_id, ...))
        return {"status": "completed", "branch_id": branch_id, "product_id": product_id}
    except Exception as exc:
        logger.error(f"Forecast task failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, name="app.celery_app.run_anomaly_sweep", max_retries=2)
def run_anomaly_sweep(self, branch_id: int):
    """Sweep recent transactions at a branch for anomalies"""
    try:
        logger.info(f"Running anomaly sweep: branch={branch_id}")
        # In production: fetch recent orders and score each one
        return {"status": "completed", "branch_id": branch_id, "anomalies_found": 0}
    except Exception as exc:
        logger.error(f"Anomaly sweep failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="app.celery_app.send_notification_email", max_retries=3)
def send_notification_email(self, recipient: str, subject: str, body: str):
    """Send an email notification (low stock alert, expiry warning, etc.)"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")

        if not smtp_user or not smtp_password:
            logger.warning("SMTP credentials not configured — skipping email")
            return {"status": "skipped", "reason": "no_credentials"}

        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = recipient

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [recipient], msg.as_string())

        logger.info(f"Email sent to {recipient}: {subject}")
        return {"status": "sent", "recipient": recipient}
    except Exception as exc:
        logger.error(f"Email send failed: {exc}")
        raise self.retry(exc=exc, countdown=120)


# ─── Periodic Tasks (Beat Schedule) ──────────────────────────────────────────
celery_app.conf.beat_schedule = {
    "daily-expiry-sweep": {
        "task": "app.celery_app.run_anomaly_sweep",
        "schedule": 86400.0,  # Every 24 hours
        "args": (1,),  # Head office branch
    },
}

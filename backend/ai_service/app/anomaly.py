"""
AI Service - Anomaly Detection Engine
Detects billing fraud, unusual stock movements, and suspicious patterns
"""
from __future__ import annotations
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Anomaly:
    entity_type: str          # TRANSACTION, STOCK_MOVEMENT, USER_BEHAVIOR
    entity_id: str
    branch_id: int
    anomaly_score: float      # 0-1 (1 = most anomalous)
    severity: str             # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    shap_explanation: Dict[str, float]   # Feature contributions
    detected_at: str
    recommended_action: str


class BillingAnomalyDetector:
    """
    Isolation Forest on transaction features:
    - Quantity per transaction
    - Discount percentage
    - Time of day
    - Number of Schedule H/X drugs in one transaction
    - Return frequency per user
    - Transaction frequency (volume per hour)
    """

    SEVERITY_THRESHOLDS = {"CRITICAL": 0.85, "HIGH": 0.7, "MEDIUM": 0.5, "LOW": 0.3}

    def __init__(self):
        self._model = None
        self._scaler = None
        self._trained = False

    def _get_severity(self, score: float) -> str:
        for sev, threshold in self.SEVERITY_THRESHOLDS.items():
            if score >= threshold:
                return sev
        return "LOW"

    def _extract_features(self, transaction: Dict) -> np.ndarray:
        """Extract numeric features from a billing transaction"""
        hour = datetime.fromisoformat(transaction.get("created_at", datetime.utcnow().isoformat())).hour
        return np.array([
            float(transaction.get("grand_total", 0)),
            float(transaction.get("discount_amount", 0)),
            float(transaction.get("discount_amount", 0)) / max(float(transaction.get("subtotal", 1)), 1) * 100,
            len(transaction.get("items", [])),
            sum(i.get("quantity", 0) for i in transaction.get("items", [])),
            1.0 if transaction.get("has_schedule_h") else 0.0,
            1.0 if transaction.get("has_schedule_x") else 0.0,
            1.0 if transaction.get("is_return") else 0.0,
            float(hour),
            1.0 if hour < 7 or hour > 22 else 0.0,   # Off-hours flag
        ])

    def train(self, historical_transactions: List[Dict]):
        """Train Isolation Forest on historical billing data"""
        try:
            from sklearn.ensemble import IsolationForest  # type: ignore
            from sklearn.preprocessing import StandardScaler  # type: ignore

            if len(historical_transactions) < 100:
                logger.warning("Insufficient data for anomaly model training")
                return

            X = np.array([self._extract_features(t) for t in historical_transactions])
            self._scaler = StandardScaler()
            X_scaled = self._scaler.fit_transform(X)
            self._model = IsolationForest(
                contamination=0.02,   # Assume 2% anomaly rate
                n_estimators=200,
                random_state=42,
                n_jobs=-1,
            )
            self._model.fit(X_scaled)
            self._trained = True
            logger.info(f"Anomaly model trained on {len(X)} transactions")
        except ImportError:
            logger.error("scikit-learn not installed")

    def detect(self, transaction: Dict, branch_id: int) -> Optional[Anomaly]:
        """Score a single transaction for anomalies"""
        features = self._extract_features(transaction)

        if self._trained and self._model and self._scaler:
            X_scaled = self._scaler.transform([features])
            score_raw = self._model.decision_function(X_scaled)[0]
            # Convert to 0-1 anomaly score (higher = more anomalous)
            anomaly_score = float(1 / (1 + np.exp(score_raw * 3)))
        else:
            # Fallback: rule-based scoring
            anomaly_score = self._rule_based_score(transaction)

        if anomaly_score < 0.3:
            return None  # Normal

        severity = self._get_severity(anomaly_score)
        description, shap, action = self._build_explanation(transaction, features, anomaly_score)

        return Anomaly(
            entity_type="TRANSACTION",
            entity_id=transaction.get("order_id", ""),
            branch_id=branch_id,
            anomaly_score=round(anomaly_score, 3),
            severity=severity,
            description=description,
            shap_explanation=shap,
            detected_at=datetime.utcnow().isoformat(),
            recommended_action=action,
        )

    def _rule_based_score(self, t: Dict) -> float:
        score = 0.0
        if float(t.get("discount_amount", 0)) / max(float(t.get("subtotal", 1)), 1) > 0.3:
            score += 0.4
        if t.get("has_schedule_x"):
            score += 0.3
        hour = datetime.fromisoformat(t.get("created_at", datetime.utcnow().isoformat())).hour
        if hour < 7 or hour > 22:
            score += 0.3
        if t.get("is_return"):
            score += 0.2
        return min(score, 1.0)

    def _build_explanation(self, t, features, score) -> tuple:
        reasons = []
        shap = {}
        hour = datetime.fromisoformat(t.get("created_at", datetime.utcnow().isoformat())).hour

        disc_pct = float(features[2])
        if disc_pct > 25:
            reasons.append(f"High discount {disc_pct:.1f}%")
            shap["discount_pct"] = 0.35
        if features[6] > 0:
            reasons.append("Schedule X (narcotic) drug in transaction")
            shap["schedule_x"] = 0.40
        if features[9] > 0:
            reasons.append(f"Off-hours transaction at {hour:02d}:00")
            shap["off_hours"] = 0.25
        if float(features[4]) > 100:
            reasons.append(f"Unusually large quantity ({int(features[4])} units)")
            shap["total_quantity"] = 0.30

        description = "; ".join(reasons) or "Statistical outlier pattern detected"
        action = "Review transaction with Branch Manager" if score < 0.7 else "Escalate to Head Office compliance team"
        return description, shap, action


class StockAnomalyDetector:
    """
    CUSUM (Cumulative Sum) control chart for stock movement anomalies
    Detects: unexplained shrinkage, sudden drops, unusual consumption patterns
    """

    def __init__(self, threshold_sigma: float = 3.0):
        self.threshold_sigma = threshold_sigma

    def detect_stock_anomaly(
        self, stock_history: List[Dict], product_id: str, branch_id: int
    ) -> Optional[Anomaly]:
        """Detect anomalous stock movements using CUSUM"""
        if len(stock_history) < 14:
            return None

        quantities = [h["quantity_after"] for h in stock_history]
        changes = np.diff(quantities)

        mu = np.mean(changes)
        sigma = np.std(changes)

        if sigma < 0.1:
            return None  # No variation

        # CUSUM
        k = 0.5 * sigma
        h = self.threshold_sigma * sigma
        cusum_pos = cusum_neg = 0.0
        for c in changes:
            cusum_pos = max(0, cusum_pos + c - mu - k)
            cusum_neg = min(0, cusum_neg + c - mu + k)

        if max(cusum_pos, abs(cusum_neg)) > h:
            drift = cusum_neg if abs(cusum_neg) > cusum_pos else cusum_pos
            score = min(1.0, max(cusum_pos, abs(cusum_neg)) / (h * 2))
            return Anomaly(
                entity_type="STOCK_MOVEMENT",
                entity_id=product_id,
                branch_id=branch_id,
                anomaly_score=round(score, 3),
                severity=self._severity(score),
                description=f"Abnormal stock {'decrease' if drift < 0 else 'increase'} detected (CUSUM={drift:.1f})",
                shap_explanation={"cusum_neg": float(cusum_neg), "cusum_pos": float(cusum_pos), "sigma": float(sigma)},
                detected_at=datetime.utcnow().isoformat(),
                recommended_action="Conduct physical stock count for this product",
            )
        return None

    def _severity(self, score: float) -> str:
        if score >= 0.8: return "CRITICAL"
        if score >= 0.6: return "HIGH"
        if score >= 0.4: return "MEDIUM"
        return "LOW"

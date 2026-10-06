import numpy as np
import pandas as pd
import joblib
from pathlib import Path
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "app" / "ml"
STATIC_DIR = BASE_DIR / "app" / "static"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "model.pkl"
CONF_MATRIX_PATH = STATIC_DIR / "confusion_matrix.png"

rng = np.random.default_rng(42)
rows = []

feature_names = [
    "temperature",
    "vibration",
    "motor_current",
    "torque",
    "rpm",
    "workload",
    "operating_hours",
    "temperature_trend",
    "vibration_trend",
    "current_trend",
    "torque_trend",
    "rpm_variation",
    "machine_type",
    "cooling_efficiency",
]

for i in range(12000):
    machine_type = int(rng.integers(0, 2))
    mode_weight = float(rng.choice([0.0, 0.35, 0.7, 1.0], p=[0.45, 0.3, 0.2, 0.05]))
    workload = float(rng.uniform(25.0, 95.0) + mode_weight * 15.0)
    operating_hours = float(rng.uniform(100.0, 1800.0) + mode_weight * 400.0)
    cooling_efficiency = float(rng.uniform(0.5, 0.96) - mode_weight * 0.22)
    if machine_type == 0:
        temperature = 55.0 + 0.22 * workload + 0.015 * operating_hours + 18.0 * mode_weight + (1.0 - cooling_efficiency) * 25.0 + rng.normal(0.0, 2.5)
        vibration = 0.6 + 0.010 * operating_hours + 0.06 * workload + 2.0 * mode_weight + (1.0 - cooling_efficiency) * 3.0 + rng.normal(0.0, 0.7)
        motor_current = 4.5 + 0.04 * workload + 0.22 * (temperature / 15.0) + 2.5 * mode_weight + rng.normal(0.0, 0.8)
        torque = 2.5 + 0.03 * workload + 0.18 * motor_current + 2.2 * mode_weight + rng.normal(0.0, 0.6)
        rpm = 3000.0 + (100.0 - workload) * 18.0 - 650.0 * mode_weight + rng.normal(0.0, 230.0)
    else:
        temperature = 180.0 + 0.18 * workload + 0.018 * operating_hours + 26.0 * mode_weight + (1.0 - cooling_efficiency) * 30.0 + rng.normal(0.0, 3.0)
        vibration = 0.4 + 0.008 * operating_hours + 0.09 * workload + 2.1 * mode_weight + (1.0 - cooling_efficiency) * 2.7 + rng.normal(0.0, 0.8)
        motor_current = 1.8 + 0.022 * workload + 0.20 * (temperature / 20.0) + 2.0 * mode_weight + rng.normal(0.0, 0.7)
        torque = 1.4 + 0.03 * workload + 0.3 * motor_current + 2.5 * mode_weight + rng.normal(0.0, 0.5)
        rpm = 45.0 + workload * 0.6 + (100.0 - workload) * 0.18 - 8.0 * mode_weight + rng.normal(0.0, 12.0)

    temperature_trend = rng.uniform(-2.5, 4.0) + 5.0 * mode_weight
    vibration_trend = rng.uniform(-0.3, 1.8) + 1.5 * mode_weight
    current_trend = rng.uniform(-0.5, 1.3) + 1.2 * mode_weight
    torque_trend = rng.uniform(-0.4, 1.4) + 1.5 * mode_weight
    rpm_variation = abs(rng.normal(0.0, 160.0)) + 180.0 * mode_weight

    risk_score = (
        (temperature / 110.0) * 45.0
        + (vibration / 8.0) * 30.0
        + (motor_current / 15.0) * 15.0
        + (torque / 12.0) * 10.0
        + (workload / 100.0) * 8.0
        + (operating_hours / 2000.0) * 10.0
        + (1.0 - cooling_efficiency) * 30.0
        + mode_weight * 20.0
    )
    failure = int(risk_score > 75.0 or mode_weight >= 0.85)

    rows.append({
        "temperature": float(np.clip(temperature, 0.0, 300.0)),
        "vibration": float(np.clip(vibration, 0.0, 12.0)),
        "motor_current": float(np.clip(motor_current, 0.0, 20.0)),
        "torque": float(np.clip(torque, 0.0, 15.0)),
        "rpm": float(np.clip(rpm, 0.0, 8000.0)),
        "workload": float(np.clip(workload, 0.0, 100.0)),
        "operating_hours": float(np.clip(operating_hours, 0.0, 3000.0)),
        "temperature_trend": float(temperature_trend),
        "vibration_trend": float(vibration_trend),
        "current_trend": float(current_trend),
        "torque_trend": float(torque_trend),
        "rpm_variation": float(rpm_variation),
        "machine_type": float(machine_type),
        "cooling_efficiency": float(np.clip(cooling_efficiency, 0.0, 1.0)),
        "failure": failure,
    })

df = pd.DataFrame(rows)
X = df[feature_names]
y = df["failure"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    random_state=42,
    class_weight="balanced",
)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

cm = confusion_matrix(y_test, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["No Failure", "Failure"])
disp.plot(cmap="Blues")
plt.title("Confusion Matrix")
plt.tight_layout()
plt.savefig(CONF_MATRIX_PATH)
plt.close()

metrics = {
    "accuracy": accuracy_score(y_test, y_pred),
    "precision": precision_score(y_test, y_pred, zero_division=0),
    "recall": recall_score(y_test, y_pred, zero_division=0),
    "f1_score": f1_score(y_test, y_pred, zero_division=0),
    "roc_auc": roc_auc_score(y_test, y_prob),
    "feature_names": feature_names,
    "feature_importance": dict(zip(feature_names, map(float, model.feature_importances_))),
    "confusion_matrix_image": "/static/confusion_matrix.png",
}

joblib.dump({"model": model, "metrics": metrics, "feature_names": feature_names}, MODEL_PATH)
print(f"Saved model to: {MODEL_PATH}")
print(f"Saved confusion matrix to: {CONF_MATRIX_PATH}")
print(metrics)
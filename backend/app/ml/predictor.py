import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
metrics = bundle["metrics"]
feature_names = bundle["feature_names"]


def _normalize_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _normalize_machine_type(value):
    raw = str(value).lower()
    if "cnc" in raw:
        return 0
    if "printer" in raw or "3d" in raw:
        return 1
    return 0


def _normalize_feature_row(input_data: dict) -> dict:
    if not input_data:
        return {name: 0.0 for name in feature_names}

    machine_type_value = input_data.get("machine_type", input_data.get("Machine Type", "CNC"))
    temperature = _normalize_float(
        input_data.get("temperature", input_data.get("temperature_C", input_data.get("Temperature", 60.0))),
        60.0,
    )
    if "spindle_temperature" in input_data and temperature == 60.0:
        temperature = _normalize_float(input_data.get("spindle_temperature"), 60.0)
    if "nozzle_temperature" in input_data and temperature == 60.0:
        temperature = _normalize_float(input_data.get("nozzle_temperature"), 60.0)

    vibration = _normalize_float(
        input_data.get("vibration", input_data.get("Vibration", 1.2)),
        1.2,
    )
    motor_current = _normalize_float(
        input_data.get("motor_current", input_data.get("Motor Current", input_data.get("extruder_motor_current", 5.0))),
        5.0,
    )
    torque = _normalize_float(
        input_data.get("torque", input_data.get("Torque", input_data.get("extruder_torque", 4.0))),
        4.0,
    )
    rpm = _normalize_float(input_data.get("rpm", input_data.get("RPM", 3300.0)), 3300.0)
    workload = _normalize_float(input_data.get("workload", input_data.get("Workload", 55.0)), 55.0)
    operating_hours = _normalize_float(input_data.get("operating_hours", input_data.get("Operating Hours", 500.0)), 500.0)

    row = {
        "temperature": temperature,
        "vibration": vibration,
        "motor_current": motor_current,
        "torque": torque,
        "rpm": rpm,
        "workload": workload,
        "operating_hours": operating_hours,
        "temperature_trend": _normalize_float(input_data.get("temperature_trend", 0.0), 0.0),
        "vibration_trend": _normalize_float(input_data.get("vibration_trend", 0.0), 0.0),
        "current_trend": _normalize_float(input_data.get("current_trend", 0.0), 0.0),
        "torque_trend": _normalize_float(input_data.get("torque_trend", 0.0), 0.0),
        "rpm_variation": _normalize_float(input_data.get("rpm_variation", 0.0), 0.0),
        "machine_type": _normalize_machine_type(machine_type_value),
        "cooling_efficiency": _normalize_float(input_data.get("cooling_efficiency", 0.8), 0.8),
    }

    for name in feature_names:
        if name not in row:
            row[name] = 0.0
    return {key: row.get(key, 0.0) for key in feature_names}


def calculate_risk_score(probability: float) -> float:
    return round(probability * 100, 2)


def get_health_status(risk_score: float) -> str:
    if risk_score <= 30:
        return "NORMAL"
    if risk_score <= 70:
        return "WARNING"
    return "CRITICAL"


def get_recommendation(data: dict) -> str:
    machine_type = str(data.get("machine_type", data.get("Machine Type", "CNC"))).lower()
    temperature = _normalize_float(data.get("temperature", data.get("Temperature", 60.0)), 60.0)
    vibration = _normalize_float(data.get("vibration", data.get("Vibration", 1.0)), 1.0)
    motor_current = _normalize_float(data.get("motor_current", data.get("Motor Current", data.get("extruder_motor_current", 5.0))), 5.0)
    torque = _normalize_float(data.get("torque", data.get("Torque", data.get("extruder_torque", 4.0))), 4.0)

    if "printer" in machine_type or "3d" in machine_type:
        if temperature > 235 or torque > 5.0:
            return "Check filament feed path, nozzle blockage, and extruder gear assembly."
        if vibration > 2.5:
            return "Inspect print-head alignment and extruder mechanical stability."
        return "Continue standard print monitoring and filament maintenance cycle."

    if temperature > 80 or motor_current > 10:
        return "Inspect cooling system, spindle load, and motor condition."
    if vibration > 4.0:
        return "Inspect spindle bearings, tool holder, and alignment."
    if torque > 8.0:
        return "Review cutting conditions and tool wear before the next run."
    return "No immediate action required. Continue monitoring."


def predict_single(input_data: dict):
    row = _normalize_feature_row(input_data)
    df = pd.DataFrame([row])[feature_names]

    prediction = int(model.predict(df)[0])
    probability = float(model.predict_proba(df)[0][1])
    risk_score = calculate_risk_score(probability)
    status = get_health_status(risk_score)
    recommendation = get_recommendation(input_data)

    return {
        "failure_prediction": prediction,
        "failure_probability": round(probability, 4),
        "risk_score": risk_score,
        "health_status": status,
        "recommendation": recommendation,
    }


def predict_batch(df: pd.DataFrame):
    records = []
    for _, row in df.iterrows():
        payload = row.to_dict()
        records.append(_normalize_feature_row(payload))

    model_df = pd.DataFrame(records)[feature_names]
    preds = model.predict(model_df)
    probs = model.predict_proba(model_df)[:, 1]

    results = []
    for i, row in enumerate(model_df.to_dict("records")):
        risk_score = calculate_risk_score(float(probs[i]))
        results.append({
            "row_id": i,
            "failure_prediction": int(preds[i]),
            "failure_probability": round(float(probs[i]), 4),
            "risk_score": risk_score,
            "health_status": get_health_status(risk_score),
            "recommendation": get_recommendation(row),
        })

    return results
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd

from app.ml.predictor import metrics, predict_batch, predict_single
from app.schemas import SensorDataInput
from app.simulator import (
    add_machine,
    add_maintenance_record,
    apply_simulation,
    dashboard_summary,
    get_alerts_for_machine,
    get_all_alerts,
    get_machine,
    get_machine_readings,
    get_maintenance_for_machine,
    list_machines,
    list_maintenance_records,
    save_alert,
)
from app.notifications import (
    dispatch_alert_notifications,
    get_notification_logs,
    get_notification_settings,
    save_notification_settings,
)

app = FastAPI(title="Intelligent Predictive Maintenance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def root():
    return {"message": "Predictive Maintenance API is running"}


@app.get("/machines")
def machines():
    return list_machines()


@app.post("/machines")
def create_machine(payload: Dict[str, Any]):
    try:
        machine = add_machine(payload)
        return {"success": True, "machine": machine}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/machines/{machine_id}")
def machine_detail(machine_id: str):
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found.")
    return machine


@app.get("/machines/{machine_id}/readings")
def machine_readings(machine_id: str):
    return get_machine_readings(machine_id)


@app.get("/machines/{machine_id}/prediction")
def machine_prediction(machine_id: str):
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found.")
    values = machine.get("current_values", {})
    result = predict_single(values)
    return result


@app.get("/machines/{machine_id}/health")
def machine_health(machine_id: str):
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found.")
    stats = machine.get("current_values", {})
    return {
        "machine_id": machine_id,
        "health_score": stats.get("health_score", 100.0),
        "failure_risk": stats.get("failure_risk", 0.0),
        "status": stats.get("status", "NORMAL"),
        "condition": stats.get("condition", "NORMAL"),
    }


@app.get("/machines/{machine_id}/alerts")
def machine_alerts(machine_id: str):
    return get_alerts_for_machine(machine_id)


@app.get("/machines/{machine_id}/maintenance")
def machine_maintenance(machine_id: str):
    return get_maintenance_for_machine(machine_id)


@app.get("/dashboard/summary")
def dashboard_summary_endpoint():
    return dashboard_summary()


@app.get("/alerts")
def all_alerts():
    return get_all_alerts()


@app.get("/maintenance-records")
def maintenance_records():
    return list_maintenance_records()


@app.get("/metrics")
def get_metrics():
    return metrics


@app.post("/predict")
def predict(data: Dict[str, Any]):
    try:
        return predict_single(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/simulate")
def simulate(payload: Dict[str, Any]):
    machine_id = payload.get("machine_id") or "CNC-001"
    machine_type = payload.get("machine_type") or ("CNC" if "CNC" in machine_id.upper() else "3D Printer")
    mode = payload.get("mode", "NORMAL").upper()
    overrides = payload.get("overrides") or {}
    result = apply_simulation(machine_id, machine_type, mode, overrides)
    return result


@app.post("/maintenance")
def maintenance(payload: Dict[str, Any]):
    machine_id = payload.get("machine_id")
    machine = get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found.")
    record = add_maintenance_record(machine_id, machine.get("machine_type", "CNC"), payload)
    return {"success": True, "record": record}


@app.post("/alerts")
def create_alert(payload: Dict[str, Any]):
    machine_id = payload.get("machine_id") or "CNC-001"
    machine_type = payload.get("machine_type") or "CNC"
    alert = save_alert(
        machine_id,
        machine_type,
        payload.get("level", "WARNING"),
        payload.get("message", "Machine condition requires review."),
        payload.get("reason", "Machine operating parameters are outside normal tolerance."),
        payload.get("recommendation", "Inspect the machine and confirm maintenance status."),
        risk_percentage=float(payload.get("risk_percentage", 0.0)),
        condition=str(payload.get("condition", payload.get("level", "NORMAL"))),
        main_factors=str(payload.get("main_factors", "")),
    )
    return {"success": True, "alert": alert}


@app.get("/notifications/settings")
def notification_settings_endpoint():
    return get_notification_settings()


@app.post("/notifications/settings")
def update_notification_settings_endpoint(payload: Dict[str, Any]):
    return save_notification_settings(payload)


@app.get("/notifications/logs")
def notification_logs_endpoint(limit: int = 50):
    return get_notification_logs(limit=limit)


@app.post("/notifications/test")
def test_notification_endpoint(payload: Optional[Dict[str, Any]] = None):
    from datetime import datetime
    p = payload or {}
    sample_alert = {
        "id": 99999,
        "machine_id": p.get("machine_id", "CNC-001"),
        "machine_type": p.get("machine_type", "CNC Milling Machine"),
        "level": p.get("level", "CRITICAL"),
        "condition": p.get("condition", "CRITICAL"),
        "risk_percentage": float(p.get("risk_percentage", 87.0)),
        "reason": p.get("reason", "High vibration and temperature"),
        "recommendation": p.get("recommendation", "Inspect spindle/bearing assembly immediately."),
        "created_at": datetime.utcnow().isoformat(timespec="seconds"),
        "timestamp": datetime.utcnow().isoformat(timespec="seconds"),
    }
    results = dispatch_alert_notifications(sample_alert, is_test=True)
    return {"success": True, "results": results, "alert": sample_alert}



@app.post("/predict-batch")
async def predict_batch_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    try:
        df = pd.read_csv(file.file)
        df.columns = df.columns.astype(str).str.strip()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(exc)}")

    required = [
        "machine_id",
        "machine_type",
        "temperature",
        "vibration",
        "motor_current",
        "torque",
        "rpm",
        "workload",
        "operating_hours",
        "cooling_efficiency",
    ]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")
    if df.empty:
        raise HTTPException(status_code=400, detail="The CSV contains no sensor readings.")

    numeric_columns = [
        "temperature", "vibration", "motor_current", "torque", "rpm",
        "workload", "operating_hours", "cooling_efficiency",
        "nozzle_temperature", "bed_temperature", "extruder_temperature",
        "extruder_current", "extruder_torque", "print_speed", "filament_usage",
    ]
    optional_numeric_columns = set(numeric_columns[8:])
    for column in numeric_columns:
        if column not in df.columns:
            continue
        converted = pd.to_numeric(df[column], errors="coerce")
        invalid = converted.isna() & (column not in optional_numeric_columns)
        if column in optional_numeric_columns:
            invalid |= converted.isna() & df[column].notna() & df[column].astype(str).str.strip().ne("")
        invalid |= converted.notna() & ~converted.map(lambda value: float("-inf") < value < float("inf"))
        if invalid.any():
            row_number = int(invalid[invalid].index[0]) + 2
            raise HTTPException(status_code=400, detail=f"Invalid numeric value in '{column}' at CSV row {row_number}.")
        df[column] = converted

    try:
        results = []
        grouped: Dict[str, Dict[str, Any]] = {}
        timestamp_column = next((column for column in df.columns if column.lower() == "timestamp"), None)
        for row_index, row in df.iterrows():
            payload = row.to_dict()
            machine_id_value = payload.get("machine_id")
            if pd.isna(machine_id_value) or not str(machine_id_value).strip():
                raise HTTPException(status_code=400, detail=f"Missing machine_id at CSV row {int(row_index) + 2}.")
            machine_id = str(machine_id_value).strip()
            raw_machine_type = str(payload.get("machine_type", "")).strip().upper().replace("_", " ").replace("-", " ")
            if raw_machine_type in {"CNC", "CNC MACHINE"}:
                machine_type = "CNC"
            elif raw_machine_type in {"3D PRINTER", "3DPRINTER", "PRINTER"}:
                machine_type = "3D Printer"
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported machine_type '{payload.get('machine_type')}' at CSV row {int(row_index) + 2}; use CNC or 3D_PRINTER.")
            payload["machine_id"] = machine_id
            payload["machine_type"] = machine_type
            prediction = predict_single(payload)
            bucket = grouped.setdefault(machine_id, {"machine_id": machine_id, "machine_type": machine_type, "rows": []})
            item = {
                "row_id": int(row_index) + 1,
                "reading_index": len(bucket["rows"]) + 1,
                "machine_id": machine_id,
                "machine_name": machine_id,
                "machine_type": machine_type,
                "temperature": float(payload.get("temperature", 0.0)),
                "vibration": float(payload.get("vibration", 0.0)),
                "motor_current": float(payload.get("motor_current", 0.0)),
                "torque": float(payload.get("torque", 0.0)),
                "rpm": float(payload.get("rpm", 0.0)),
                "workload": float(payload.get("workload", 0.0)),
                "operating_hours": float(payload.get("operating_hours", 0.0)),
                "cooling_efficiency": float(payload.get("cooling_efficiency", 0.8)),
                "failure_risk": float(prediction.get("risk_score", 0.0)),
                "risk_score": float(prediction.get("risk_score", 0.0)),
                "failure_probability": float(prediction.get("failure_probability", 0.0)),
                "failure_prediction": int(prediction.get("failure_prediction", 0)),
                "health_score": float(100.0 - float(prediction.get("risk_score", 0.0))),
                "condition": prediction.get("health_status", "NORMAL"),
                "health_status": prediction.get("health_status", "NORMAL"),
                "recommendation": prediction.get("recommendation", "Continue monitoring"),
            }
            if timestamp_column and pd.notna(payload.get(timestamp_column)):
                timestamp = payload[timestamp_column]
                item["timestamp"] = timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp)
            for column in numeric_columns[8:]:
                if column in payload and pd.notna(payload[column]):
                    item[column] = float(payload[column])
            bucket["rows"].append(item)
            results.append(item)

        machines = []
        for bucket in grouped.values():
            rows = bucket["rows"]
            latest = rows[-1]
            health = round(sum(row["health_score"] for row in rows) / len(rows), 2)
            risk = round(sum(row["failure_risk"] for row in rows) / len(rows), 2)
            condition = latest["condition"]
            machines.append({
                "machine_id": bucket["machine_id"],
                "machine_name": bucket["machine_id"],
                "machine_type": bucket["machine_type"],
                "failure_risk": risk,
                "health_score": health,
                "condition": condition,
                "latest_values": latest,
                "rows": rows,
                "recommendation": latest["recommendation"],
            })

        summary = {
            "file_name": file.filename,
            "total_readings": len(df),
            "machines_detected": len(machines),
            "cnc_machines": sum(1 for item in machines if item["machine_type"] == "CNC"),
            "3d_printers": sum(1 for item in machines if item["machine_type"] == "3D Printer"),
            "normal": sum(1 for item in machines if item["condition"] == "NORMAL"),
            "warning": sum(1 for item in machines if item["condition"] == "WARNING"),
            "critical": sum(1 for item in machines if item["condition"] == "CRITICAL"),
            "failed": sum(1 for item in machines if item["latest_values"]["failure_prediction"] == 1),
        }
        return {"total_rows": len(df), "predictions": results, "machines": machines, "summary": summary}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(exc)}")
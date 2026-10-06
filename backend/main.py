import asyncio
import json
import logging
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add paths
sys.path.insert(0, os.path.dirname(__file__))

from database import db
from ml.ml_engine import MLEngine
from simulation.simulator import MachineSimulator
from app.notifications import (
    dispatch_alert_notifications,
    get_notification_settings,
    save_notification_settings,
    get_notification_logs,
    test_individual_channel,
    reset_machine_alert_state,
    notify_alert_created,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PredMaintBackend")

app = FastAPI(title="Predictive Maintenance Backend", version="1.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
ml_engine = MLEngine()
simulator = MachineSimulator()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass

manager = ConnectionManager()

# Background tasks
background_tasks = set()
last_machine_status = {}
digital_twin_overrides = {}


async def pipeline_loop():
    """Main background pipeline running every 1 second."""
    logger.info("Starting telemetry ingestion and inference pipeline")
    logger.info(f"ML Model Available: {ml_engine.is_ml_available()}")
    db.init_db()
    db.init_simulation_state()

    # Initialize machines in simulator
    machines = db.get_machines()
    for m in machines:
        simulator.initialize_machine(m["id"], m["machine_type"])

    while True:
        try:
            start_time = datetime.now()

            machines = db.get_machines()
            telemetry_data = []

            for machine in machines:
                mid = machine["id"]
                mtype = machine["machine_type"]
                current_status = machine["operational_status"]

                if mid in digital_twin_overrides:
                    override = digital_twin_overrides[mid]
                    predicted_status = override.get("status", current_status)
                    failure_probability = override.get("risk", 75.0 if predicted_status == "CRITICAL" else 25.0)
                    reading = override.get("reading") or simulator.generate_reading(mid, mtype)
                    importance = override.get("importance", {})
                else:
                    # Get simulation state
                    sim_state = db.get_simulation_state(mid)
                    if sim_state:
                        current_sim = simulator.degradation_state.get(mid, {})
                        if (
                            current_sim.get("scenario") != sim_state["scenario"]
                            or current_sim.get("is_running") != bool(sim_state["is_running"])
                            or current_sim.get("speed") != sim_state["speed"]
                        ):
                            simulator.set_scenario(
                                mid,
                                sim_state["scenario"],
                                sim_state["speed"],
                                bool(sim_state["is_running"])
                            )
                            simulator.degradation_state[mid]["progress"] = sim_state["degradation_progress"]

                    # Generate sensor reading
                    reading = simulator.generate_reading(mid, mtype)

                    # Persist degradation progress back to db
                    if mid in simulator.degradation_state:
                        db.update_simulation_state(
                            mid,
                            degradation_progress=simulator.degradation_state[mid]["progress"]
                        )

                    # Save to database
                    db.insert_sensor_reading(reading)

                    # Calculate ML features
                    features = ml_engine.calculate_features(mid, reading)

                    # Run inference
                    failure_probability, predicted_status, importance = ml_engine.run_inference(
                        mid, features, mtype
                    )

                    # Save prediction
                    db.insert_prediction({
                        "time": reading["time"],
                        "machine_id": mid,
                        "failure_probability": failure_probability,
                        "predicted_status": predicted_status,
                        "model_version": ml_engine.model_version,
                        "feature_importance_json": json.dumps(importance),
                    })

                # Check for status change and generate alert
                if mid not in last_machine_status:
                    last_machine_status[mid] = current_status

                previous_status = last_machine_status[mid]

                if predicted_status != previous_status and mid not in digital_twin_overrides:
                    prev_risk = 25.0 if previous_status == "NORMAL" else (65.0 if previous_status == "WARNING" else 85.0)
                    alert_msg = f"Machine {machine['name']} status changed from {previous_status} to {predicted_status}"

                    alert_id = db.insert_alert({
                        "time": reading["time"],
                        "machine_id": mid,
                        "previous_risk": prev_risk,
                        "current_risk": failure_probability,
                        "status": predicted_status,
                        "message": alert_msg,
                    })

                    db.update_machine_status(mid, predicted_status)
                    last_machine_status[mid] = predicted_status

                    if predicted_status in ("WARNING", "CRITICAL"):
                        contrib_keys = []
                        if isinstance(importance, dict):
                            label_map = {
                                "workload": "Operating Workload",
                                "vibration": "Mechanical Vibration",
                                "vibration_trend": "Mechanical Vibration",
                                "temperature": "Spindle Temp",
                                "temperature_trend": "Spindle Temp",
                                "motor_current": "Spindle Current",
                                "torque": "Cutting Torque",
                                "rpm": "Spindle Speed",
                                "rpm_std": "Spindle Speed Variance",
                            }
                            sorted_keys = sorted(importance.items(), key=lambda kv: kv[1], reverse=True)
                            contrib_keys = [label_map.get(k, k.replace('_', ' ').title()) for k, _ in sorted_keys[:4]]

                        alert_dict = {
                            "id": alert_id,
                            "machine_id": machine.get("serial_number") or str(mid),
                            "serial_number": machine.get("serial_number") or f"CNC-{str(mid).zfill(3)}",
                            "machine_name": machine.get("name") or f"Machine {mid}",
                            "machine_type": machine.get("machine_type") or "CNC Machine",
                            "level": predicted_status,
                            "condition": predicted_status,
                            "status": predicted_status,
                            "risk_percentage": failure_probability,
                            "current_risk": failure_probability,
                            "previous_risk": prev_risk,
                            "reason": alert_msg,
                            "recommendation": (
                                "Inspect spindle/bearing assembly immediately."
                                if predicted_status == "CRITICAL"
                                else "Inspect spindle assembly and verify lubrication, feed rate, and operating parameters."
                            ),
                            "created_at": reading["time"],
                            "timestamp": reading["time"],
                            "contributors": contrib_keys,
                            "main_factors": ", ".join(contrib_keys) if contrib_keys else "Spindle Temp, Mechanical Vibration",
                        }
                        notify_alert_created(alert_dict)
                    elif predicted_status == "NORMAL":
                        reset_machine_alert_state(machine.get("serial_number") or str(mid))
                        reset_machine_alert_state(str(mid))

                # Update operating hours
                db.update_machine_hours(mid, reading["operating_hours"])

                # Build telemetry message
                telemetry_data.append({
                    "machine_id": mid,
                    "name": machine["name"],
                    "serial_number": machine["serial_number"],
                    "machine_type": machine["machine_type"],
                    "location": machine["location"],
                    "status": predicted_status,
                    "failure_risk": failure_probability,
                    "temperature": reading["temperature"],
                    "vibration": reading["vibration"],
                    "motor_current": reading["motor_current"],
                    "rpm": reading["rpm"],
                    "operating_hours": reading["operating_hours"],
                    "workload": reading["workload"],
                    "feature_importance": importance,
                    "timestamp": reading["time"],
                })

            # Broadcast telemetry
            await manager.broadcast({
                "type": "telemetry",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "data": telemetry_data,
            })

            # Maintain 1-second interval
            elapsed = (datetime.now() - start_time).total_seconds()
            sleep_time = max(0.05, 1.0 - elapsed)
            await asyncio.sleep(sleep_time)

        except Exception as e:
            logger.error(f"Error in pipeline loop: {e}", exc_info=True)
            await asyncio.sleep(2.0)


@app.on_event("startup")
async def startup_event():
    """Start the background pipeline on app startup."""
    task = asyncio.create_task(pipeline_loop())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


@app.on_event("shutdown")
async def shutdown_event():
    """Cancel background tasks on shutdown."""
    for task in background_tasks:
        task.cancel()


# ===== REST ENDPOINTS =====

@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    """Get real-time fleet health summary metrics."""
    try:
        machines = db.get_machines()
        total_machines = len(machines)
        cnc_count = sum(1 for m in machines if "CNC" in str(m.get("machine_type", "")).upper())
        printer_count = sum(1 for m in machines if "PRINTER" in str(m.get("machine_type", "")).upper() or "3D" in str(m.get("machine_type", "")).upper())

        normal_count = 0
        warning_count = 0
        critical_count = 0
        failed_count = 0
        total_risk = 0.0

        for m in machines:
            mid = m["id"]
            status = m.get("operational_status", "NORMAL").upper()

            if mid in digital_twin_overrides:
                status = digital_twin_overrides[mid].get("status", status).upper()
                risk = float(digital_twin_overrides[mid].get("risk", 20.0))
            else:
                preds = db.get_latest_predictions(mid, limit=1)
                if preds:
                    status = preds[0].get("predicted_status", status).upper()
                    risk = float(preds[0].get("failure_probability", 20.0))
                else:
                    risk = 20.0 if status == "NORMAL" else (65.0 if status == "WARNING" else 94.5)

            if status in ("CRITICAL", "FAILED"):
                if status == "FAILED":
                    failed_count += 1
                critical_count += 1
            elif status == "WARNING":
                warning_count += 1
            else:
                normal_count += 1

            total_risk += risk

        avg_risk = round(total_risk / max(1, total_machines), 1)
        avg_health = round(max(0, min(100, 100 - avg_risk)), 1)
        active_alerts_list = db.get_active_alerts()

        return {
            "total_machines": total_machines,
            "cnc_machines": cnc_count,
            "printer_machines": printer_count,
            "normal_machines": normal_count,
            "warning_machines": warning_count,
            "critical_machines": critical_count,
            "failed_machines": failed_count,
            "average_machine_health": avg_health,
            "average_failure_risk": avg_risk,
            "active_alerts": len(active_alerts_list),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines")
def get_machines():
    """Get all machines enriched with real-time status and failure risk."""
    try:
        machines = db.get_machines()
        enriched = []
        for m in machines:
            mid = m["id"]
            m_copy = dict(m)
            status = m.get("operational_status", "NORMAL").upper()
            if mid in digital_twin_overrides:
                status = digital_twin_overrides[mid].get("status", status).upper()
                risk = float(digital_twin_overrides[mid].get("risk", 20.0))
            else:
                preds = db.get_latest_predictions(mid, limit=1)
                if preds:
                    status = preds[0].get("predicted_status", status).upper()
                    risk = float(preds[0].get("failure_probability", 20.0))
                else:
                    risk = 20.0 if status == "NORMAL" else (65.0 if status == "WARNING" else 94.5)

            health = round(max(0, min(100, 100 - risk)), 1)
            m_copy["status"] = status
            m_copy["operational_status"] = status
            m_copy["failure_risk"] = risk
            m_copy["health_score"] = health
            m_copy["current_values"] = {
                "status": status,
                "failure_risk": risk,
                "health_score": health,
                "operating_hours": m.get("operating_hours", 0),
            }
            enriched.append(m_copy)
        return enriched
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines/{machine_id}")
def get_machine_detail(machine_id: str):
    """Get details for a specific machine."""
    m = db.get_machine(machine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = m["id"]
    m_copy = dict(m)
    status = m.get("operational_status", "NORMAL").upper()
    if mid in digital_twin_overrides:
        status = digital_twin_overrides[mid].get("status", status).upper()
        risk = float(digital_twin_overrides[mid].get("risk", 20.0))
    else:
        preds = db.get_latest_predictions(mid, limit=1)
        if preds:
            status = preds[0].get("predicted_status", status).upper()
            risk = float(preds[0].get("failure_probability", 20.0))
        else:
            risk = 20.0 if status == "NORMAL" else (65.0 if status == "WARNING" else 94.5)

    health = round(max(0, min(100, 100 - risk)), 1)
    m_copy["status"] = status
    m_copy["operational_status"] = status
    m_copy["failure_risk"] = risk
    m_copy["health_score"] = health
    m_copy["current_values"] = {
        "status": status,
        "failure_risk": risk,
        "health_score": health,
        "operating_hours": m.get("operating_hours", 0),
    }
    return m_copy


@app.get("/api/machines/{machine_id}/readings")
def get_machine_readings(machine_id: str, hours: int = 4):
    """Get latest sensor readings for a machine."""
    m = db.get_machine(machine_id)
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = m["id"]
    try:
        history = db.get_sensor_history(mid, hours)
        return {
            "machine_id": mid,
            "serial_number": m.get("serial_number"),
            "readings": history,
            "count": len(history)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines/{machine_id}/prediction")
def get_machine_prediction(machine_id: str):
    """Get latest prediction for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    try:
        predictions = db.get_latest_predictions(mid, limit=1)
        if predictions:
            return predictions[0]
        else:
            return {"message": "No predictions available yet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines/{machine_id}/history")
def get_machine_history(machine_id: str, hours: int = 4):
    """Get sensor history for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    try:
        history = db.get_sensor_history(mid, hours)
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines/{machine_id}/alerts")
def get_machine_alerts(machine_id: str):
    """Get alerts for a specific machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]
    try:
        all_alerts = db.get_all_alerts(limit=100)
        filtered = [a for a in all_alerts if a.get("machine_id") == mid or a.get("serial_number") == machine.get("serial_number")]
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/machines/{machine_id}/maintenance")
def get_machine_maintenance(machine_id: str):
    """Get maintenance records for a specific machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    try:
        records = db.get_maintenance_records(machine["id"])
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/machines/{machine_id}/simulate/start")
def start_simulation(machine_id: str, scenario: str = "NORMAL", speed: int = 1):
    """Start simulation for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    if scenario not in ["NORMAL", "GRADUAL_DEGRADATION", "NEAR_FAILURE"]:
        raise HTTPException(status_code=400, detail="Invalid scenario")

    if speed not in [1, 5, 10]:
        raise HTTPException(status_code=400, detail="Speed must be 1, 5, or 10")

    try:
        db.update_simulation_state(mid, scenario, speed, True, 0.0)
        simulator.set_scenario(mid, scenario, speed, True)
        return {"success": True, "message": f"Started {scenario} simulation at {speed}x speed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/machines/{machine_id}/simulate/pause")
def pause_simulation(machine_id: str):
    """Pause simulation for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    try:
        db.update_simulation_state(mid, is_running=False)
        if mid in simulator.degradation_state:
            simulator.degradation_state[mid]["is_running"] = False
        return {"success": True, "message": "Simulation paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/machines/{machine_id}/simulate/reset")
def reset_simulation(machine_id: str):
    """Reset simulation for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    try:
        db.update_simulation_state(mid, "NORMAL", 1, False, 0.0)
        simulator.reset_machine(mid)
        ml_engine.clear_buffers(mid)
        db.update_machine_status(mid, "NORMAL")
        last_machine_status[mid] = "NORMAL"
        digital_twin_overrides.pop(mid, None)
        reset_machine_alert_state(machine.get("serial_number") or str(mid))
        reset_machine_alert_state(str(mid))
        return {"success": True, "message": "Simulation reset to NORMAL"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/machines/{machine_id}/threshold")
def update_threshold(machine_id: str, threshold: float):
    """Update failure risk threshold for a machine."""
    machine = db.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    mid = machine["id"]

    if not (0.0 <= threshold <= 1.0):
        raise HTTPException(status_code=400, detail="Threshold must be between 0.0 and 1.0")

    try:
        db.update_machine_threshold(mid, threshold)
        return {"success": True, "message": f"Threshold updated to {threshold}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== TELEMETRY & DIGITAL TWIN INGESTION =====

async def ingest_telemetry_payload(payload: dict, machine_id_param: str = None):
    """
    Ingest live telemetry or condition update from the digital twin.
    Evaluates risk, updates DB machine operational_status, inserts alert when applicable,
    and dispatches Email notification for CRITICAL condition (deduplicated).
    """
    mid_raw = payload.get("machine_id") or machine_id_param or "CNC-MILL-01"
    machine = db.get_machine(mid_raw)
    if not machine:
        # Fallback to machine 1 if unknown identifier
        machine = db.get_machine(1)
        if not machine:
            raise HTTPException(status_code=404, detail=f"Machine '{mid_raw}' not found")

    mid = machine["id"]
    previous_status = machine.get("operational_status", "NORMAL")

    raw_cond = str(payload.get("condition") or payload.get("level") or payload.get("status") or "NORMAL").upper()
    if raw_cond in ("FAILED", "CRITICAL_OVERLOAD", "CRITICAL"):
        target_status = "CRITICAL"
    elif raw_cond in ("THERMAL_WARNING", "VIBRATION_FAULT", "WARNING"):
        target_status = "WARNING"
    else:
        target_status = "NORMAL"

    risk_raw = payload.get("failure_risk") if payload.get("failure_risk") is not None else (
        payload.get("risk_percentage") if payload.get("risk_percentage") is not None else payload.get("current_risk")
    )
    if risk_raw is not None:
        try:
            risk = float(risk_raw)
        except (ValueError, TypeError):
            risk = 94.5 if target_status == "CRITICAL" else (65.0 if target_status == "WARNING" else 20.0)
    else:
        risk = 94.5 if target_status == "CRITICAL" else (65.0 if target_status == "WARNING" else 20.0)

    vitals = payload.get("vitals") or {}
    if not isinstance(vitals, dict):
        vitals = {}

    temp = float(vitals.get("temperature") or payload.get("temperature") or (92.5 if target_status == "CRITICAL" else (81.5 if target_status == "WARNING" else 50.0)))
    vib = float(vitals.get("vibration") or payload.get("vibration") or (5.6 if target_status == "CRITICAL" else (2.8 if target_status == "WARNING" else 1.2)))
    motor_current = float(vitals.get("motor_current") or payload.get("motor_current") or 8.0)
    torque = float(vitals.get("torque") or payload.get("torque") or 5.0)
    rpm = float(vitals.get("rpm") or payload.get("rpm") or 2400.0)
    workload = float(vitals.get("workload") or payload.get("workload") or 75.0)

    now_iso = datetime.utcnow().isoformat() + "Z"

    reading_dict = {
        "time": now_iso,
        "machine_id": mid,
        "temperature": temp,
        "vibration": vib,
        "motor_current": motor_current,
        "rpm": rpm,
        "operating_hours": float(machine.get("operating_hours") or 0.0),
        "workload": workload,
    }
    db.insert_sensor_reading(reading_dict)

    factors_raw = payload.get("main_factors") or payload.get("contributors")
    if isinstance(factors_raw, list):
        main_factors = ", ".join(factors_raw)
    elif factors_raw:
        main_factors = str(factors_raw)
    else:
        main_factors = "Spindle Temp, Mechanical Vibration, Cutting Torque, Spindle Current, Operating Workload"

    reason = payload.get("reason") or payload.get("message") or f"{target_status} alert on {machine['serial_number']}: parameters elevated."
    recommendation = payload.get("recommendation") or (
        "Inspect spindle/bearing assembly immediately."
        if target_status == "CRITICAL"
        else "Inspect spindle assembly and verify lubrication, feed rate, and operating parameters."
    )

    db.insert_prediction({
        "time": now_iso,
        "machine_id": mid,
        "failure_probability": risk,
        "predicted_status": target_status,
        "model_version": ml_engine.model_version,
        "feature_importance_json": json.dumps({
            "temperature": 0.35,
            "vibration": 0.35,
            "motor_current": 0.15,
            "torque": 0.15,
        }),
    })

    db.update_machine_status(mid, target_status)
    last_machine_status[mid] = target_status

    alert_id = None
    if target_status == "NORMAL":
        digital_twin_overrides.pop(mid, None)
        reset_machine_alert_state(machine.get("serial_number") or str(mid))
        reset_machine_alert_state(str(mid))
    else:
        digital_twin_overrides[mid] = {
            "status": target_status,
            "risk": risk,
            "reading": reading_dict,
            "importance": {"temperature": 0.35, "vibration": 0.35, "motor_current": 0.15, "torque": 0.15},
            "main_factors": main_factors,
            "reason": reason,
            "recommendation": recommendation,
            "timestamp": datetime.utcnow().timestamp(),
        }

        alert_id = db.insert_alert({
            "time": now_iso,
            "machine_id": mid,
            "previous_risk": 25.0 if previous_status == "NORMAL" else 65.0,
            "current_risk": risk,
            "status": target_status,
            "message": reason,
        })

        alert_dict = {
            "id": alert_id,
            "machine_id": machine["serial_number"],
            "serial_number": machine["serial_number"],
            "machine_name": machine["name"],
            "machine_type": machine["machine_type"],
            "level": target_status,
            "condition": target_status,
            "status": target_status,
            "risk_percentage": risk,
            "current_risk": risk,
            "previous_risk": 25.0 if previous_status == "NORMAL" else 65.0,
            "reason": reason,
            "recommendation": recommendation,
            "created_at": now_iso,
            "timestamp": now_iso,
            "contributors": [f.strip() for f in main_factors.split(",") if f.strip()],
            "main_factors": main_factors,
        }

        # Background dispatch: CRITICAL sends 1 Email, WARNING sends 0 emails
        notify_alert_created(alert_dict)

    # Broadcast updated telemetry to WebSocket clients
    await manager.broadcast({
        "type": "telemetry",
        "timestamp": now_iso,
        "data": [{
            "machine_id": mid,
            "name": machine["name"],
            "serial_number": machine["serial_number"],
            "machine_type": machine["machine_type"],
            "location": machine["location"],
            "status": target_status,
            "failure_risk": risk,
            "temperature": temp,
            "vibration": vib,
            "motor_current": motor_current,
            "rpm": rpm,
            "operating_hours": float(machine.get("operating_hours") or 0.0),
            "workload": workload,
            "feature_importance": {"temperature": 0.35, "vibration": 0.35},
            "timestamp": now_iso,
        }]
    })

    return {
        "success": True,
        "machine_id": mid,
        "serial_number": machine["serial_number"],
        "machine_name": machine["name"],
        "status": target_status,
        "failure_risk": risk,
        "alert_id": alert_id,
    }


@app.post("/api/machines/{machine_id}/telemetry")
async def post_machine_telemetry(machine_id: str, request: Request):
    """Post live telemetry / condition preset from digital twin for a machine."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return await ingest_telemetry_payload(payload, machine_id)


@app.post("/api/telemetry")
async def post_telemetry(request: Request):
    """Post live telemetry / condition preset."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return await ingest_telemetry_payload(payload)


@app.post("/api/alerts")
async def post_alert(request: Request):
    """Ingest alert / condition change from digital twin."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return await ingest_telemetry_payload(payload)


@app.get("/api/alerts")
def get_alerts(active_only: bool = False):
    """Get alerts (all historical alerts or active only)."""
    try:
        if active_only:
            alerts = db.get_active_alerts()
        else:
            alerts = db.get_all_alerts(limit=500)
        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    """Acknowledge an alert."""
    try:
        db.acknowledge_alert(alert_id)
        return {"success": True, "message": "Alert acknowledged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== NOTIFICATION ENDPOINTS =====

@app.get("/api/notifications/settings")
def get_notification_settings_endpoint():
    """Get operator notification channels and provider readiness."""
    try:
        return get_notification_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notifications/settings")
async def save_notification_settings_endpoint(request: Request):
    """Save operator notification channels settings."""
    try:
        payload = await request.json()
        return save_notification_settings(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notifications/logs")
def get_notification_logs_endpoint(limit: int = 100):
    """Get multi-channel notification dispatch logs."""
    try:
        return get_notification_logs(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notifications/test")
async def test_notification_endpoint(request: Request):
    """Trigger verified test dispatch for EMAIL and WHATSAPP."""
    try:
        payload = await request.json() if request else {}
    except Exception:
        payload = {}

    try:
        channel = payload.get("channel")
        recipient = payload.get("recipient")
        res = test_individual_channel(channel=channel, recipient=recipient, custom_alert=payload)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/maintenance")
@app.get("/api/maintenance-records")
def get_maintenance_records_endpoint(machine_id: str = None):
    """Get maintenance records, optionally filtered by machine ID or serial."""
    try:
        records = db.get_maintenance_records(machine_id)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/maintenance")
@app.post("/api/maintenance-records")
async def create_maintenance_record_endpoint(request: Request):
    """Create a maintenance record from JSON payload or form data."""
    try:
        try:
            payload = await request.json()
        except Exception:
            payload = {}

        if not payload:
            params = dict(request.query_params)
            payload = params

        mid = payload.get("machine_id") or 1
        machine = db.get_machine(mid)
        if not machine:
            machine = db.get_machine(1)
            if not machine:
                raise HTTPException(status_code=404, detail=f"Machine '{mid}' not found")

        record_id = db.create_maintenance_record(payload)
        return {
            "success": True,
            "maintenance_id": record_id,
            "message": "Maintenance record successfully saved."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== ML ENDPOINTS =====

@app.get("/api/ml/status")
def get_ml_status():
    """Get ML system status."""
    return {
        "model_loaded": ml_engine.is_ml_available(),
        "model_version": ml_engine.model_version,
        "features": ml_engine.feature_names if ml_engine.feature_names else [],
        "classes": ml_engine.class_names,
    }


@app.post("/api/ml/train")
def train_model():
    """Trigger ML model training."""
    import subprocess
    import sys

    try:
        # Run training script
        train_path = os.path.join(os.path.dirname(__file__), "ml", "train.py")
        result = subprocess.run(
            [sys.executable, train_path],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0:
            return {
                "success": True,
                "message": "Model trained successfully",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Training failed",
                "error": result.stderr
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/evaluate")
def evaluate_model():
    """Evaluate ML model performance."""
    import subprocess
    import sys

    try:
        eval_path = os.path.join(os.path.dirname(__file__), "ml", "evaluate.py")
        result = subprocess.run(
            [sys.executable, eval_path],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0:
            return {
                "success": True,
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "error": result.stderr
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== WEBSOCKET ENDPOINT =====

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry streaming."""
    await manager.connect(websocket)
    try:
        # Send welcome message with machine list
        machines = db.get_machines()
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "message": "Connected to Predictive Maintenance Telemetry Stream",
            "machines": [dict(m) for m in machines],
            "ml_available": ml_engine.is_ml_available(),
        }))

        # Listen for messages
        while True:
            data = await websocket.receive_text()
            # Echo back or handle commands if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
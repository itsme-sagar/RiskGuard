import json
import math
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().with_name("predictive_maintenance.db")

SIMULATION_MODES = ["NORMAL", "GRADUAL_DEGRADATION", "NEAR_FAILURE", "FAILURE"]


def _db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_schema_columns(conn: sqlite3.Connection, table_name: str, expected_columns: Dict[str, str]) -> None:
    existing = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    existing_names = {row[1] for row in existing}
    for name, definition in expected_columns.items():
        if name not in existing_names:
            conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {name} {definition}")


def initialize_database() -> None:
    conn = _db_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS machines (
            machine_id TEXT PRIMARY KEY,
            machine_name TEXT,
            machine_type TEXT NOT NULL,
            manufacturer TEXT,
            model TEXT,
            installation_date TEXT,
            operating_hours REAL NOT NULL DEFAULT 0,
            mode TEXT NOT NULL DEFAULT 'NORMAL',
            status TEXT NOT NULL,
            health_score REAL NOT NULL,
            failure_risk REAL NOT NULL,
            current_values TEXT NOT NULL,
            last_updated TEXT NOT NULL,
            last_maintenance_at TEXT,
            maintenance_interval REAL DEFAULT 0,
            cooling_efficiency REAL DEFAULT 0.8,
            base_temperature REAL DEFAULT 0,
            base_vibration REAL DEFAULT 0,
            base_motor_current REAL DEFAULT 0,
            base_torque REAL DEFAULT 0,
            base_rpm REAL DEFAULT 0,
            workload REAL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            machine_type TEXT NOT NULL,
            mode TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            reading_values TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            machine_type TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            reason TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            created_at TEXT NOT NULL,
            acknowledged INTEGER NOT NULL DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            timestamp TEXT,
            risk_percentage REAL DEFAULT 0,
            condition TEXT,
            main_factors TEXT,
            acknowledged_at TEXT,
            resolved_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS maintenance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            machine_name TEXT,
            machine_type TEXT NOT NULL,
            problem TEXT NOT NULL,
            maintenance_type TEXT NOT NULL,
            repair_date TEXT,
            repair_time TEXT,
            repaired_at TEXT,
            technician TEXT NOT NULL,
            description TEXT NOT NULL,
            parts_replaced TEXT,
            cost REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            next_maintenance_date TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    _ensure_schema_columns(conn, "machines", {
        "machine_name": "TEXT",
        "machine_type": "TEXT",
        "manufacturer": "TEXT",
        "model": "TEXT",
        "installation_date": "TEXT",
        "operating_hours": "REAL DEFAULT 0",
        "mode": "TEXT DEFAULT 'NORMAL'",
        "status": "TEXT",
        "health_score": "REAL DEFAULT 100",
        "failure_risk": "REAL DEFAULT 0",
        "current_values": "TEXT",
        "last_updated": "TEXT",
        "last_maintenance_at": "TEXT",
        "maintenance_interval": "REAL DEFAULT 0",
        "cooling_efficiency": "REAL DEFAULT 0.8",
        "base_temperature": "REAL DEFAULT 0",
        "base_vibration": "REAL DEFAULT 0",
        "base_motor_current": "REAL DEFAULT 0",
        "base_torque": "REAL DEFAULT 0",
        "base_rpm": "REAL DEFAULT 0",
        "workload": "REAL DEFAULT 0",
        "created_at": "TEXT",
        "updated_at": "TEXT",
    })

    _ensure_schema_columns(conn, "maintenance_records", {
        "machine_name": "TEXT",
        "repair_date": "TEXT",
        "repair_time": "TEXT",
        "repaired_at": "TEXT",
        "next_maintenance_date": "TEXT",
    })

    _ensure_schema_columns(conn, "alerts", {
        "status": "TEXT DEFAULT 'ACTIVE'",
        "timestamp": "TEXT",
        "risk_percentage": "REAL DEFAULT 0",
        "condition": "TEXT",
        "main_factors": "TEXT",
        "acknowledged_at": "TEXT",
        "resolved_at": "TEXT",
    })

    try:
        from app.notifications import init_notification_tables
        init_notification_tables(conn)
    except Exception as e:
        print(f"[Init] Notification tables error: {e}")

    if conn.execute("SELECT 1 FROM machines LIMIT 1").fetchone():
        conn.commit()
        conn.close()
        return

    default_machines = [
        ("CNC-001", "CNC", "NORMAL"),
        ("CNC-002", "CNC", "GRADUAL_DEGRADATION"),
        ("3DP-001", "3D Printer", "NEAR_FAILURE"),
        ("3DP-002", "3D Printer", "FAILURE"),
    ]
    for machine_id, machine_type, mode in default_machines:
        machine_name = f"{machine_id} Machine" if machine_type == "CNC" else f"{machine_id} Printer"
        now = datetime.utcnow().isoformat(timespec="seconds")
        state = _compute_state(machine_id, machine_type, mode, {})
        conn.execute(
            """
            INSERT INTO machines (
                machine_id, machine_name, machine_type, manufacturer, model, installation_date,
                operating_hours, mode, status, health_score, failure_risk, current_values,
                last_updated, created_at, updated_at, maintenance_interval, cooling_efficiency,
                base_temperature, base_vibration, base_motor_current, base_torque, base_rpm, workload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                machine_id,
                machine_name,
                machine_type,
                "Industrial Dynamics",
                "Model X",
                now,
                state.get("operating_hours", 500.0),
                mode,
                state.get("status", "NORMAL"),
                state.get("health_score", 100.0),
                state.get("failure_risk", 0.0),
                _serialize(state),
                now,
                now,
                now,
                180.0,
                state.get("cooling_efficiency", 0.8),
                state.get("temperature", 60.0),
                state.get("vibration", 1.2),
                state.get("motor_current", 5.0) if machine_type == "CNC" else state.get("extruder_motor_current", 2.5),
                state.get("torque", 4.0) if machine_type == "CNC" else state.get("extruder_torque", 1.8),
                state.get("rpm", 3300.0) if machine_type == "CNC" else 5200.0,
                state.get("workload", 55.0),
            ),
        )
        conn.execute(
            """
            INSERT INTO sensor_readings (machine_id, machine_type, mode, timestamp, reading_values)
            VALUES (?, ?, ?, ?, ?)
            """,
            (machine_id, machine_type, mode.upper(), now, _serialize(state)),
        )

    conn.commit()
    conn.close()


def _machine_hash(machine_id: str) -> float:
    return float(sum(ord(ch) for ch in machine_id) % 97)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(data: Dict[str, Any], key: str, default: float) -> float:
    value = data.get(key, data.get(key.lower(), default))
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _build_default_machine(machine_id: str, machine_type: str) -> Dict[str, Any]:
    if machine_type == "CNC":
        return {
            "machine_id": machine_id,
            "machine_type": "CNC",
            "mode": "NORMAL",
            "temperature": 64.0,
            "spindle_temperature": 62.0,
            "vibration": 1.3,
            "motor_current": 6.2,
            "torque": 4.0,
            "rpm": 3300.0,
            "feed_rate": 65.0,
            "operating_hours": 540.0,
            "workload": 55.0,
            "coolant_status": 0.82,
            "coolant_temperature": 26.0,
            "spindle_load": 60.0,
            "machine_utilization": 62.0,
            "error_count": 1,
            "maintenance_history": 3,
            "cooling_efficiency": 0.82,
            "status": "NORMAL",
            "condition": "NORMAL",
            "health_score": 86.0,
            "failure_risk": 14.0,
            "explanation": "Stable operating profile with minor thermal and mechanical drift.",
            "recommendation": "Continue standard monitoring.",
        }

    return {
        "machine_id": machine_id,
        "machine_type": "3D Printer",
        "mode": "NORMAL",
        "temperature": 205.0,
        "bed_temperature": 58.0,
        "extruder_temperature": 210.0,
        "extruder_motor_current": 2.3,
        "extruder_torque": 1.8,
        "print_speed": 62.0,
        "layer_count": 120,
        "print_duration": 42.0,
        "operating_hours": 310.0,
        "filament_usage": 4.8,
        "workload": 58.0,
        "fan_status": 0.85,
        "bed_leveling_status": 0.9,
        "vibration": 0.9,
        "error_count": 1,
        "maintenance_history": 2,
        "cooling_efficiency": 0.84,
        "status": "NORMAL",
        "condition": "NORMAL",
        "health_score": 88.0,
        "failure_risk": 13.0,
        "explanation": "Stable thermal and extrusion profile under normal operating load.",
        "recommendation": "Continue standard maintenance cycle.",
    }


def _compute_state(machine_id: str, machine_type: str, mode: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = _build_default_machine(machine_id, machine_type)
    baseline = dict(config)
    stored_machine = get_machine(machine_id)
    if stored_machine:
        stored_values = stored_machine.get("current_values", {})
        baseline.update({
            "temperature": stored_machine.get("base_temperature", baseline.get("temperature")),
            "vibration": stored_machine.get("base_vibration", baseline.get("vibration")),
            "workload": stored_machine.get("workload", baseline.get("workload")),
            "operating_hours": stored_machine.get("operating_hours", baseline.get("operating_hours")),
            "cooling_efficiency": stored_machine.get("cooling_efficiency", baseline.get("cooling_efficiency")),
        })
        if machine_type == "CNC":
            baseline.update({
                "motor_current": stored_machine.get("base_motor_current", baseline.get("motor_current")),
                "torque": stored_machine.get("base_torque", baseline.get("torque")),
                "rpm": stored_machine.get("base_rpm", baseline.get("rpm")),
            })
        else:
            baseline.update({
                "extruder_motor_current": stored_machine.get("base_motor_current", baseline.get("extruder_motor_current")),
                "extruder_torque": stored_machine.get("base_torque", baseline.get("extruder_torque")),
                "bed_temperature": stored_values.get("bed_temperature", baseline.get("bed_temperature")),
                "print_speed": stored_values.get("print_speed", baseline.get("print_speed")),
            })
        config.update(baseline)
    mode_index = SIMULATION_MODES.index(mode.upper()) if mode.upper() in SIMULATION_MODES else 0
    mode_factor = {
        "NORMAL": 0.0,
        "GRADUAL_DEGRADATION": 0.38,
        "NEAR_FAILURE": 0.78,
        "FAILURE": 1.0,
    }.get(mode.upper(), 0.0)

    if overrides:
        for key, value in overrides.items():
            if value is not None:
                config[key] = value

    control_values = {
        "workload": float(config.get("workload", 55.0)),
        "operating_hours": float(config.get("operating_hours", 500.0)),
        "cooling_efficiency": float(config.get("cooling_efficiency", 0.8)),
    }
    if machine_type == "CNC":
        control_values.update({
            key: float(config.get(key, fallback))
            for key, fallback in (("temperature", 64.0), ("vibration", 1.3), ("motor_current", 6.2), ("torque", 4.0), ("rpm", 3300.0))
        })
    else:
        control_values.update({
            key: float(config.get(key, fallback))
            for key, fallback in (("temperature", 205.0), ("bed_temperature", 58.0), ("vibration", 0.9), ("extruder_motor_current", 2.3), ("extruder_torque", 1.8), ("print_speed", 62.0))
        })

    hash_value = _machine_hash(machine_id)
    noise = math.sin((hash_value + mode_index + 1) * 0.75)

    if machine_type == "CNC":
        workload = float(config.get("workload", 55.0))
        hours = float(config.get("operating_hours", 500.0))
        cooling = float(config.get("cooling_efficiency", 0.8))
        torque = float(config.get("torque", 4.0))
        rpm = float(config.get("rpm", 3300.0))
        torque_delta = torque - float(baseline.get("torque", 4.0))
        rpm_delta = rpm - float(baseline.get("rpm", 3300.0))
        workload_delta = workload - float(baseline.get("workload", 55.0))
        hours_delta = hours - float(baseline.get("operating_hours", 500.0))
        cooling_delta = float(baseline.get("cooling_efficiency", 0.8)) - cooling
        temperature = float(config.get("temperature", 64.0)) + 0.22 * workload_delta + 0.02 * hours_delta
        temperature += 15.0 * mode_factor + cooling_delta * 10.0 + max(0.0, torque_delta) * 0.4 + noise * 3.5
        spindle_temperature = temperature + 4.5 + 8.0 * mode_factor + noise * 2.0
        vibration = float(config.get("vibration", 1.3)) + 0.017 * hours_delta + 0.06 * torque_delta
        vibration += 1.8 * mode_factor + abs(noise) * 1.1 + abs(rpm_delta) * 0.0003
        torque = max(1.0, torque + 0.03 * workload_delta + 2.5 * mode_factor + abs(noise) * 0.6)
        motor_current = float(config.get("motor_current", 6.2)) + 0.045 * workload_delta
        motor_current += 0.28 * (torque - float(baseline.get("torque", 4.0))) + 2.8 * mode_factor + abs(noise) * 0.8
        rpm = max(400.0, rpm * (1.0 - 0.08 * mode_factor) + noise * 180)
        spindle_load = _clamp(35.0 + 0.38 * workload + 25.0 * mode_factor + abs(noise) * 8.0, 20.0, 100.0)
        coolant_temperature = 22.0 + 0.03 * temperature + 0.04 * hours + 10.0 * mode_factor
        coolant_status = _clamp(1.0 - 0.7 * mode_factor - 0.15 * (1.0 - cooling), 0.0, 1.0)
        maintenance_history = int(config.get("maintenance_history", 3))
        error_count = int(config.get("error_count", 1)) + int(mode_factor * 12) + int(max(0, vibration - 4.0))

        current_values = {
            "temperature": round(temperature, 2),
            "spindle_temperature": round(spindle_temperature, 2),
            "vibration": round(vibration, 2),
            "motor_current": round(motor_current, 2),
            "torque": round(torque, 2),
            "rpm": round(rpm, 2),
            "feed_rate": round(_clamp(55.0 + 0.18 * workload + 8.0 * mode_factor, 20.0, 120.0), 2),
            "operating_hours": round(hours + 0.5 * mode_factor * 30.0, 2),
            "workload": round(_clamp(workload + 6.0 * mode_factor, 10.0, 100.0), 2),
            "coolant_status": round(coolant_status, 2),
            "coolant_temperature": round(coolant_temperature, 2),
            "spindle_load": round(spindle_load, 2),
            "machine_utilization": round(_clamp(55.0 + 0.22 * workload + 18.0 * mode_factor, 10.0, 100.0), 2),
            "error_count": error_count,
            "maintenance_history": maintenance_history,
            "cooling_efficiency": round(cooling, 2),
            "machine_type": "CNC",
            "mode": mode.upper(),
            "control_values": control_values,
        }
    else:
        workload = float(config.get("workload", 58.0))
        hours = float(config.get("operating_hours", 310.0))
        cooling = float(config.get("cooling_efficiency", 0.84))
        extrusion_load = float(config.get("extruder_torque", 1.8))
        print_speed = float(config.get("print_speed", 62.0))
        speed_delta = print_speed - float(baseline.get("print_speed", 62.0))
        torque_delta = extrusion_load - float(baseline.get("extruder_torque", 1.8))
        workload_delta = workload - float(baseline.get("workload", 58.0))
        hours_delta = hours - float(baseline.get("operating_hours", 310.0))
        cooling_delta = float(baseline.get("cooling_efficiency", 0.84)) - cooling
        nozzle_temp = float(config.get("temperature", 205.0)) + 0.25 * workload_delta + 0.03 * hours_delta
        nozzle_temp += 20.0 * mode_factor + cooling_delta * 15.0 + max(0.0, speed_delta) * 0.12
        nozzle_temp += max(0.0, torque_delta) * 0.45 + noise * 3.0
        bed_temp = float(config.get("bed_temperature", 58.0)) + 0.12 * workload_delta + 0.015 * hours_delta + 10.0 * mode_factor
        extruder_temp = nozzle_temp + 5.0 + 7.0 * mode_factor
        vibration = float(config.get("vibration", 0.9)) + 0.008 * hours_delta + 0.16 * torque_delta
        vibration += 1.9 * mode_factor + abs(noise) + max(0.0, speed_delta) * 0.02
        extruder_current = float(config.get("extruder_motor_current", 2.3)) + 0.028 * workload_delta + 0.22 * torque_delta
        extruder_current += 2.2 * mode_factor + abs(noise) * 0.7 + max(0.0, speed_delta) * 0.03
        extruder_torque = max(0.8, extrusion_load + 0.07 * workload_delta + 2.1 * mode_factor + abs(noise) * 0.5 + max(0.0, speed_delta) * 0.02)
        print_speed = max(20.0, print_speed * (1.0 - 0.07 * mode_factor) + noise * 10.0)
        fan_status = _clamp(1.0 - 0.9 * mode_factor - 0.12 * (1.0 - cooling), 0.0, 1.0)
        bed_leveling = _clamp(1.0 - 0.35 * mode_factor, 0.0, 1.0)
        maintenance_history = int(config.get("maintenance_history", 2))
        error_count = int(config.get("error_count", 1)) + int(mode_factor * 10) + int(max(0, vibration - 2.2))

        current_values = {
            "temperature": round(nozzle_temp, 2),
            "bed_temperature": round(bed_temp, 2),
            "extruder_temperature": round(extruder_temp, 2),
            "extruder_motor_current": round(extruder_current, 2),
            "extruder_torque": round(extruder_torque, 2),
            "print_speed": round(print_speed, 2),
            "layer_count": int(config.get("layer_count", 120) + 5 * mode_factor + abs(noise) * 10),
            "print_duration": round(_clamp(config.get("print_duration", 42.0) + 4.0 * mode_factor + abs(noise) * 3.0, 20.0, 180.0), 2),
            "operating_hours": round(hours + 0.9 * mode_factor * 25.0, 2),
            "filament_usage": round(config.get("filament_usage", 4.8) + 0.12 * workload + 0.8 * mode_factor, 2),
            "workload": round(_clamp(workload + 8.0 * mode_factor, 10.0, 100.0), 2),
            "fan_status": round(fan_status, 2),
            "bed_leveling_status": round(bed_leveling, 2),
            "vibration": round(vibration, 2),
            "error_count": error_count,
            "maintenance_history": maintenance_history,
            "cooling_efficiency": round(cooling, 2),
            "machine_type": "3D Printer",
            "mode": mode.upper(),
            "control_values": control_values,
        }

    if mode.upper() == "FAILURE":
        if machine_type == "CNC":
            current_values.update({
                "temperature": 102.0,
                "spindle_temperature": 110.0,
                "vibration": 7.8,
                "motor_current": 15.0,
                "torque": 11.0,
                "rpm": 0.0,
                "coolant_status": 0.2,
                "spindle_load": 100.0,
                "status": "FAILED",
                "condition": "FAILED",
            })
        else:
            current_values.update({
                "temperature": 255.0,
                "extruder_temperature": 260.0,
                "vibration": 4.8,
                "extruder_motor_current": 7.5,
                "extruder_torque": 7.8,
                "print_speed": 8.0,
                "fan_status": 0.15,
                "workload": 98.0,
                "status": "FAILED",
                "condition": "FAILED",
            })

    risk_score = _calculate_risk_score(machine_type, current_values, mode.upper())
    health_score = round(_clamp(100.0 - risk_score, 0.0, 100.0), 2)
    current_values["health_score"] = health_score
    current_values["failure_risk"] = round(risk_score, 2)
    current_values["status"] = "FAILED" if mode.upper() == "FAILURE" else (
        "CRITICAL" if risk_score > 70 else "WARNING" if risk_score > 30 else "NORMAL"
    )
    current_values["condition"] = current_values["status"]
    current_values["recommendation"] = _recommendation_for(machine_type, current_values)
    current_values["explanation"] = _explain_risk(machine_type, current_values)

    return current_values


def _calculate_risk_score(machine_type: str, values: Dict[str, Any], mode: str) -> float:
    if machine_type == "CNC":
        temp = values.get("temperature", 60.0)
        vib = values.get("vibration", 1.0)
        current = values.get("motor_current", 5.0)
        torque = values.get("torque", 4.0)
        workload = values.get("workload", 50.0)
        hours = values.get("operating_hours", 500.0)
        cooling = values.get("cooling_efficiency", 0.8)
        temp_ratio = _clamp(temp / 110.0 * 100.0, 0.0, 100.0)
        vibration_ratio = _clamp(vib / 8.0 * 100.0, 0.0, 100.0)
        current_ratio = _clamp(current / 15.0 * 100.0, 0.0, 100.0)
        torque_ratio = _clamp(torque / 12.0 * 100.0, 0.0, 100.0)
        workload_ratio = _clamp(workload, 0.0, 100.0)
        hours_ratio = _clamp(hours / 2000.0 * 100.0, 0.0, 100.0)
        cooling_penalty = (1.0 - cooling) * 45.0
        mode_bias = {"NORMAL": -18.0, "GRADUAL_DEGRADATION": 6.0, "NEAR_FAILURE": 22.0, "FAILURE": 38.0}.get(mode, 0.0)
        risk = (
            temp_ratio * 0.18
            + vibration_ratio * 0.18
            + current_ratio * 0.12
            + torque_ratio * 0.10
            + workload_ratio * 0.08
            + hours_ratio * 0.05
            + cooling_penalty * 0.6
            + mode_bias
        )
        return _clamp(risk, 0.0, 100.0)

    temp = values.get("temperature", 205.0)
    vib = values.get("vibration", 0.8)
    current = values.get("extruder_motor_current", 2.5)
    torque = values.get("extruder_torque", 1.8)
    workload = values.get("workload", 60.0)
    hours = values.get("operating_hours", 310.0)
    cooling = values.get("cooling_efficiency", 0.85)
    temp_ratio = _clamp(temp / 260.0 * 100.0, 0.0, 100.0)
    vibration_ratio = _clamp(vib / 5.0 * 100.0, 0.0, 100.0)
    current_ratio = _clamp(current / 8.0 * 100.0, 0.0, 100.0)
    torque_ratio = _clamp(torque / 8.0 * 100.0, 0.0, 100.0)
    workload_ratio = _clamp(workload, 0.0, 100.0)
    hours_ratio = _clamp(hours / 1500.0 * 100.0, 0.0, 100.0)
    cooling_penalty = (1.0 - cooling) * 50.0
    mode_bias = {"NORMAL": -20.0, "GRADUAL_DEGRADATION": 7.0, "NEAR_FAILURE": 24.0, "FAILURE": 40.0}.get(mode, 0.0)
    risk = (
        temp_ratio * 0.16
        + vibration_ratio * 0.18
        + current_ratio * 0.12
        + torque_ratio * 0.12
        + workload_ratio * 0.08
        + hours_ratio * 0.05
        + cooling_penalty * 0.55
        + mode_bias
    )
    return _clamp(risk, 0.0, 100.0)


def _recommendation_for(machine_type: str, values: Dict[str, Any]) -> str:
    if machine_type == "CNC":
        if values.get("temperature", 0) > 85:
            return "Inspect cooling system, coolant flow, and spindle thermal load."
        if values.get("vibration", 0) > 4.0:
            return "Inspect spindle bearings, tool holder, and mechanical alignment."
        if values.get("motor_current", 0) > 10:
            return "Check motor load, spindle resistance, and mechanical obstruction."
        if values.get("torque", 0) > 8:
            return "Review workpiece load, cutting conditions, and tool wear." 
        return "Continue standard monitoring and maintenance checks."

    if values.get("temperature", 0) > 240:
        return "Check heater, thermistor, and cooling fan performance."
    if values.get("extruder_torque", 0) > 5.0:
        return "Inspect filament path, nozzle blockage, and extruder gear assembly."
    if values.get("vibration", 0) > 2.5:
        return "Check print-head alignment and extruder mechanical stability."
    return "Maintain standard print calibration and inspect filament feed path."


def _explain_risk(machine_type: str, values: Dict[str, Any]) -> str:
    if machine_type == "CNC":
        return (
            "Primary contributors are elevated temperature, increased spindle vibration, and higher motor load. "
            "This combination reduces machine health and raises the probability of spindle or bearing failure."
        )
    return (
        "Primary contributors are elevated extrusion temperature, increased extruder torque, and unstable vibration. "
        "This reduces print stability and raises the probability of filament jam or nozzle failure."
    )


def _serialize(values: Dict[str, Any]) -> str:
    return json.dumps(values, default=str)


def _save_reading(machine_id: str, machine_type: str, mode: str, values: Dict[str, Any]) -> None:
    conn = _db_connection()
    conn.execute(
        """
        INSERT INTO sensor_readings (machine_id, machine_type, mode, timestamp, reading_values)
        VALUES (?, ?, ?, ?, ?)
        """,
        (machine_id, machine_type, mode.upper(), datetime.utcnow().isoformat(timespec="seconds"), _serialize(values)),
    )
    conn.execute(
        """
        INSERT INTO machines (machine_id, machine_type, mode, status, health_score, failure_risk, current_values, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(machine_id) DO UPDATE SET
            machine_type = excluded.machine_type,
            mode = excluded.mode,
            status = excluded.status,
            health_score = excluded.health_score,
            failure_risk = excluded.failure_risk,
            current_values = excluded.current_values,
            last_updated = excluded.last_updated
        """,
        (
            machine_id,
            machine_type,
            mode.upper(),
            values.get("status", "NORMAL"),
            values.get("health_score", 100.0),
            values.get("failure_risk", 0.0),
            _serialize(values),
            datetime.utcnow().isoformat(timespec="seconds"),
        ),
    )
    conn.commit()
    conn.close()


def save_alert(
    machine_id: str,
    machine_type: str,
    level: str,
    message: str,
    reason: str,
    recommendation: str,
    risk_percentage: float = 0.0,
    condition: str = "NORMAL",
    main_factors: str = "",
) -> Dict[str, Any]:
    now_iso = datetime.utcnow().isoformat(timespec="seconds")
    alert = {
        "machine_id": machine_id,
        "machine_type": machine_type,
        "level": level,
        "message": message,
        "reason": reason,
        "recommendation": recommendation,
        "created_at": now_iso,
        "timestamp": now_iso,
        "risk_percentage": float(risk_percentage),
        "condition": condition,
        "main_factors": main_factors,
        "status": "ACTIVE",
    }
    conn = _db_connection()
    conn.execute(
        """
        INSERT INTO alerts (
            machine_id, machine_type, level, message, reason, recommendation,
            created_at, timestamp, risk_percentage, condition, main_factors, status, acknowledged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """,
        (
            machine_id,
            machine_type,
            level,
            message,
            reason,
            recommendation,
            alert["created_at"],
            alert["timestamp"],
            alert["risk_percentage"],
            alert["condition"],
            alert["main_factors"],
            alert["status"],
        ),
    )
    conn.commit()
    conn.close()

    try:
        from app.notifications import notify_alert_created
        notify_alert_created(alert)
    except Exception as e:
        print(f"[Alerts] Notification hook error: {e}")

    return alert



def get_alerts_for_machine(machine_id: str) -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute(
        "SELECT * FROM alerts WHERE machine_id = ? ORDER BY id DESC",
        (machine_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_maintenance_for_machine(machine_id: str) -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute(
        "SELECT * FROM maintenance_records WHERE machine_id = ? ORDER BY id DESC",
        (machine_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def add_maintenance_record(machine_id: str, machine_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    machine = get_machine(machine_id) or {"machine_name": machine_id, "machine_type": machine_type}
    repaired_at = data.get("repaired_at") or data.get("repair_date") or datetime.utcnow().isoformat(timespec="seconds")
    repair_date = data.get("repair_date") or datetime.utcnow().strftime("%Y-%m-%d")
    repair_time = data.get("repair_time") or datetime.utcnow().strftime("%H:%M")
    record = {
        "machine_id": machine_id,
        "machine_name": machine.get("machine_name") or machine_id,
        "machine_type": machine_type,
        "maintenance_type": data.get("maintenance_type", "Inspection"),
        "problem": data.get("problem", "General maintenance"),
        "technician": data.get("technician", "Lab Technician"),
        "description": data.get("description", "Planned maintenance."),
        "parts_replaced": data.get("parts_replaced", "-"),
        "cost": float(data.get("cost", 0.0)),
        "status": data.get("status", "Completed"),
        "repair_date": repair_date,
        "repair_time": repair_time,
        "repaired_at": repaired_at,
        "next_maintenance_date": data.get("next_maintenance_date", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(timespec="seconds"),
    }
    conn = _db_connection()
    conn.execute(
        """
        INSERT INTO maintenance_records (
            machine_id, machine_name, machine_type, maintenance_type, problem, technician, description,
            parts_replaced, cost, status, repair_date, repair_time, repaired_at,
            next_maintenance_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            machine_id,
            record["machine_name"],
            machine_type,
            record["maintenance_type"],
            record["problem"],
            record["technician"],
            record["description"],
            record["parts_replaced"],
            record["cost"],
            record["status"],
            record["repair_date"],
            record["repair_time"],
            record["repaired_at"],
            record["next_maintenance_date"],
            record["notes"],
            record["created_at"],
        ),
    )
    conn.execute(
        "UPDATE machines SET last_maintenance_at = ?, updated_at = ? WHERE machine_id = ?",
        (record["repaired_at"], record["created_at"], machine_id),
    )
    conn.commit()
    conn.close()
    return record


def list_maintenance_records() -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute("SELECT * FROM maintenance_records ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def list_machines() -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute(
        "SELECT * FROM machines ORDER BY machine_id"
    ).fetchall()
    conn.close()
    machines = []
    for row in rows:
        payload = dict(row)
        try:
            payload["current_values"] = json.loads(payload["current_values"])
        except Exception:
            payload["current_values"] = {}
        if "machine_name" not in payload or not payload["machine_name"]:
            payload["machine_name"] = payload.get("machine_id")
        machines.append(payload)
    return machines


def get_machine(machine_id: str) -> Optional[Dict[str, Any]]:
    conn = _db_connection()
    row = conn.execute(
        "SELECT * FROM machines WHERE machine_id = ?",
        (machine_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    payload = dict(row)
    try:
        payload["current_values"] = json.loads(payload["current_values"])
    except Exception:
        payload["current_values"] = {}
    if "machine_name" not in payload or not payload["machine_name"]:
        payload["machine_name"] = payload.get("machine_id")
    return payload


def add_machine(machine_payload: Dict[str, Any]) -> Dict[str, Any]:
    machine_id = str(machine_payload.get("machine_id", "")).strip()
    if not machine_id:
        raise ValueError("Machine ID is required.")
    if get_machine(machine_id):
        raise ValueError("Machine ID already exists.")

    machine_type = str(machine_payload.get("machine_type") or "CNC").strip()
    if machine_type not in {"CNC", "3D Printer"}:
        raise ValueError("Unsupported machine type.")

    machine_name = str(machine_payload.get("machine_name") or machine_id).strip()
    manufacturer = str(machine_payload.get("manufacturer") or "Unknown").strip()
    model = str(machine_payload.get("model") or "Standard").strip()
    installation_date = str(machine_payload.get("installation_date") or datetime.utcnow().strftime("%Y-%m-%d")).strip()
    operating_hours = float(machine_payload.get("operating_hours") or 0.0)
    status = str(machine_payload.get("status") or "NORMAL").upper()
    mode = str(machine_payload.get("mode") or "NORMAL").upper()
    workload = float(machine_payload.get("workload") or 50.0)
    cooling_efficiency = float(machine_payload.get("cooling_efficiency") or 0.8)
    now = datetime.utcnow().isoformat(timespec="seconds")
    default_state = _build_default_machine(machine_id, machine_type)
    current_values = {
        **default_state,
        "machine_id": machine_id,
        "machine_type": machine_type,
        "status": status,
        "condition": status,
        "mode": mode,
        "workload": workload,
        "operating_hours": operating_hours,
        "cooling_efficiency": cooling_efficiency,
        "temperature": float(machine_payload.get("base_temperature") or default_state.get("temperature", 60.0)),
        "vibration": float(machine_payload.get("base_vibration") or default_state.get("vibration", 1.2)),
        "motor_current": float(machine_payload.get("base_motor_current") or default_state.get("motor_current", 5.0)),
        "torque": float(machine_payload.get("base_torque") or default_state.get("torque", 4.0)),
        "rpm": float(machine_payload.get("base_rpm") or default_state.get("rpm", 3300.0)),
    }
    if machine_type == "3D Printer":
        current_values["extruder_temperature"] = float(machine_payload.get("base_temperature") or default_state.get("extruder_temperature", 205.0))
        current_values["extruder_motor_current"] = float(machine_payload.get("base_motor_current") or default_state.get("extruder_motor_current", 2.5))
        current_values["extruder_torque"] = float(machine_payload.get("base_torque") or default_state.get("extruder_torque", 1.8))
        current_values["bed_temperature"] = float(machine_payload.get("base_bed_temperature") or default_state.get("bed_temperature", 58.0))
        current_values["print_speed"] = float(machine_payload.get("base_print_speed") or default_state.get("print_speed", 62.0))
    state = _compute_state(machine_id, machine_type, mode, current_values)
    state["machine_name"] = machine_name
    state["manufacturer"] = manufacturer
    state["model"] = model
    state["installation_date"] = installation_date
    state["operating_hours"] = operating_hours
    state["status"] = state.get("status", status)
    state["condition"] = state.get("condition", state["status"])
    conn = _db_connection()
    conn.execute(
        """
        INSERT INTO machines (
            machine_id, machine_name, machine_type, manufacturer, model, installation_date,
            operating_hours, mode, status, health_score, failure_risk, current_values,
            last_updated, created_at, updated_at, maintenance_interval, cooling_efficiency,
            base_temperature, base_vibration, base_motor_current, base_torque, base_rpm, workload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            machine_id,
            machine_name,
            machine_type,
            manufacturer,
            model,
            installation_date,
            operating_hours,
            mode,
            state.get("status", status),
            state.get("health_score", 100.0),
            state.get("failure_risk", 0.0),
            _serialize(state),
            now,
            now,
            now,
            float(machine_payload.get("maintenance_interval") or 180.0),
            state.get("cooling_efficiency", 0.8),
            state.get("temperature", 60.0),
            state.get("vibration", 1.2),
            state.get("motor_current", 5.0) if machine_type == "CNC" else state.get("extruder_motor_current", 2.5),
            state.get("torque", 4.0) if machine_type == "CNC" else state.get("extruder_torque", 1.8),
            state.get("rpm", 3300.0) if machine_type == "CNC" else 5200.0,
            state.get("workload", 55.0),
        ),
    )
    conn.commit(); conn.close()
    _save_reading(machine_id, machine_type, mode, state)
    return get_machine(machine_id)


def apply_simulation(machine_id: str, machine_type: str, mode: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    machine_type = (machine_type or "CNC").strip()
    if machine_type not in {"CNC", "3D Printer"}:
        machine_type = "CNC" if "CNC" in machine_id.upper() else "3D Printer"
    state = _compute_state(machine_id, machine_type, mode, overrides or {})
    _save_reading(machine_id, machine_type, mode, state)

    risk = state.get("failure_risk", 0.0)
    level = "CRITICAL" if risk >= 70 else "WARNING" if risk >= 30 else "NORMAL"
    if mode.upper() == "FAILURE":
        level = "CRITICAL"

    if risk >= 30:
        save_alert(
            machine_id,
            machine_type,
            level,
            f"{machine_id} requires attention",
            state.get("explanation", "Operating conditions exceed safe tolerance."),
            state.get("recommendation", "Inspect machine components and review maintenance history."),
        )

    return state


def dashboard_summary() -> Dict[str, Any]:
    machines = list_machines()
    total = len(machines)
    cnc = sum(1 for m in machines if m.get("machine_type") == "CNC")
    printer = sum(1 for m in machines if m.get("machine_type") == "3D Printer")
    normal = sum(1 for m in machines if str(m.get("status", "")).upper() == "NORMAL")
    warning = sum(1 for m in machines if str(m.get("status", "")).upper() == "WARNING")
    critical = sum(1 for m in machines if str(m.get("status", "")).upper() == "CRITICAL")
    failed = sum(1 for m in machines if str(m.get("status", "")).upper() == "FAILED")
    avg_health = round(sum(float(m.get("health_score", 0.0)) for m in machines) / total, 2) if total else 0.0
    avg_risk = round(sum(float(m.get("failure_risk", 0.0)) for m in machines) / total, 2) if total else 0.0
    conn = _db_connection()
    alert_count = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    conn.close()

    return {
        "total_machines": total,
        "cnc_machines": cnc,
        "printer_machines": printer,
        "normal_machines": normal,
        "warning_machines": warning,
        "critical_machines": critical,
        "failed_machines": failed,
        "average_machine_health": avg_health,
        "average_failure_risk": avg_risk,
        "active_alerts": alert_count,
    }


def get_machine_readings(machine_id: str) -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute(
        "SELECT * FROM sensor_readings WHERE machine_id = ? ORDER BY id DESC LIMIT 30",
        (machine_id,),
    ).fetchall()
    conn.close()
    readings = []
    for row in rows:
        payload = dict(row)
        payload["values"] = json.loads(payload["reading_values"])
        readings.append(payload)
    return readings


def get_all_alerts() -> List[Dict[str, Any]]:
    conn = _db_connection()
    rows = conn.execute("SELECT * FROM alerts ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


initialize_database()

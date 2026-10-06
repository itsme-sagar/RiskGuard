import os
import sqlite3
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "predmaint.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")

def get_db_connection():
    """Get a database connection with row factory."""
    # Ensure data directory exists
    data_dir = os.path.dirname(DB_PATH)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with schema and seed data."""
    # Read and execute schema
    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executescript(schema)

    # Check if we need to seed machines
    cursor.execute("SELECT COUNT(*) FROM machines")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_machines(cursor)

    conn.commit()
    conn.close()

def seed_machines(cursor):
    """Seed initial machines for the manufacturing lab."""
    from datetime import datetime

    machines_data = [
        ("CNC-001", "CNC Machine 001", "CNC Machine", "Haas VF-2", "Lab Zone A", "2024-01-15"),
        ("CNC-002", "CNC Machine 002", "CNC Machine", "Haas VF-2", "Lab Zone A", "2024-02-10"),
        ("CNC-003", "CNC Machine 003", "CNC Machine", "Fadal VMC-4020", "Lab Zone B", "2023-11-05"),
        ("CNC-004", "CNC Machine 004", "CNC Machine", "Haas VF-1", "Lab Zone B", "2024-03-01"),
        ("3DP-001", "3D Printer 001", "3D Printer", "Prusa MK4", "Lab Zone C", "2024-04-18"),
        ("3DP-002", "3D Printer 002", "3D Printer", " Bambu Lab X1C", "Lab Zone C", "2024-05-01"),
    ]

    cursor.executemany(
        """
        INSERT INTO machines (serial_number, name, machine_type, model, location, install_date)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        machines_data
    )

    # Initialize simulation state for each machine
    for m in machines_data:
        cursor.execute(
            "INSERT INTO simulation_state (machine_id, scenario, speed, is_running, degradation_progress) VALUES (NULL, 'NORMAL', 1, 0, 0.0)"
        )

def get_machines():
    """Get all machines with their current status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM machines ORDER BY id")
    raw_machines = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    machines = []
    for m in raw_machines:
        m_copy = dict(m)
        m_copy["machine_id"] = m["serial_number"]
        m_copy["machine_name"] = m["name"]
        m_copy["status"] = m["operational_status"]
        machines.append(m_copy)
    return machines

def get_machine(machine_id):
    """Get a specific machine by ID, serial number, or twin identifier."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Try numeric ID
    try:
        mid = int(machine_id)
        cursor.execute("SELECT * FROM machines WHERE id = ?", (mid,))
        row = cursor.fetchone()
        if row:
            conn.close()
            res = dict(row)
            res["machine_id"] = res["serial_number"]
            res["machine_name"] = res["name"]
            res["status"] = res["operational_status"]
            return res
    except (ValueError, TypeError):
        pass

    # Try serial number
    cursor.execute("SELECT * FROM machines WHERE serial_number = ?", (str(machine_id),))
    row = cursor.fetchone()
    if row:
        conn.close()
        res = dict(row)
        res["machine_id"] = res["serial_number"]
        res["machine_name"] = res["name"]
        res["status"] = res["operational_status"]
        return res

    # Try machine name
    cursor.execute("SELECT * FROM machines WHERE name = ?", (str(machine_id),))
    row = cursor.fetchone()
    if row:
        conn.close()
        res = dict(row)
        res["machine_id"] = res["serial_number"]
        res["machine_name"] = res["name"]
        res["status"] = res["operational_status"]
        return res

    # Known aliases mapping
    alias_map = {
        "CNC-001": 1, "CNC-MILL-01": 1, "LAPTOP-TWIN-01": 1,
        "CNC-002": 2, "CNC-LATHE-02": 2,
        "CNC-003": 3, "CNC-VMC-03": 3,
        "CNC-004": 4, "CNC-TURN-04": 4,
        "3DP-001": 5, "3DP-FDM-01": 5,
        "3DP-002": 6, "3DP-IND-02": 6,
    }
    mapped_id = alias_map.get(str(machine_id).strip())
    if mapped_id:
        cursor.execute("SELECT * FROM machines WHERE id = ?", (mapped_id,))
        row = cursor.fetchone()
        if row:
            conn.close()
            res = dict(row)
            res["machine_id"] = res["serial_number"]
            res["machine_name"] = res["name"]
            res["status"] = res["operational_status"]
            return res

    conn.close()
    return None

def update_machine_status(machine_id, status):
    """Update machine operational status by ID or serial number."""
    m = get_machine(machine_id)
    target_id = m["id"] if m else machine_id

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE machines SET operational_status = ? WHERE id = ?", (status, target_id))
    conn.commit()
    conn.close()

def update_machine_hours(machine_id, operating_hours):
    """Update machine operating hours."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE machines SET operating_hours = ? WHERE id = ?", (operating_hours, machine_id))
    conn.commit()
    conn.close()

def update_machine_threshold(machine_id, threshold):
    """Update machine failure risk threshold sensitivity."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE machines SET threshold_sensitivity = ? WHERE id = ?", (threshold, machine_id))
    conn.commit()
    conn.close()

def insert_sensor_reading(reading):
    """Insert a single sensor reading."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO sensor_readings (time, machine_id, temperature, vibration, motor_current, rpm, operating_hours, workload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (reading["time"], reading["machine_id"], reading["temperature"], reading["vibration"],
         reading["motor_current"], reading["rpm"], reading["operating_hours"], reading["workload"])
    )
    conn.commit()
    conn.close()

def insert_prediction(prediction):
    """Insert a prediction record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO predictions (time, machine_id, failure_probability, predicted_status, model_version, feature_importance_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (prediction["time"], prediction["machine_id"], prediction["failure_probability"],
         prediction["predicted_status"], prediction["model_version"], prediction["feature_importance_json"])
    )
    conn.commit()
    conn.close()

def insert_alert(alert):
    """Insert an alert record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO alerts (time, machine_id, previous_risk, current_risk, status, message)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (alert["time"], alert["machine_id"], alert["previous_risk"], alert["current_risk"],
         alert["status"], alert["message"])
    )
    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return alert_id

def acknowledge_alert(alert_id):
    """Acknowledge an alert."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()

def get_active_alerts():
    """Get all unacknowledged alerts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.*, m.name as machine_name, m.serial_number
        FROM alerts a
        JOIN machines m ON a.machine_id = m.id
        WHERE a.acknowledged = 0
        ORDER BY a.time DESC
        """
    )
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts

def get_all_alerts(limit=500):
    """Get historical alerts with machine metadata."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.*, m.name as machine_name, m.serial_number
        FROM alerts a
        JOIN machines m ON a.machine_id = m.id
        ORDER BY a.time DESC
        LIMIT ?
        """,
        (limit,)
    )
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts

def create_maintenance_record(record):
    """Create a maintenance record."""
    conn = get_db_connection()
    cursor = conn.cursor()

    mid_raw = record.get("machine_id", 1)
    m = get_machine(mid_raw)
    machine_numeric_id = m["id"] if m else 1

    date_val = record.get("date") or record.get("repaired_at") or record.get("repair_date") or (datetime.utcnow().isoformat() + "Z")
    issue_val = record.get("issue") or record.get("problem") or "Routine Maintenance"
    action_val = record.get("action") or record.get("description") or "Inspection and service"
    tech_val = record.get("technician") or "Technician A"
    notes_val = record.get("notes") or ""

    cursor.execute(
        """
        INSERT INTO maintenance_records (machine_id, date, issue, action, technician, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (machine_numeric_id, date_val, issue_val, action_val, tech_val, notes_val)
    )
    maintenance_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return maintenance_id

def get_maintenance_records(machine_id=None):
    """Get maintenance records, optionally filtered by machine ID or serial."""
    conn = get_db_connection()
    cursor = conn.cursor()
    target_id = None
    if machine_id is not None and str(machine_id).strip() != "" and str(machine_id).upper() != "ALL":
        m = get_machine(machine_id)
        if m:
            target_id = m["id"]
        else:
            try:
                target_id = int(machine_id)
            except (ValueError, TypeError):
                target_id = None

    if target_id is not None:
        cursor.execute(
            """
            SELECT m.*, ma.name as machine_name, ma.serial_number, ma.machine_type
            FROM maintenance_records m
            JOIN machines ma ON m.machine_id = ma.id
            WHERE m.machine_id = ?
            ORDER BY m.date DESC
            """,
            (target_id,)
        )
    else:
        cursor.execute(
            """
            SELECT m.*, ma.name as machine_name, ma.serial_number, ma.machine_type
            FROM maintenance_records m
            JOIN machines ma ON m.machine_id = ma.id
            ORDER BY m.date DESC
            """
        )
    raw_records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    records = []
    for r in raw_records:
        rec = dict(r)
        rec["problem"] = r.get("issue")
        rec["description"] = r.get("action")
        is_repair = any(w in (r.get("issue") or "").lower() for w in ["critical", "overload", "fault", "vibration", "thermal", "failed", "warning"])
        rec["maintenance_type"] = "Repair" if is_repair else "Inspection"
        raw_date = r.get("date") or ""
        rec["repair_date"] = raw_date.split("T")[0] if "T" in raw_date else raw_date
        rec["repair_time"] = raw_date.split("T")[1][:5] if "T" in raw_date and len(raw_date.split("T")[1]) >= 5 else "10:00"
        rec["status"] = "Completed"
        rec["cost"] = 1250 if is_repair else 450
        rec["parts_replaced"] = "Spindle Bearing / High-Temp Lubricant" if any(w in (r.get("issue") or "").lower() for w in ["spindle", "temp", "vibration", "torque"]) else "Filter / Standard Lubricant"
        records.append(rec)
    return records

def get_sensor_history(machine_id, hours=4):
    """Get sensor readings history for a machine."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"

    cursor.execute(
        """
        SELECT * FROM sensor_readings
        WHERE machine_id = ? AND time >= ?
        ORDER BY time ASC
        """,
        (machine_id, cutoff_time)
    )

    readings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return readings

def get_latest_predictions(machine_id=None, limit=10):
    """Get latest predictions, optionally filtered by machine."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if machine_id:
        cursor.execute(
            """
            SELECT * FROM predictions
            WHERE machine_id = ?
            ORDER BY time DESC LIMIT ?
            """,
            (machine_id, limit)
        )
    else:
        cursor.execute(
            """
            SELECT p.*, m.name as machine_name
            FROM predictions p
            JOIN machines m ON p.machine_id = m.id
            ORDER BY p.time DESC LIMIT ?
            """,
            (limit,)
        )
    predictions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return predictions

# Simulation state management
def get_simulation_state(machine_id):
    """Get simulation state for a machine."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM simulation_state WHERE machine_id = ?", (machine_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_simulation_state(machine_id, scenario=None, speed=None, is_running=None, degradation_progress=None):
    """Update simulation state for a machine."""
    conn = get_db_connection()
    cursor = conn.cursor()

    updates = []
    params = []
    if scenario is not None:
        updates.append("scenario = ?")
        params.append(scenario)
    if speed is not None:
        updates.append("speed = ?")
        params.append(speed)
    if is_running is not None:
        updates.append("is_running = ?")
        params.append(1 if is_running else 0)
    if degradation_progress is not None:
        updates.append("degradation_progress = ?")
        params.append(degradation_progress)

    if updates:
        params.append(machine_id)
        cursor.execute(
            f"UPDATE simulation_state SET {', '.join(updates)} WHERE machine_id = ?",
            params
        )
        conn.commit()
    conn.close()

def init_simulation_state():
    """Initialize simulation state for all machines."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM machines")
    machines = cursor.fetchall()

    for m in machines:
        mid = m[0]
        # Check if simulation state exists
        cursor.execute("SELECT COUNT(*) FROM simulation_state WHERE machine_id = ?", (mid,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO simulation_state (machine_id, scenario, speed, is_running, degradation_progress) VALUES (?, 'NORMAL', 1, 0, 0.0)",
                (mid,)
            )

    conn.commit()
    conn.close()
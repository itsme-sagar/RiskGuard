-- Predictive Maintenance System Database Schema

CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    machine_type TEXT NOT NULL, -- 'CNC Machine' or '3D Printer'
    model TEXT NOT NULL,
    location TEXT NOT NULL,
    install_date TEXT NOT NULL,
    operational_status TEXT DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'CRITICAL'
    operating_hours REAL DEFAULT 0.0,
    threshold_sensitivity REAL DEFAULT 0.70, -- failure risk threshold
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL, -- ISO8601 string
    machine_id INTEGER NOT NULL,
    temperature REAL NOT NULL, -- °C
    vibration REAL NOT NULL, -- mm/s
    motor_current REAL NOT NULL, -- A
    rpm REAL NOT NULL, -- RPM
    operating_hours REAL NOT NULL, -- hours
    workload REAL NOT NULL, -- percentage 0-100
    FOREIGN KEY(machine_id) REFERENCES machines(id)
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL, -- ISO8601 string
    machine_id INTEGER NOT NULL,
    failure_probability REAL NOT NULL, -- 0.0 to 100.0
    predicted_status TEXT NOT NULL, -- 'NORMAL', 'WARNING', 'CRITICAL'
    model_version TEXT NOT NULL,
    feature_importance_json TEXT, -- JSON string mapping features to importance
    FOREIGN KEY(machine_id) REFERENCES machines(id)
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL, -- ISO8601 string
    machine_id INTEGER NOT NULL,
    previous_risk REAL NOT NULL,
    current_risk REAL NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    acknowledged INTEGER DEFAULT 0,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    issue TEXT NOT NULL,
    action TEXT NOT NULL,
    technician TEXT,
    notes TEXT,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
);

CREATE TABLE IF NOT EXISTS simulation_state (
    machine_id INTEGER PRIMARY KEY,
    scenario TEXT NOT NULL, -- 'NORMAL', 'GRADUAL_DEGRADATION', 'NEAR_FAILURE'
    speed INTEGER DEFAULT 1, -- 1x, 5x, 10x
    is_running INTEGER DEFAULT 0,
    degradation_progress REAL DEFAULT 0.0,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON sensor_readings(time);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_machine_id ON sensor_readings(machine_id);
CREATE INDEX IF NOT EXISTS idx_predictions_time ON predictions(time);
CREATE INDEX IF NOT EXISTS idx_predictions_machine_id ON predictions(machine_id);
CREATE INDEX IF NOT EXISTS idx_alerts_machine_id ON alerts(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_machine_id ON maintenance_records(machine_id);
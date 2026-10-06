import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CircleGauge,
  Clock3,
  Cpu,
  Droplets,
  Gauge,
  Printer,
  RefreshCw,
  Sliders,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";
import API from "../services/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import "./Dashboard.css";

const DEFAULT_CONTROLS = {
  temperature: 64,
  vibration: 1.3,
  motor_current: 6.2,
  torque: 4.0,
  rpm: 3300,
  workload: 55,
  operating_hours: 540,
  cooling_efficiency: 0.82,
};

const isPrinterType = (machineType) =>
  String(machineType || "").toLowerCase().includes("printer") ||
  String(machineType || "").toLowerCase().includes("3d");

const numericValue = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function controlsForMachine(machine) {
  if (!machine) return DEFAULT_CONTROLS;
  const values = machine.current_values || {};
  const setpoints = values.control_values || {};
  const base = (field, storedField, fallback) =>
    numericValue(setpoints[field] ?? machine[storedField] ?? values[field], fallback);

  if (isPrinterType(machine.machine_type)) {
    return {
      temperature: base("temperature", "base_temperature", 205),
      bed_temperature: numericValue(setpoints.bed_temperature ?? values.bed_temperature, 58),
      extruder_motor_current: base("extruder_motor_current", "base_motor_current", 2.3),
      extruder_torque: base("extruder_torque", "base_torque", 1.8),
      print_speed: numericValue(setpoints.print_speed ?? values.print_speed, 62),
      vibration: base("vibration", "base_vibration", 0.9),
      workload: numericValue(setpoints.workload ?? machine.workload ?? values.workload, 58),
      operating_hours: numericValue(setpoints.operating_hours ?? machine.operating_hours ?? values.operating_hours, 310),
      cooling_efficiency: numericValue(setpoints.cooling_efficiency ?? machine.cooling_efficiency ?? values.cooling_efficiency, 0.84),
    };
  }

  return {
    temperature: base("temperature", "base_temperature", DEFAULT_CONTROLS.temperature),
    vibration: base("vibration", "base_vibration", DEFAULT_CONTROLS.vibration),
    motor_current: base("motor_current", "base_motor_current", DEFAULT_CONTROLS.motor_current),
    torque: base("torque", "base_torque", DEFAULT_CONTROLS.torque),
    rpm: base("rpm", "base_rpm", DEFAULT_CONTROLS.rpm),
    workload: numericValue(setpoints.workload ?? machine.workload ?? values.workload, DEFAULT_CONTROLS.workload),
    operating_hours: numericValue(setpoints.operating_hours ?? machine.operating_hours ?? values.operating_hours, DEFAULT_CONTROLS.operating_hours),
    cooling_efficiency: numericValue(setpoints.cooling_efficiency ?? machine.cooling_efficiency ?? values.cooling_efficiency, DEFAULT_CONTROLS.cooling_efficiency),
  };
}

const CNC_CONTROLS = [
  ["temperature", "Spindle Temperature", "°C"],
  ["vibration", "Axis Vibration", "mm/s"],
  ["motor_current", "Motor Current", "A"],
  ["torque", "Cutting Torque", "Nm"],
  ["rpm", "Spindle Speed", "RPM"],
  ["workload", "Workload Duty", "%"],
  ["operating_hours", "Operating Hours", "h"],
  ["cooling_efficiency", "Cooling Efficiency", "ratio"],
];

const PRINTER_CONTROLS = [
  ["temperature", "Nozzle Temperature", "°C"],
  ["bed_temperature", "Bed Temperature", "°C"],
  ["extruder_motor_current", "Extruder Current", "A"],
  ["extruder_torque", "Extruder Backpressure", "Nm"],
  ["print_speed", "Print Speed", "mm/s"],
  ["vibration", "Gantry Vibration", "mm/s"],
  ["workload", "Workload Duty", "%"],
  ["operating_hours", "Operating Hours", "h"],
  ["cooling_efficiency", "Cooling Efficiency", "ratio"],
];

function MachinesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMachineId = searchParams.get("machineId") || "CNC-001";

  const [machines, setMachines] = useState([]);
  const [machineReadings, setMachineReadings] = useState([]);
  const [machineAlerts, setMachineAlerts] = useState([]);
  const [machineMaintenance, setMachineMaintenance] = useState([]);
  const [dataRevision, setDataRevision] = useState(0);

  const [selectedMachineId, setSelectedMachineId] = useState(requestedMachineId);
  const [selectedMachineType, setSelectedMachineType] = useState("CNC");
  const [selectedMode, setSelectedMode] = useState("NORMAL");
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(false);
  const [showAddMachine, setShowAddMachine] = useState(false);

  const [newMachine, setNewMachine] = useState({
    machine_id: "",
    machine_name: "",
    machine_type: "CNC",
    manufacturer: "",
    model: "",
    installation_date: new Date().toISOString().slice(0, 10),
    operating_hours: 0,
    workload: 55,
    cooling_efficiency: 0.82,
    base_temperature: 64,
    base_vibration: 1.3,
    base_motor_current: 6.2,
    base_torque: 4.0,
    base_rpm: 3300,
    base_bed_temperature: 58,
    base_print_speed: 62,
    maintenance_interval: 180,
    status: "NORMAL",
  });

  const loadMachinesList = useCallback(async (preferredId = selectedMachineId) => {
    try {
      const response = await API.get("/machines");
      const list = response.data || [];
      setMachines(list);

      if (list.length > 0) {
        const found = list.find((m) => m.machine_id === preferredId) || list[0];
        setSelectedMachineId(found.machine_id);
        setSelectedMachineType(found.machine_type);
        setSelectedMode(found.mode || "NORMAL");
        setControls(controlsForMachine(found));
      }
    } catch (err) {
      console.error("Failed to load machines:", err);
    }
  }, [selectedMachineId]);

  useEffect(() => {
    loadMachinesList(requestedMachineId);
  }, [requestedMachineId, loadMachinesList]);

  // Sync selected machine to URL query param
  const handleSelectMachine = (machineId) => {
    setSelectedMachineId(machineId);
    setSearchParams({ machineId });
    const machine = machines.find((item) => item.machine_id === machineId);
    if (machine) {
      setSelectedMachineType(machine.machine_type || "CNC");
      setSelectedMode(machine.mode || "NORMAL");
      setControls(controlsForMachine(machine));
    }
  };

  useEffect(() => {
    if (!selectedMachineId) return;
    let isCurrent = true;

    const loadDetails = async () => {
      try {
        const [readingsRes, alertsRes, maintRes] = await Promise.all([
          API.get(`/machines/${selectedMachineId}/readings`),
          API.get(`/machines/${selectedMachineId}/alerts`),
          API.get(`/machines/${selectedMachineId}/maintenance`),
        ]);
        if (!isCurrent) return;
        setMachineReadings(readingsRes.data || []);
        setMachineAlerts(alertsRes.data || []);
        setMachineMaintenance(maintRes.data || []);
      } catch (err) {
        console.error("Machine details load error:", err);
      }
    };

    loadDetails();
    return () => {
      isCurrent = false;
    };
  }, [selectedMachineId, dataRevision]);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.machine_id === selectedMachineId) || machines[0],
    [machines, selectedMachineId]
  );

  const printerSelected = isPrinterType(selectedMachineType);
  const currentValues = selectedMachine?.current_values || {};
  const machineRisk = Number(currentValues.failure_risk ?? selectedMachine?.failure_risk ?? 0);
  const machineHealth = Number(currentValues.health_score ?? selectedMachine?.health_score ?? 0);
  const machineCondition = String(
    currentValues.condition || currentValues.status || selectedMachine?.status || "NORMAL"
  ).toUpperCase();

  const chartData = useMemo(
    () =>
      (machineReadings || [])
        .slice()
        .reverse()
        .map((reading) => {
          const vals = reading.values || {};
          return {
            time: new Date(reading.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            temperature: vals.temperature ?? vals.nozzle_temperature ?? 0,
            bedTemperature: vals.bed_temperature ?? 0,
            vibration: vals.vibration ?? 0,
            current: vals.motor_current ?? vals.extruder_motor_current ?? 0,
            torque: vals.torque ?? vals.extruder_torque ?? 0,
            rpm: vals.rpm ?? 0,
            printSpeed: vals.print_speed ?? 0,
            workload: vals.workload ?? 0,
            risk: vals.failure_risk ?? 0,
            health: vals.health_score ?? 100,
          };
        }),
    [machineReadings]
  );

  const vitalDefinitions = printerSelected
    ? [
        { label: "Nozzle Temperature", value: currentValues.temperature ?? currentValues.nozzle_temperature, unit: "°C", series: "temperature", color: "#2563eb", icon: Thermometer },
        { label: "Bed Temperature", value: currentValues.bed_temperature, unit: "°C", series: "bedTemperature", color: "#2563eb", icon: Thermometer },
        { label: "Extruder Current", value: currentValues.extruder_motor_current, unit: "A", series: "current", color: "#2563eb", icon: Zap },
        { label: "Extruder Backpressure", value: currentValues.extruder_torque, unit: "Nm", series: "torque", color: "#2563eb", icon: CircleGauge },
        { label: "Print Speed", value: currentValues.print_speed, unit: "mm/s", series: "printSpeed", color: "#2563eb", icon: Gauge },
        { label: "Operating Workload", value: currentValues.workload, unit: "%", series: "workload", color: "#2563eb", icon: Activity },
      ]
    : [
        { label: "Spindle Temperature", value: currentValues.temperature, unit: "°C", series: "temperature", color: "#2563eb", icon: Thermometer },
        { label: "Axis Vibration", value: currentValues.vibration, unit: "mm/s", series: "vibration", color: "#2563eb", icon: Activity },
        { label: "Motor Current", value: currentValues.motor_current, unit: "A", series: "current", color: "#2563eb", icon: Zap },
        { label: "Cutting Torque", value: currentValues.torque, unit: "Nm", series: "torque", color: "#2563eb", icon: CircleGauge },
        { label: "Spindle RPM", value: currentValues.rpm, unit: "rpm", series: "rpm", color: "#2563eb", icon: Gauge },
        { label: "Operating Workload", value: currentValues.workload, unit: "%", series: "workload", color: "#2563eb", icon: Activity },
      ];

  const updateField = (field, value) => {
    setControls((prev) => ({ ...prev, [field]: value }));
  };

  const applySimulation = async () => {
    setLoading(true);
    try {
      const overrides = printerSelected
        ? {
            temperature: Number(controls.temperature),
            bed_temperature: Number(controls.bed_temperature),
            vibration: Number(controls.vibration),
            extruder_motor_current: Number(controls.extruder_motor_current),
            extruder_torque: Number(controls.extruder_torque),
            print_speed: Number(controls.print_speed),
            workload: Number(controls.workload),
            operating_hours: Number(controls.operating_hours),
            cooling_efficiency: Number(controls.cooling_efficiency),
          }
        : {
            temperature: Number(controls.temperature),
            vibration: Number(controls.vibration),
            motor_current: Number(controls.motor_current),
            torque: Number(controls.torque),
            rpm: Number(controls.rpm),
            workload: Number(controls.workload),
            operating_hours: Number(controls.operating_hours),
            cooling_efficiency: Number(controls.cooling_efficiency),
          };

      const payload = {
        machine_id: selectedMachineId,
        machine_type: selectedMachineType,
        mode: selectedMode,
        overrides,
      };

      const res = await API.post("/simulate", payload);
      if (res.data) {
        await loadMachinesList(selectedMachineId);
        setDataRevision((rev) => rev + 1);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMachine = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...newMachine,
        machine_id: String(newMachine.machine_id).trim(),
        machine_name: String(newMachine.machine_name || newMachine.machine_id).trim(),
        machine_type: newMachine.machine_type,
        manufacturer: newMachine.manufacturer || "Standard",
        model: newMachine.model || "Production",
        operating_hours: Number(newMachine.operating_hours || 0),
        workload: Number(newMachine.workload || 50),
        cooling_efficiency: Number(newMachine.cooling_efficiency || 0.8),
        base_temperature: Number(newMachine.base_temperature || 64),
        base_vibration: Number(newMachine.base_vibration || 1.3),
        base_motor_current: Number(newMachine.base_motor_current || 6.2),
        base_torque: Number(newMachine.base_torque || 4),
        base_rpm: Number(newMachine.base_rpm || 3300),
        base_bed_temperature: Number(newMachine.base_bed_temperature || 58),
        base_print_speed: Number(newMachine.base_print_speed || 62),
        maintenance_interval: Number(newMachine.maintenance_interval || 180),
      };

      const res = await API.post("/machines", payload);
      if (res.data?.success) {
        setShowAddMachine(false);
        await loadMachinesList(payload.machine_id);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Unable to register machine.");
    }
  };

  const hasTrendData = chartData.length > 0;

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Machine Diagnostics & Simulation"
        subtitle="Individual asset telemetry analysis, setpoint tuning, and predictive stress simulation."
      />

      {/* Control & Overview Grid */}
      <div className="dashboard-overview-grid">
        {/* Simulation Control Deck */}
        <div className="dashboard-panel simulation-panel">
          <div className="panel-heading-row">
            <div>
              <span className="dashboard-kicker">INDIVIDUAL ASSET WORKBENCH</span>
              <h3>Simulation Controls</h3>
            </div>
            <span className="selected-machine-tag">
              {selectedMachine?.machine_id || "No machine selected"}
            </span>
          </div>

          <div className="simulation-selectors">
            <label>
              <div>Target Asset</div>
              <select
                value={selectedMachineId}
                onChange={(e) => handleSelectMachine(e.target.value)}
              >
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.machine_id} ({m.machine_type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div>Simulation Mode</div>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
              >
                {["NORMAL", "GRADUAL_DEGRADATION", "NEAR_FAILURE", "FAILURE"].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="simulation-controls">
            {(printerSelected ? PRINTER_CONTROLS : CNC_CONTROLS).map(([field, label, unit]) => (
              <label key={field}>
                <div>
                  {label} <span>{unit}</span>
                </div>
                <input
                  type="number"
                  value={controls[field] ?? 0}
                  min={0}
                  max={field === "cooling_efficiency" ? 1 : field === "workload" ? 100 : 10000}
                  step={
                    field === "cooling_efficiency"
                      ? 0.01
                      : ["vibration", "extruder_torque"].includes(field)
                      ? 0.1
                      : 1
                  }
                  onChange={(e) => updateField(field, Number(e.target.value))}
                />
              </label>
            ))}
          </div>

          <div className="simulation-actions">
            <button
              className="dashboard-primary-button"
              onClick={applySimulation}
              disabled={loading || !selectedMachineId}
            >
              {loading ? "Updating State..." : "Apply Simulation Step"}
            </button>
            <button
              className="dashboard-secondary-button"
              onClick={() => setShowAddMachine(true)}
            >
              + Add Machine
            </button>
            <button
              className="dashboard-quiet-button"
              onClick={async () => {
                setLoading(true);
                try {
                  await loadMachinesList(selectedMachineId);
                  setDataRevision((rev) => rev + 1);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <RefreshCw size={13} style={{ display: "inline", marginRight: 4 }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Selected Machine Health & Condition */}
        <div className="dashboard-panel health-panel">
          <div className="health-panel-heading">
            <span className="dashboard-kicker">HEALTH & DEGRADATION INDEX</span>
            <h2>{selectedMachine?.machine_id || selectedMachineId}</h2>
          </div>
          <div className="health-machine-identity">
            <strong>{selectedMachine?.machine_name || selectedMachine?.machine_id}</strong>
            <span>
              {selectedMachine?.machine_type} • {selectedMachine?.manufacturer || "Industrial OEM"} ({selectedMachine?.model || "V1"})
            </span>
          </div>

          <div className="health-meter">
            <div className="health-meter-label">
              <span>Asset Health Score</span>
              <strong>
                {machineHealth}
                <small>/100</small>
              </strong>
            </div>
            <div className="health-meter-track">
              <span
                className="health-meter-fill health-fill"
                style={{ width: `${machineHealth}%` }}
              />
            </div>
          </div>

          <div className="health-meter">
            <div className="health-meter-label">
              <span>Failure Probability</span>
              <strong>
                {machineRisk}
                <small>%</small>
              </strong>
            </div>
            <div className="health-meter-track">
              <span
                className="health-meter-fill risk-fill"
                style={{ width: `${machineRisk}%` }}
              />
            </div>
          </div>

          <div className="health-condition-row">
            <span>Machine Condition</span>
            <StatusBadge status={machineCondition} />
          </div>

          <div className="vitals-support-values" style={{ marginTop: 8 }}>
            <span>
              <Clock3 size={13} /> Hours: <strong>{currentValues.operating_hours ?? "--"} h</strong>
            </span>
            <span>
              <Droplets size={13} /> Cooling:{" "}
              <strong>
                {currentValues.cooling_efficiency != null
                  ? `${Math.round(currentValues.cooling_efficiency * 100)}%`
                  : "--"}
              </strong>
            </span>
            <span>
              <Activity size={13} /> Workload:{" "}
              <strong>{currentValues.workload ?? "--"}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Live Machine Vitals Grid */}
      <section className="dashboard-panel live-vitals-panel">
        <div className="panel-heading-row vitals-heading">
          <div>
            <span className="dashboard-kicker">STREAMING TELEMETRY</span>
            <h2>Real-Time Machine Vitals</h2>
          </div>
          <div className="vitals-machine-info">
            <span>{printerSelected ? <Printer size={15} /> : <Wrench size={15} />}</span>
            <strong>{selectedMachine?.machine_id}</strong>
            <StatusBadge status={machineCondition} className="machine-condition" />
          </div>
        </div>

        <div className="vitals-grid">
          {vitalDefinitions.map((vital) => {
            const Icon = vital.icon;
            const val = Number.isFinite(Number(vital.value)) ? Number(vital.value) : null;
            return (
              <article className="vital-card" key={vital.label} style={{ "--vital-color": vital.color }}>
                <div className="vital-card-heading">
                  <span>{vital.label}</span>
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div className="vital-reading">
                  {val === null ? "--" : val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <small>{vital.unit}</small>
                </div>
                <div className="vital-sparkline">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <Line
                          type="monotone"
                          dataKey={vital.series}
                          stroke={vital.color}
                          strokeWidth={2}
                          dot={chartData.length === 1}
                          isAnimationActive={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <span>No readings</span>
                  )}
                </div>
                <div className="vital-card-footer">
                  <span className={`vital-dot status-${machineCondition.toLowerCase()}`} />
                  {machineCondition}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Historical Trend Charts */}
      <div className="dashboard-charts-grid">
        <div className="dashboard-panel trend-panel">
          <h3 className="dashboard-chart-title">Temperature & Vibration Trend</h3>
          {hasTrendData ? (
            <div className="dashboard-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="mfgTempFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rg-border)" />
                  <XAxis dataKey="time" stroke="var(--rg-text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--rg-text-secondary)" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#2563eb"
                    fill="url(#mfgTempFill)"
                    name="Temperature (°C)"
                  />
                  <Area
                    type="monotone"
                    dataKey="vibration"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.12}
                    name="Vibration (mm/s)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-chart-empty">No trend telemetry available yet.</div>
          )}
        </div>

        <div className="dashboard-panel trend-panel">
          <h3 className="dashboard-chart-title">Failure Risk & Health Score</h3>
          {hasTrendData ? (
            <div className="dashboard-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rg-border)" />
                  <XAxis dataKey="time" stroke="var(--rg-text-secondary)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="var(--rg-text-secondary)" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="#dc2626"
                    name="Failure Risk (%)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="health"
                    stroke="#16a34a"
                    name="Health Score (/100)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-chart-empty">No health trend recorded yet.</div>
          )}
        </div>
      </div>

      {/* Machine Context (Alerts & Maintenance) */}
      <section className="machine-context-grid">
        <div className="dashboard-panel context-panel">
          <div className="context-panel-heading">
            <div>
              <span className="dashboard-kicker">INCIDENT LOG</span>
              <h3>Active Machine Alerts</h3>
            </div>
            <span className="context-count">{machineAlerts.length}</span>
          </div>
          {machineAlerts.length === 0 ? (
            <p className="dashboard-empty-state">No alerts recorded for this machine.</p>
          ) : (
            <div className="context-list">
              {machineAlerts.slice(0, 4).map((alert) => (
                <article className="context-list-item" key={alert.id}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  <div>
                    <div className="context-item-title">
                      <strong>{alert.message || `${alert.level} alert`}</strong>
                      <span className={`alert-level level-${String(alert.level || "").toLowerCase()}`}>
                        {alert.level}
                      </span>
                    </div>
                    <p>{alert.reason}</p>
                    <small>
                      {alert.created_at
                        ? new Date(alert.created_at).toLocaleString()
                        : "Timestamp unavailable"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-panel context-panel">
          <div className="context-panel-heading">
            <div>
              <span className="dashboard-kicker">SERVICE & REPAIR</span>
              <h3>Maintenance History</h3>
            </div>
            <Wrench size={17} aria-hidden="true" />
          </div>
          {machineMaintenance.length === 0 ? (
            <p className="dashboard-empty-state">No service records for this machine.</p>
          ) : (
            <div className="context-list">
              {machineMaintenance.slice(0, 4).map((record) => (
                <article className="maintenance-list-item" key={record.id}>
                  <div className="maintenance-item-top">
                    <strong>{record.maintenance_type || "Maintenance"}</strong>
                    <span>{record.status || "Recorded"}</span>
                  </div>
                  <p>{record.problem || record.description || "Service record"}</p>
                  <div className="maintenance-item-meta">
                    <span>{record.technician || "Technician not listed"}</span>
                    <span>
                      {record.repair_date ||
                        record.repaired_at ||
                        record.created_at ||
                        "Date unavailable"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Add Machine Modal */}
      {showAddMachine && (
        <div
          className="machine-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddMachine(false);
          }}
        >
          <div className="machine-modal">
            <div className="machine-modal-heading">
              <div>
                <span className="dashboard-kicker">ASSET MANAGEMENT</span>
                <h2>Register Machine</h2>
              </div>
              <button
                className="dashboard-quiet-button"
                onClick={() => setShowAddMachine(false)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleAddMachine} className="machine-add-form">
              <label>
                <div>Machine ID</div>
                <input
                  required
                  value={newMachine.machine_id}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, machine_id: e.target.value }))
                  }
                  style={fieldStyle}
                  placeholder="e.g. CNC-005"
                />
              </label>
              <label>
                <div>Machine Name</div>
                <input
                  value={newMachine.machine_name}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, machine_name: e.target.value }))
                  }
                  style={fieldStyle}
                  placeholder="e.g. 5-Axis Milling Center"
                />
              </label>
              <label>
                <div>Machine Type</div>
                <select
                  value={newMachine.machine_type}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, machine_type: e.target.value }))
                  }
                  style={fieldStyle}
                >
                  <option value="CNC">CNC Machine</option>
                  <option value="3D Printer">3D Printer</option>
                </select>
              </label>
              <label>
                <div>Manufacturer</div>
                <input
                  value={newMachine.manufacturer}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, manufacturer: e.target.value }))
                  }
                  style={fieldStyle}
                  placeholder="e.g. Haas, DMG Mori, Prusa"
                />
              </label>
              <label>
                <div>Model</div>
                <input
                  value={newMachine.model}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, model: e.target.value }))
                  }
                  style={fieldStyle}
                />
              </label>
              <label>
                <div>Operating Hours</div>
                <input
                  type="number"
                  value={newMachine.operating_hours}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, operating_hours: e.target.value }))
                  }
                  style={fieldStyle}
                />
              </label>
              <div className="machine-add-actions">
                <button
                  type="button"
                  className="dashboard-quiet-button"
                  onClick={() => setShowAddMachine(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-primary-button">
                  Save Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--rg-input-border)",
  color: "var(--rg-input-text)",
  background: "var(--rg-input-bg)",
  boxSizing: "border-box",
};

export default MachinesPage;

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  Cpu,
  Filter,
  Plus,
  Printer,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import API from "../services/api";
import HealthCard from "../components/HealthCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [machines, setMachines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    total_machines: 0,
    cnc_machines: 0,
    printer_machines: 0,
    normal_machines: 0,
    warning_machines: 0,
    critical_machines: 0,
    failed_machines: 0,
    average_machine_health: 0,
    average_failure_risk: 0,
    active_alerts: 0,
  });

  const [typeFilter, setTypeFilter] = useState("ALL");
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

  const loadDashboardData = useCallback(async () => {
    try {
      const [machineRes, summaryRes, alertRes] = await Promise.all([
        API.get("/machines"),
        API.get("/dashboard/summary"),
        API.get("/alerts"),
      ]);
      setMachines(machineRes.data || []);
      setSummary(summaryRes.data || {});
      setAlerts(alertRes.data || []);
    } catch (err) {
      console.error("Dashboard fleet data load error:", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchAll = () => {
      if (active) loadDashboardData();
    };
    fetchAll();
    const interval = setInterval(fetchAll, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  // Navigate directly to Machines page for a specific asset
  const handleInspectMachine = (machineId) => {
    navigate(`/machines?machineId=${encodeURIComponent(machineId)}`);
  };

  // Filtered Machines List
  const filteredMachines = useMemo(() => {
    if (typeFilter === "CNC") {
      return machines.filter((m) =>
        String(m.machine_type).toUpperCase().includes("CNC")
      );
    }
    if (typeFilter === "PRINTER") {
      return machines.filter((m) =>
        String(m.machine_type).toLowerCase().includes("printer")
      );
    }
    if (typeFilter === "ISSUES") {
      return machines.filter((m) => {
        const s = String(m.status || m.current_values?.status || "").toUpperCase();
        return ["WARNING", "CRITICAL", "FAILED"].includes(s);
      });
    }
    return machines;
  }, [machines, typeFilter]);

  // Fleet Health Distribution Pie Data
  const pieData = useMemo(() => {
    return [
      { name: "Normal", value: summary.normal_machines || 0, color: "#16a34a" },
      { name: "Warning", value: summary.warning_machines || 0, color: "#f59e0b" },
      { name: "Critical", value: summary.critical_machines || 0, color: "#dc2626" },
      { name: "Failed", value: summary.failed_machines || 0, color: "#7f1d1d" },
    ].filter((item) => item.value > 0);
  }, [summary]);

  // Fleet Risk Comparison Bar Data
  const fleetRiskData = useMemo(() => {
    return machines.map((m) => {
      const risk = Number(m.current_values?.failure_risk ?? m.failure_risk ?? 0);
      const health = Number(m.current_values?.health_score ?? m.health_score ?? 100);
      const status = String(m.status || m.current_values?.status || "NORMAL").toUpperCase();
      return {
        id: m.serial_number || m.machine_id,
        name: m.machine_name || m.name || m.machine_id,
        type: m.machine_type,
        risk,
        health,
        status,
      };
    });
  }, [machines]);

  const handleAddMachine = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newMachine,
        machine_id: String(newMachine.machine_id).trim(),
        machine_name: String(newMachine.machine_name || newMachine.machine_id).trim(),
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
        await loadDashboardData();
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Unable to add machine asset.");
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="page-header-copy">
          <h1>Fleet Operations & Health Overview</h1>
          <p>
            Real-time plant-wide machine telemetry, predictive failure risk monitoring, and asset health status.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="dashboard-primary-button"
            onClick={() => setShowAddMachine(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Fleet Summary KPI Row */}
      <div className="dashboard-summary-cards">
        <HealthCard
          title="Total Machines"
          value={summary.total_machines || machines.length}
          detail={`${summary.cnc_machines || 0} CNC · ${summary.printer_machines || 0} 3D Printers`}
          icon={Boxes}
        />
        <HealthCard
          title="Normal Condition"
          value={summary.normal_machines ?? machines.filter(m => (m.status || m.operational_status) === "NORMAL").length}
          detail="Operating nominal"
          icon={CheckCircle2}
        />
        <HealthCard
          title="Warning Condition"
          value={summary.warning_machines ?? machines.filter(m => (m.status || m.operational_status) === "WARNING").length}
          detail="Early parameter drift"
          icon={AlertTriangle}
        />
        <HealthCard
          title="Critical Condition"
          value={summary.critical_machines ?? machines.filter(m => ["CRITICAL", "FAILED"].includes((m.status || m.operational_status))).length}
          detail="Urgent maintenance needed"
          icon={ShieldCheck}
        />
        <HealthCard
          title="Average Fleet Risk"
          value={`${summary.average_failure_risk || 0}%`}
          detail="Across all monitored units"
          icon={Activity}
        />
        <HealthCard
          title="Active Alerts"
          value={summary.active_alerts || alerts.length}
          detail="Pending operator review"
          icon={Bell}
        />
      </div>

      {/* Dedicated Fleet Health Overview Asset Cards */}
      <div className="dashboard-panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading-row" style={{ marginBottom: 14 }}>
          <div>
            <span className="dashboard-kicker">FLEET ASSET STATUS</span>
            <h3 className="dashboard-chart-title">Fleet Health & Telemetry Overview</h3>
          </div>
          <span style={{ fontSize: 12, color: "var(--rg-text-secondary)" }}>
            Live asset conditions updated continuously from digital twins
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {machines.map((m) => {
            const sn = m.serial_number || m.machine_id;
            const name = m.machine_name || m.name || sn;
            const type = m.machine_type || "CNC Machine";
            const status = String(m.status || m.operational_status || m.current_values?.status || "NORMAL").toUpperCase();
            const risk = Number(m.current_values?.failure_risk ?? m.failure_risk ?? 0);
            const health = Number(m.current_values?.health_score ?? m.health_score ?? 100);
            const isCNC = String(type).toUpperCase().includes("CNC");

            return (
              <div
                key={sn || m.id}
                style={{
                  border: "1px solid var(--rg-border)",
                  borderTop: `4px solid ${
                    status === "CRITICAL" || status === "FAILED"
                      ? "#dc2626"
                      : status === "WARNING"
                      ? "#f59e0b"
                      : "#16a34a"
                  }`,
                  borderRadius: 8,
                  padding: 14,
                  background: "var(--rg-card)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isCNC ? <Wrench size={14} style={{ color: "var(--rg-primary)" }} /> : <Printer size={14} style={{ color: "#9333ea" }} />}
                      <strong style={{ fontSize: 14 }}>{sn}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--rg-text-secondary)", marginTop: 2 }}>
                      {name} • {type}
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--rg-bg-subtle, rgba(255,255,255,0.03))", padding: "8px 10px", borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--rg-text-secondary)" }}>Failure Risk</div>
                    <strong style={{ fontSize: 14, color: risk > 70 ? "#dc2626" : risk > 40 ? "#f59e0b" : "#16a34a" }}>
                      {risk.toFixed(1)}%
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--rg-text-secondary)" }}>Health Score</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 14 }}>{health}/100</strong>
                    </div>
                  </div>
                </div>

                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--rg-border)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${health}%`,
                      height: "100%",
                      background: health > 70 ? "#16a34a" : health > 40 ? "#f59e0b" : "#dc2626",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="dashboard-secondary-button"
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      width: "100%",
                      justifyContent: "center",
                    }}
                    onClick={() => handleInspectMachine(sn)}
                  >
                    <span>View Machine</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fleet Analytics Charts Grid */}
      <div className="dashboard-charts-grid">
        {/* Fleet Risk Comparison Bar Chart */}
        <div className="dashboard-panel trend-panel">
          <div className="panel-heading-row" style={{ marginBottom: 14 }}>
            <div>
              <span className="dashboard-kicker">FLEET-WIDE RISK BENCHMARK</span>
              <h3 className="dashboard-chart-title">Machine Failure Risk Comparison (%)</h3>
            </div>
            <span style={{ fontSize: 11, color: "var(--rg-text-secondary)" }}>
              Click bar to inspect in Machines
            </span>
          </div>

          <div className="dashboard-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fleetRiskData}
                margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
                onClick={(state) => {
                  if (state && state.activePayload && state.activePayload[0]) {
                    handleInspectMachine(state.activePayload[0].payload.id);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rg-border)" vertical={false} />
                <XAxis dataKey="id" stroke="var(--rg-text-secondary)" fontSize={11} interval={0} angle={-25} textAnchor="end" />
                <YAxis domain={[0, 100]} stroke="var(--rg-text-secondary)" fontSize={11} unit="%" />
                <Tooltip
                  formatter={(val, name, item) => [
                    `${val}% Risk (${item.payload.status})`,
                    "Failure Risk",
                  ]}
                  labelFormatter={(id) => `Machine: ${id}`}
                />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Warning Threshold", fill: "#f59e0b", fontSize: 10, position: "top" }} />
                <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "Critical Threshold", fill: "#dc2626", fontSize: 10, position: "top" }} />
                <Bar dataKey="risk" name="Failure Risk (%)" radius={[4, 4, 0, 0]}>
                  {fleetRiskData.map((entry) => {
                    const color =
                      entry.status === "FAILED"
                        ? "#7f1d1d"
                        : entry.risk > 70
                        ? "#dc2626"
                        : entry.risk > 50
                        ? "#f59e0b"
                        : "#2563eb";
                    return <Cell key={entry.id} fill={color} cursor="pointer" />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Condition Breakdown Pie Chart */}
        <div className="dashboard-panel condition-panel">
          <div className="panel-heading-row" style={{ marginBottom: 14 }}>
            <div>
              <span className="dashboard-kicker">CONDITION HEALTH SPLIT</span>
              <h3 className="dashboard-chart-title">Fleet Status Distribution</h3>
            </div>
          </div>

          <div className="dashboard-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: "Normal", value: 1, color: "#16a34a" }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={82}
                  paddingAngle={3}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {(pieData.length > 0 ? pieData : [{ name: "Normal", value: 1, color: "#16a34a" }]).map(
                    (entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    )
                  )}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fleet Machine Table & Alerts Overview Grid */}
      <div className="dashboard-lower-grid">
        {/* Complete Machine Fleet Roster */}
        <div className="dashboard-panel machine-list-panel">
          <div className="panel-heading-row" style={{ marginBottom: 12 }}>
            <div>
              <span className="dashboard-kicker">OPERATIONAL ASSET ROSTER</span>
              <h3 className="dashboard-chart-title">Monitored Machine Fleet</h3>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Filter size={13} style={{ color: "var(--rg-text-secondary)" }} />
              <button
                type="button"
                className={`dashboard-quiet-button ${typeFilter === "ALL" ? "is-active" : ""}`}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: typeFilter === "ALL" ? "var(--rg-primary)" : "transparent",
                  color: typeFilter === "ALL" ? "#fff" : "inherit",
                }}
                onClick={() => setTypeFilter("ALL")}
              >
                All ({machines.length})
              </button>
              <button
                type="button"
                className={`dashboard-quiet-button ${typeFilter === "CNC" ? "is-active" : ""}`}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: typeFilter === "CNC" ? "var(--rg-primary)" : "transparent",
                  color: typeFilter === "CNC" ? "#fff" : "inherit",
                }}
                onClick={() => setTypeFilter("CNC")}
              >
                CNC
              </button>
              <button
                type="button"
                className={`dashboard-quiet-button ${typeFilter === "PRINTER" ? "is-active" : ""}`}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: typeFilter === "PRINTER" ? "var(--rg-primary)" : "transparent",
                  color: typeFilter === "PRINTER" ? "#fff" : "inherit",
                }}
                onClick={() => setTypeFilter("PRINTER")}
              >
                3D Printers
              </button>
              <button
                type="button"
                className={`dashboard-quiet-button ${typeFilter === "ISSUES" ? "is-active" : ""}`}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: typeFilter === "ISSUES" ? "#dc2626" : "transparent",
                  color: typeFilter === "ISSUES" ? "#fff" : "inherit",
                }}
                onClick={() => setTypeFilter("ISSUES")}
              >
                With Alerts
              </button>
            </div>
          </div>

          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Machine ID</th>
                  <th>Machine Name</th>
                  <th>Type</th>
                  <th>Health Score</th>
                  <th>Failure Risk</th>
                  <th>Status</th>
                  <th>Operating Hours</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map((machine) => {
                  const status = String(
                    machine.status || machine.current_values?.status || "NORMAL"
                  ).toUpperCase();
                  const risk = Number(
                    machine.current_values?.failure_risk ?? machine.failure_risk ?? 0
                  );
                  const health = Number(
                    machine.current_values?.health_score ?? machine.health_score ?? 100
                  );
                  const isCNC = String(machine.machine_type).toUpperCase().includes("CNC");

                  return (
                    <tr
                      key={machine.machine_id}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleInspectMachine(machine.machine_id)}
                      title={`Open ${machine.machine_id} in Machines workbench`}
                    >
                      <td>
                        <strong style={{ color: "var(--rg-primary)" }}>{machine.machine_id}</strong>
                      </td>
                      <td>{machine.machine_name || machine.machine_id}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: isCNC ? "rgba(37, 99, 235, 0.1)" : "rgba(147, 51, 234, 0.1)",
                            color: isCNC ? "#2563eb" : "#9333ea",
                          }}
                        >
                          {isCNC ? <Wrench size={11} /> : <Printer size={11} />}
                          {machine.machine_type}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong>{health}/100</strong>
                          <div
                            style={{
                              width: 50,
                              height: 6,
                              borderRadius: 3,
                              background: "var(--rg-border)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${health}%`,
                                height: "100%",
                                background: health > 70 ? "#16a34a" : health > 40 ? "#f59e0b" : "#dc2626",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong
                          style={{
                            color: risk > 70 ? "#dc2626" : risk > 40 ? "#f59e0b" : "#16a34a",
                          }}
                        >
                          {risk}%
                        </strong>
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        {machine.current_values?.operating_hours ?? machine.operating_hours ?? "--"} h
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="dashboard-secondary-button"
                          style={{
                            padding: "4px 10px",
                            fontSize: 11,
                            minHeight: 28,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectMachine(machine.machine_id);
                          }}
                        >
                          <span>Inspect</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Fleet Incident Alerts */}
        <div className="dashboard-panel global-alert-panel">
          <div className="panel-heading-row" style={{ marginBottom: 12 }}>
            <div>
              <span className="dashboard-kicker">FLEET INCIDENTS</span>
              <h3 className="dashboard-chart-title">Recent Fleet Alerts</h3>
            </div>
            <button
              type="button"
              className="dashboard-quiet-button"
              style={{ fontSize: 11, padding: "3px 8px" }}
              onClick={() => navigate("/alerts")}
            >
              View All ({alerts.length})
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="dashboard-chart-empty" style={{ padding: "30px 10px" }}>
              <CheckCircle2 size={24} style={{ color: "#16a34a", marginBottom: 6 }} />
              <div>All machines operating within normal nominal tolerances.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--rg-border)",
                    borderLeft: `3px solid ${
                      alert.level === "FAILED" || alert.level === "CRITICAL"
                        ? "#dc2626"
                        : "#f59e0b"
                    }`,
                    borderRadius: 6,
                    background: "var(--rg-card)",
                    cursor: "pointer",
                  }}
                  onClick={() => handleInspectMachine(alert.machine_id)}
                  title={`Inspect ${alert.machine_id}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 12 }}>{alert.machine_id}</strong>
                    <span
                      className={`alert-level level-${String(alert.level || "").toLowerCase()}`}
                      style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4 }}
                    >
                      {alert.level}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0", fontSize: 11, color: "var(--rg-text-secondary)" }}>
                    {alert.reason || alert.message}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--rg-muted)" }}>
                    <span>{alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : ""}</span>
                    <span style={{ color: "var(--rg-primary)", display: "flex", alignItems: "center", gap: 2 }}>
                      Inspect in Machines <ArrowRight size={10} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Register Machine Asset Modal */}
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
                <span className="dashboard-kicker">FLEET ASSET REGISTRATION</span>
                <h2>Register New Machine</h2>
              </div>
              <button
                type="button"
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
                  placeholder="e.g. CNC-004"
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
                  placeholder="e.g. Precision Lathe Center"
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
                  placeholder="e.g. Haas, Mazak, Prusa"
                />
              </label>
              <label>
                <div>Initial Workload (%)</div>
                <input
                  type="number"
                  value={newMachine.workload}
                  onChange={(e) =>
                    setNewMachine((prev) => ({ ...prev, workload: e.target.value }))
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
                  Save Machine Asset
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

export default Dashboard;
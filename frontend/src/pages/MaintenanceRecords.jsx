import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../services/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Wrench, CheckCircle2, Filter, AlertCircle, RefreshCw } from "lucide-react";
import "./Operations.css";

function MaintenanceRecords() {
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [machines, setMachines] = useState([]);
  const [filterMachine, setFilterMachine] = useState("ALL");
  const [saveBanner, setSaveBanner] = useState("");
  const [linkedAlertBanner, setLinkedAlertBanner] = useState("");

  const [form, setForm] = useState({
    machine_id: "",
    problem: "",
    maintenance_type: "Inspection",
    repair_date: new Date().toISOString().slice(0, 10),
    repair_time: new Date().toTimeString().slice(0, 5),
    technician: "Technician A",
    description: "",
    parts_replaced: "",
    cost: 0,
    status: "Completed",
    next_maintenance_date: "",
    notes: "",
  });

  const loadRecords = useCallback(async () => {
    try {
      const response = await API.get("/maintenance-records");
      setRecords(response.data || []);
    } catch (error) {
      console.error("Failed to load maintenance records:", error);
    }
  }, []);

  const loadMachines = useCallback(async () => {
    try {
      const response = await API.get("/machines");
      setMachines(response.data || []);
    } catch (error) {
      console.error("Failed to load machines:", error);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadMachines();
  }, [loadRecords, loadMachines]);

  // Handle URL query parameters for Alert -> Maintenance prefill
  useEffect(() => {
    const mid = searchParams.get("machine_id") || searchParams.get("machineId");
    const problemParam = searchParams.get("problem") || searchParams.get("issue") || searchParams.get("reason");
    const descParam = searchParams.get("description") || searchParams.get("action") || searchParams.get("recommendation");
    const typeParam = searchParams.get("maintenance_type") || searchParams.get("type");
    const techParam = searchParams.get("technician");
    const statusParam = searchParams.get("status");

    if (mid || problemParam || descParam) {
      setForm((prev) => ({
        ...prev,
        machine_id: mid || prev.machine_id,
        problem: problemParam || prev.problem || "Abnormal parameter variance detected",
        description: descParam || prev.description || "Inspect spindle/bearing assembly, recalibrate sensors, and verify lubrication.",
        maintenance_type: typeParam || "Repair",
        technician: techParam || prev.technician || "Senior Field Engineer",
        status: statusParam || "Completed",
        cost: prev.cost > 0 ? prev.cost : 1250,
        parts_replaced: prev.parts_replaced || "Spindle Bearing / High-Temp Lubricant",
      }));

      if (mid) {
        setLinkedAlertBanner(`Prefilled from Incident Alert for Asset: ${mid}. Complete the inspection and save the record.`);
      }
    }
  }, [searchParams]);

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaveBanner("");
    const payload = {
      ...form,
      machine_id: form.machine_id.trim(),
      problem: form.problem.trim() || "General maintenance",
      issue: form.problem.trim() || "General maintenance",
      description: form.description.trim() || "Routine service completed.",
      action: form.description.trim() || "Routine service completed.",
      cost: Number(form.cost || 0),
      repaired_at: `${form.repair_date}T${form.repair_time}:00`,
    };

    try {
      const response = await API.post("/maintenance", payload);
      if (response.data?.success) {
        await loadRecords();
        setSaveBanner(`Maintenance record for ${payload.machine_id} saved successfully to database.`);
        setLinkedAlertBanner("");
        setForm({
          machine_id: "",
          problem: "",
          maintenance_type: "Inspection",
          repair_date: new Date().toISOString().slice(0, 10),
          repair_time: new Date().toTimeString().slice(0, 5),
          technician: "Technician A",
          description: "",
          parts_replaced: "",
          cost: 0,
          status: "Completed",
          next_maintenance_date: "",
          notes: "",
        });
        setTimeout(() => setSaveBanner(""), 5000);
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Unable to save maintenance record.");
    }
  };

  // Filtered maintenance history records
  const filteredRecords = useMemo(() => {
    if (filterMachine === "ALL") return records;
    return records.filter((r) => {
      const mid = String(r.machine_id || "").toUpperCase();
      const sn = String(r.serial_number || "").toUpperCase();
      const name = String(r.machine_name || "").toUpperCase();
      const match = filterMachine.toUpperCase();
      return mid === match || sn === match || name.includes(match);
    });
  }, [records, filterMachine]);

  return (
    <div className="operations-page">
      <PageHeader
        title="Maintenance Records & Service History"
        subtitle="Log corrective actions, track field technician repairs, and view comprehensive machine maintenance logs."
      />

      {/* Linked Incident Banner */}
      {linkedAlertBanner && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "var(--rg-radius-sm)",
            background: "rgba(37, 99, 235, 0.12)",
            color: "var(--rg-primary)",
            fontSize: "13px",
            fontWeight: 600,
            border: "1px solid rgba(37, 99, 235, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Wrench size={16} />
          <span>{linkedAlertBanner}</span>
        </div>
      )}

      {/* Save Success Banner */}
      {saveBanner && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "var(--rg-radius-sm)",
            background: "rgba(22, 163, 74, 0.15)",
            color: "#16a34a",
            fontSize: "13px",
            fontWeight: 600,
            border: "1px solid rgba(22, 163, 74, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* Add Maintenance Record Form */}
      <section className="operations-section">
        <div className="operations-section-heading">
          <div>
            <span className="operations-eyebrow">CORRECTIVE & PREVENTIVE WORKFLOW</span>
            <h2>Log Maintenance Action</h2>
          </div>
        </div>
        <form className="maintenance-form" onSubmit={saveRecord}>
          <label className="operations-field">
            <span>Machine Asset ID / Serial</span>
            <input
              required
              placeholder="e.g. CNC-001, 3DP-IND-02"
              value={form.machine_id}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Observed Problem / Symptom</span>
            <input
              placeholder="e.g. Spindle bearing temperature elevated"
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Maintenance Type</span>
            <select
              value={form.maintenance_type}
              onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
            >
              <option>Repair</option>
              <option>Inspection</option>
              <option>Preventive</option>
              <option>Calibration</option>
            </select>
          </label>
          <label className="operations-field">
            <span>Technician / Engineer</span>
            <input
              value={form.technician}
              onChange={(e) => setForm({ ...form, technician: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Repair Date</span>
            <input
              type="date"
              value={form.repair_date}
              onChange={(e) => setForm({ ...form, repair_date: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Repair Time</span>
            <input
              type="time"
              value={form.repair_time}
              onChange={(e) => setForm({ ...form, repair_time: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Parts Replaced</span>
            <input
              placeholder="e.g. Bearing assembly, Filter"
              value={form.parts_replaced}
              onChange={(e) => setForm({ ...form, parts_replaced: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Cost (INR)</span>
            <input
              type="number"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </label>
          <label className="operations-field">
            <span>Record Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>Completed</option>
              <option>In Progress</option>
              <option>Pending</option>
              <option>Open</option>
            </select>
          </label>
          <label className="operations-field">
            <span>Next Scheduled Service</span>
            <input
              type="date"
              value={form.next_maintenance_date}
              onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })}
            />
          </label>
          <label className="operations-field operations-field-wide">
            <span>Action Taken / Work Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows="3"
              placeholder="Details of the corrective repair, part replacement, or calibration performed..."
            />
          </label>
          <label className="operations-field operations-field-wide">
            <span>Technician Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows="2"
              placeholder="Additional findings, post-maintenance sensor readings, or follow-up recommendations..."
            />
          </label>
          <div className="operations-form-actions">
            <button className="button-primary" type="submit">
              <Wrench size={14} style={{ marginRight: 6 }} />
              Save Maintenance Record
            </button>
          </div>
        </form>
      </section>

      {/* Maintenance History Section */}
      <section className="operations-section">
        <div className="operations-section-heading">
          <div>
            <span className="operations-eyebrow">AUDIT & SERVICE HISTORY</span>
            <h2>Maintenance History Log</h2>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} style={{ color: "var(--rg-text-secondary)" }} />
              <select
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--rg-radius-sm)",
                  border: "1px solid var(--rg-input-border)",
                  background: "var(--rg-input-bg)",
                  color: "var(--rg-input-text)",
                  fontSize: "12px",
                }}
              >
                <option value="ALL">All Machines</option>
                {machines.map((m) => (
                  <option key={m.serial_number || m.id} value={m.serial_number || m.id}>
                    {m.serial_number || m.name} ({m.name})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="button-secondary"
              onClick={loadRecords}
              style={{ padding: "6px 10px", fontSize: "12px" }}
              title="Refresh records"
            >
              <RefreshCw size={13} />
            </button>
            <span className="operations-record-count">{filteredRecords.length} records</span>
          </div>
        </div>

        <div className="operations-table-scroll">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Machine Asset</th>
                <th>Observed Issue</th>
                <th>Type</th>
                <th>Repair Date</th>
                <th>Time</th>
                <th>Technician</th>
                <th>Action Taken</th>
                <th>Parts Replaced</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Next Service</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.serial_number || record.machine_id}</strong>
                    <small>{record.machine_name || record.machine_type || "CNC Machine"}</small>
                  </td>
                  <td>{record.problem || record.issue}</td>
                  <td>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        background:
                          record.maintenance_type === "Repair"
                            ? "rgba(220, 38, 38, 0.1)"
                            : "rgba(37, 99, 235, 0.1)",
                        color:
                          record.maintenance_type === "Repair" ? "#dc2626" : "var(--rg-primary)",
                      }}
                    >
                      {record.maintenance_type || "Inspection"}
                    </span>
                  </td>
                  <td>{record.repair_date || record.repaired_at || "—"}</td>
                  <td>{record.repair_time || "—"}</td>
                  <td>{record.technician || "Technician"}</td>
                  <td>{record.description || record.action || "—"}</td>
                  <td>{record.parts_replaced || "—"}</td>
                  <td>₹{Number(record.cost || 0).toLocaleString("en-IN")}</td>
                  <td>
                    <StatusBadge status={record.status || "Completed"} />
                  </td>
                  <td>{record.next_maintenance_date || "—"}</td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td className="operations-empty" colSpan="11">
                    No maintenance records found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MaintenanceRecords;

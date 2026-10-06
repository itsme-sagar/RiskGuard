import { useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API from "../services/api";
import PageHeader from "../components/PageHeader";
import "./UploadData.css";

const chartDefinitions = [
  ["temperature", "Temperature", "°C", "#d45c43"],
  ["vibration", "Vibration", "mm/s", "#4977a8"],
  ["motor_current", "Motor Current", "A", "#398675"],
  ["torque", "Torque", "Nm", "#b17b31"],
  ["rpm", "RPM", "rpm", "#735e9b"],
  ["workload", "Workload", "%", "#4d8091"],
  ["failure_risk", "Failure Risk", "%", "#c14f4f"],
  ["health_score", "Machine Health", "/100", "#4c8b61"],
];

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function UploadData() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");

  const chooseFile = (nextFile) => {
    if (!nextFile) return;
    setError("");
    setAnalysis(null);
    setSelectedMachineId("");
    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Choose a .csv file to analyze.");
      return;
    }
    if (nextFile.size === 0) {
      setFile(null);
      setError("The selected CSV file is empty.");
      return;
    }
    setFile(nextFile);
  };

  const uploadCSV = async () => {
    if (!file) {
      setError("Choose a CSV file before analyzing.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await API.post("/predict-batch", formData);
      setAnalysis(response.data);
      setSelectedMachineId(response.data.machines?.[0]?.machine_id || "");
    } catch (uploadError) {
      console.error("CSV analysis failed:", uploadError);
      const detail = uploadError.response?.data?.detail || uploadError.response?.data?.message;
      if (detail) {
        setError(`Upload failed${uploadError.response?.status ? ` (${uploadError.response.status})` : ""}: ${detail}`);
      } else if (uploadError.code === "ERR_NETWORK") {
        setError(`Network error while uploading to ${API.defaults.baseURL}. Check that the backend is running, this frontend origin is allowed by CORS, and the selected file is still accessible.`);
      } else {
        setError(`Upload failed${uploadError.response?.status ? ` (${uploadError.response.status})` : ""}: ${uploadError.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const machines = analysis?.machines || [];
  const query = search.trim().toLowerCase();
  const visibleMachines = machines.filter((machine) =>
    [machine.machine_id, machine.machine_name, machine.machine_type]
      .some((value) => String(value || "").toLowerCase().includes(query)),
  );
  const selectedMachine = machines.find((machine) => machine.machine_id === selectedMachineId);
  const latest = selectedMachine?.latest_values;
  const summary = analysis?.summary;

  return (
    <section className="upload-page">
      <PageHeader title="Upload & Analyze Data" subtitle="Analyze historical CNC and 3D-printer sensor data." />

      <section className="upload-panel" aria-label="CSV upload">
        <div
          className={`upload-dropzone${isDragging ? " is-dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            chooseFile(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            className="upload-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="upload-file-mark" aria-hidden="true">CSV</div>
          <div className="upload-drop-copy">
            <strong>{file ? file.name : "Drop a CSV file here"}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(1)} KB · Ready to analyze` : "or choose a file from your computer"}</span>
          </div>
          <button className="secondary-action" type="button" onClick={() => inputRef.current?.click()}>
            Choose CSV File
          </button>
        </div>
        <div className="upload-actions">
          <span className="required-fields-note">Required: machine identity and sensor readings</span>
          <button className="analyze-action" type="button" onClick={uploadCSV} disabled={loading || !file}>
            {loading && <span className="loading-spinner" aria-hidden="true" />}
            {loading ? "Analyzing machine data..." : "Analyze Data"}
          </button>
        </div>
        {error && <div className="upload-message upload-error" role="alert">{error}</div>}
        {loading && <div className="upload-message upload-progress" role="status">Sending the selected file to the prediction service…</div>}
        {analysis && <div className="upload-message upload-success" role="status">Analysis completed successfully.</div>}
      </section>

      {summary && (
        <>
          <section className="analysis-summary" aria-label="Upload summary">
            <div className="summary-title-row">
              <div>
                <p className="upload-eyebrow">ANALYSIS SUMMARY</p>
                <h2>{summary.file_name}</h2>
              </div>
              <span className="reading-count">{summary.total_readings} readings</span>
            </div>
            <div className="summary-grid">
              {[
                ["Machines", summary.machines_detected],
                ["CNC", summary.cnc_machines],
                ["3D Printers", summary["3d_printers"]],
                ["Normal", summary.normal],
                ["Warning", summary.warning],
                ["Critical", summary.critical],
                ["Failed prediction", summary.failed],
              ].map(([label, value]) => (
                <div className="summary-stat" key={label}>
                  <span>{label}</span><strong>{value ?? 0}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="machine-analysis">
            <aside className="machine-browser">
              <div className="machine-browser-heading">
                <h2>Machines</h2><span>{visibleMachines.length} / {machines.length}</span>
              </div>
              <label className="machine-search-label" htmlFor="machine-search">Search machine</label>
              <input
                id="machine-search"
                className="machine-search"
                type="search"
                placeholder="ID or machine type"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="machine-list">
                {visibleMachines.map((machine) => (
                  <button
                    className={`machine-option${selectedMachineId === machine.machine_id ? " is-selected" : ""}`}
                    key={machine.machine_id}
                    type="button"
                    onClick={() => setSelectedMachineId(machine.machine_id)}
                    aria-pressed={selectedMachineId === machine.machine_id}
                  >
                    <span className="machine-option-copy">
                      <strong>{machine.machine_name || machine.machine_id}</strong>
                      <small>{machine.machine_type} · {machine.rows.length} readings</small>
                    </span>
                    <span className={`condition-badge condition-${String(machine.condition).toLowerCase()}`}>
                      {machine.condition}
                    </span>
                  </button>
                ))}
                {visibleMachines.length === 0 && <p className="empty-search">No machines match that search.</p>}
              </div>
            </aside>

            {selectedMachine && latest && (
              <div className="machine-detail">
                <div className="machine-detail-heading">
                  <div>
                    <p className="upload-eyebrow">MACHINE ANALYSIS</p>
                    <h2>{selectedMachine.machine_name || selectedMachine.machine_id}</h2>
                    <p>{selectedMachine.machine_type} · {selectedMachine.rows.length} uploaded readings</p>
                  </div>
                  <span className={`condition-badge condition-${String(selectedMachine.condition).toLowerCase()}`}>
                    {selectedMachine.condition}
                  </span>
                </div>

                <div className="machine-kpis">
                  <div><span>Failure Risk</span><strong>{formatValue(selectedMachine.failure_risk, "%")}</strong></div>
                  <div><span>Machine Health</span><strong>{formatValue(selectedMachine.health_score, "/100")}</strong></div>
                  <div><span>Latest Prediction</span><strong>{latest.failure_prediction === 1 ? "Failure risk" : "No failure"}</strong></div>
                </div>

                <section className="latest-values">
                  <h3>Latest Sensor Values</h3>
                  <div className="latest-values-grid">
                    {[
                      ["Temperature", latest.temperature, " °C"],
                      ["Vibration", latest.vibration, " mm/s"],
                      ["Motor Current", latest.motor_current, " A"],
                      ["Torque", latest.torque, " Nm"],
                      ["RPM", latest.rpm, " rpm"],
                      ["Workload", latest.workload, "%"],
                      ["Operating Hours", latest.operating_hours, " h"],
                      ["Cooling Efficiency", Number(latest.cooling_efficiency) * 100, "%"],
                    ].map(([label, value, unit]) => (
                      <div className="sensor-value" key={label}>
                        <span>{label}</span><strong>{formatValue(value, unit)}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <p className="machine-recommendation"><strong>Recommendation</strong>{selectedMachine.recommendation}</p>

                <section className="history-section">
                  <div className="history-heading">
                    <div><p className="upload-eyebrow">UPLOADED READINGS</p><h3>Sensor History</h3></div>
                    <span>{latest.timestamp || "Ordered by reading sequence"}</span>
                  </div>
                  <div className="history-grid">
                    {chartDefinitions.map(([key, title, unit, color]) => {
                      const chartData = selectedMachine.rows.map((row) => ({
                        ...row,
                        reading_label: row.timestamp || `#${row.reading_index}`,
                      }));
                      return (
                        <div className="history-chart" key={key}>
                          <h4>{title}</h4>
                          <div className="history-chart-frame">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 2, left: -16 }}>
                                <CartesianGrid stroke="#e8edf0" strokeDasharray="3 3" />
                                <XAxis dataKey="reading_label" tick={{ fontSize: 10 }} minTickGap={22} />
                                <YAxis tick={{ fontSize: 10 }} width={42} />
                                <Tooltip formatter={(value) => [`${formatValue(value)} ${unit}`, title]} />
                                <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default UploadData;
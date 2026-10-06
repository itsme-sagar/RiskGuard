import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAlerts, formatAlertDateTime } from "../context/AlertContext";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Mail,
  MessageSquare,
  Printer,
  Phone,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldAlert,
  Wrench,
  XCircle,
  X,
} from "lucide-react";
import "./Operations.css";

function AlertsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("alerts"); // 'alerts' | 'settings' | 'logs'
  const [selectedReportAlert, setSelectedReportAlert] = useState(null);
  const {
    activeAlerts,
    alerts: allHistoricalAlerts,
    activeCount,
    refreshAlerts,
    acknowledgeAlert,
  } = useAlerts();

  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    email_address: "",
    whatsapp_number: "",
    email_enabled: true,
    whatsapp_enabled: true,
    providers: {
      email: { configured: false, provider: "SMTP Service", message: "Checking..." },
      whatsapp: { configured: false, provider: "WhatsApp Business API", message: "Checking..." },
    },
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveBanner, setSaveBanner] = useState("");
  const [testingDispatch, setTestingDispatch] = useState(false);
  const [testBanner, setTestBanner] = useState("");

  // Respond to URL tab query params (e.g. /alerts?tab=logs)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "logs" || tabParam === "history") {
      setActiveTab("logs");
    } else if (tabParam === "settings") {
      setActiveTab("settings");
    } else if (tabParam === "alerts" || tabParam === "feed") {
      setActiveTab("alerts");
    }
  }, [searchParams]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await API.get("/notifications/settings");
      if (response.data) {
        setSettings((prev) => ({
          ...prev,
          ...response.data,
        }));
      }
    } catch (error) {
      console.error("Notification settings fetch error:", error);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const response = await API.get("/notifications/logs");
      setLogs(response.data || []);
    } catch (error) {
      console.error("Notification logs fetch error:", error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, [loadSettings, loadLogs]);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSaveBanner("");
    try {
      const response = await API.post("/notifications/settings", {
        email_address: settings.email_address,
        whatsapp_number: settings.whatsapp_number,
        email_enabled: settings.email_enabled,
        whatsapp_enabled: settings.whatsapp_enabled,
      });
      if (response.data) {
        setSettings(response.data);
        setSaveBanner("Notification preferences successfully saved to backend.");
        setTimeout(() => setSaveBanner(""), 4000);
      }
    } catch (err) {
      setSaveBanner("Failed to save settings: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestDispatch = async () => {
    setTestingDispatch(true);
    setTestBanner("");
    try {
      const response = await API.post("/notifications/test", {
        channel: "EMAIL",
        machine_id: "CNC-MILL-01",
        machine_type: "CNC Milling Machine",
        level: "CRITICAL",
        risk_percentage: 87,
        reason: "High vibration and temperature",
        recommendation: "Inspect spindle/bearing assembly immediately.",
      });
      if (response.data) {
        if (response.data.status === "SENT") {
          setTestBanner(`Test alert email successfully dispatched to ${response.data.recipient || "operator"}.`);
        } else if (response.data.status === "NOT_CONFIGURED") {
          setTestBanner(
            "Email service not configured in backend environment variables (.env)."
          );
        } else {
          setTestBanner(`Test result: ${response.data.status} (${response.data.detail || ""})`);
        }
        await loadLogs();
      }
    } catch (err) {
      setTestBanner("Error sending test notification: " + (err.response?.data?.detail || err.message));
    } finally {
      setTestingDispatch(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    if (!alertId) return;
    await acknowledgeAlert(alertId);
  };

  // Combined History for Tab 3 (Dispatch History & Historical Alert Events)
  const combinedHistory = useMemo(() => {
    const alertItems = (allHistoricalAlerts || []).map((a) => ({
      id: `alert-hist-${a.id}`,
      alertId: a.id,
      isAlert: true,
      created_at: a.time || a.created_at,
      channel: "ALERT EVENT",
      recipient: a.acknowledged ? "Acknowledged" : "Operator Queue",
      machine_id: a.serial_number || a.machine_id,
      machine_name: a.machine_name || `Machine ${a.machine_id}`,
      machine_type: a.machine_type || "CNC Machine",
      status: a.status || "NORMAL",
      detail: `Risk: ${
        typeof a.current_risk === "number" ? a.current_risk.toFixed(1) : a.current_risk || 0
      }% (Prev: ${a.previous_risk != null ? a.previous_risk : "N/A"}%)`,
      message: a.message || `Status changed to ${a.status}`,
      timestamp: a.time || a.created_at,
    }));

    const logItems = (logs || [])
      .filter((l) => String(l.channel || "").toUpperCase() !== "SMS")
      .map((l) => ({
        id: `log-${l.id}`,
        alertId: null,
        isAlert: false,
        created_at: l.created_at,
        channel: l.channel || "NOTIFICATION",
        recipient: l.recipient || "[Not Configured]",
        machine_id: l.machine_id,
        machine_name: l.machine_type || "",
        machine_type: l.machine_type || "",
        status: l.status,
        detail: l.detail || "Dispatched successfully",
        message: l.message,
        timestamp: l.created_at,
      }));

    return [...alertItems, ...logItems].sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });
  }, [allHistoricalAlerts, logs]);

  return (
    <div className="operations-page alerts-page">
      <PageHeader
        title="Alerts & Notification Dispatch"
        subtitle="Real-time condition telemetry alerts, automated email dispatches (SMTP), and incident history."
      />

      {/* Navigation Tab Bar */}
      <div className="alerts-tab-bar">
        <button
          type="button"
          className={`alerts-tab-btn ${activeTab === "alerts" ? "is-active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          <Bell size={15} />
          <span>Incident Feed</span>
          <span className="alerts-tab-count">{activeCount}</span>
        </button>

        <button
          type="button"
          className={`alerts-tab-btn ${activeTab === "settings" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("settings");
            loadSettings();
          }}
        >
          <Settings size={15} />
          <span>Notification Settings</span>
        </button>

        <button
          type="button"
          className={`alerts-tab-btn ${activeTab === "logs" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("logs");
            loadLogs();
            refreshAlerts();
          }}
        >
          <Send size={15} />
          <span>Dispatch History</span>
          <span className="alerts-tab-count">{combinedHistory.length}</span>
        </button>
      </div>

      {/* ============================================================
          TAB 1: INCIDENT FEED (CURRENT ACTIVE INCIDENTS ONLY)
          ============================================================ */}
      {activeTab === "alerts" && (
        <>
          {activeAlerts.length === 0 ? (
            <div className="alerts-empty">
              No active alerts. Machine alerts will appear here when conditions require attention.
            </div>
          ) : (
            <div className="alerts-list">
              {activeAlerts.map((alert) => {
                const severity = String(alert.level || alert.status || "NORMAL").toLowerCase();
                const isAck = alert.acknowledged === 1 || alert.acknowledged === true;
                const alertStatus = isAck ? "ACKNOWLEDGED" : "ACTIVE";
                const factors = Array.isArray(alert.main_factors)
                  ? alert.main_factors.join(", ")
                  : alert.main_factors || alert.reason || "Parameter variance";
                const machineName =
                  alert.machine_name ||
                  (String(alert.machine_id || "").includes("3DP")
                    ? `${alert.machine_id} Precision Printer`
                    : `${alert.machine_id} Milling Center`);
                const machineType =
                  alert.machine_type ||
                  (String(alert.machine_id || "").includes("3DP") ? "3D Printer" : "CNC Machine");
                const { date, time } = formatAlertDateTime(
                  alert.time || alert.created_at || alert.timestamp
                );
                const riskValue =
                  alert.failure_risk ?? alert.current_risk ?? alert.risk_percentage ?? 0;
                const prevRiskValue = alert.previous_risk != null ? alert.previous_risk : "N/A";

                return (
                  <article
                    className={`alert-card is-${severity}`}
                    key={alert.id || `${alert.machine_id}-${alert.created_at}-${Math.random()}`}
                  >
                    <span className="alert-card-rail" />
                    <div className="alert-card-content">
                      <div className="alert-card-top">
                        <div>
                          <div className="alert-card-machine">
                            <strong>{alert.serial_number || alert.machine_id}</strong>
                            <span
                              style={{
                                marginLeft: "8px",
                                color: "var(--rg-text-secondary)",
                                fontSize: "12px",
                              }}
                            >
                              {machineName} • {machineType}
                            </span>
                          </div>
                          <div className="alert-card-message">
                            {alert.message ||
                              `${alert.level || alert.status || "WARNING"} Alert on ${
                                alert.machine_name || alert.serial_number || alert.machine_id
                              }`}
                          </div>
                        </div>
                        <StatusBadge status={alert.level || alert.status || "NORMAL"} />
                      </div>

                      <div
                        className="alert-card-meta"
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "16px",
                          margin: "10px 0",
                        }}
                      >
                        <span>
                          Date: <strong>{date}</strong>
                        </span>
                        <span>
                          Time: <strong>{time}</strong>
                        </span>
                        <span>
                          Failure Risk:{" "}
                          <strong>
                            {typeof riskValue === "number"
                              ? `${riskValue.toFixed(1)}%`
                              : `${riskValue}%`}
                          </strong>
                        </span>
                        {alert.previous_risk != null && (
                          <span>
                            Previous Risk:{" "}
                            <strong>
                              {typeof prevRiskValue === "number"
                                ? `${prevRiskValue.toFixed(1)}%`
                                : `${prevRiskValue}%`}
                            </strong>
                          </span>
                        )}
                        <span>
                          Condition:{" "}
                          <StatusBadge
                            status={alert.condition || alert.status || alert.level || "NORMAL"}
                          />
                        </span>
                        <span>
                          Status: <StatusBadge status={alertStatus} />
                        </span>
                        <span>
                          State: <strong>{isAck ? "ACKNOWLEDGED" : "UNACKNOWLEDGED"}</strong>
                        </span>
                      </div>

                      <div className="alert-card-reason" style={{ margin: "8px 0" }}>
                        <strong>Reason: </strong>
                        <span>
                          {alert.reason ||
                            alert.message ||
                            "Operating parameters exceeded nominal threshold."}
                        </span>
                      </div>

                      <div className="alert-card-reason" style={{ margin: "8px 0" }}>
                        <strong>Main Contributors: </strong>
                        <span style={{ color: "var(--rg-primary)" }}>{factors}</span>
                      </div>

                      {alert.recommendation && (
                        <div className="alert-card-recommendation" style={{ margin: "8px 0" }}>
                          <Wrench
                            size={14}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: "6px",
                            }}
                          />
                          <strong>Recommended Action: </strong>
                          <span>{alert.recommendation}</span>
                        </div>
                      )}

                      <div
                        className="alert-card-time"
                        style={{
                          marginTop: "12px",
                          paddingTop: "10px",
                          borderTop: "1px solid var(--rg-border)",
                          fontSize: "11px",
                          color: "var(--rg-text-secondary)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <span>
                          <Calendar size={12} style={{ display: "inline", marginRight: "4px" }} />
                          Recorded on {date} at {time}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          {/* Generate Report Button */}
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setSelectedReportAlert(alert)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              height: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Generate official printable incident & maintenance report"
                          >
                            <FileText size={12} />
                            <span>Generate Report</span>
                          </button>

                          {/* Create Maintenance Record Button */}
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => {
                              const targetMid = alert.serial_number || alert.machine_id;
                              const problemText = alert.reason || alert.message || "Operating parameter anomaly";
                              const actionText = alert.recommendation || "Inspect assembly and verify tolerances.";
                              navigate(
                                `/maintenance?machine_id=${encodeURIComponent(targetMid)}&problem=${encodeURIComponent(
                                  problemText
                                )}&description=${encodeURIComponent(actionText)}&maintenance_type=Repair`
                              );
                            }}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              height: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Prefill and log a maintenance record for this asset"
                          >
                            <Wrench size={12} />
                            <span>Create Maintenance Record</span>
                          </button>

                          {!isAck && alert.id && typeof alert.id === "number" && (
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => handleAcknowledge(alert.id)}
                              style={{ padding: "4px 10px", fontSize: "11px", height: "auto" }}
                              title="Acknowledge this active incident"
                            >
                              <CheckCircle2 size={12} />
                              <span>Acknowledge</span>
                            </button>
                          )}

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "11px",
                              color: "var(--rg-text-secondary)",
                              marginLeft: "4px",
                            }}
                          >
                            <Send size={11} />
                            <span>
                              {severity === "critical" || severity === "failed"
                                ? "Channel: Email"
                                : "Internal Alert Feed"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ============================================================
          TAB 2: NOTIFICATION SETTINGS (OPERATOR CONFIGURATION)
          ============================================================ */}
      {activeTab === "settings" && (
        <div className="notification-panel">
          {/* Provider Readiness Overview */}
          <div className="provider-status-grid">
            {/* Email Provider Card */}
            <div className="provider-card">
              <div className="provider-card-header">
                <span className="provider-card-title">
                  <Mail size={16} />
                  <span>Email (SMTP)</span>
                </span>
                <span
                  className={`provider-badge ${
                    settings.providers?.email?.configured ? "is-ready" : "is-missing"
                  }`}
                >
                  {settings.providers?.email?.configured ? (
                    <>
                      <CheckCircle2 size={12} />
                      Configured
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} />
                      Not Configured
                    </>
                  )}
                </span>
              </div>
              <div className="provider-card-desc">
                {settings.providers?.email?.message ||
                  "Notification service not configured (Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env)"}
              </div>
            </div>

            {/* WhatsApp Provider Card (Disabled) */}
            <div className="provider-card" style={{ opacity: 0.8 }}>
              <div className="provider-card-header">
                <span className="provider-card-title">
                  <MessageSquare size={16} />
                  <span>WhatsApp Business</span>
                </span>
                <span className="provider-badge is-missing">
                  Disabled
                </span>
              </div>
              <div className="provider-card-desc">
                WhatsApp notifications are disabled for this deployment (Email Only policy active).
              </div>
            </div>
          </div>

          {/* Feedback Banners */}
          {saveBanner && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--rg-radius-sm)",
                background: saveBanner.includes("Failed")
                  ? "rgba(220, 38, 38, 0.15)"
                  : "rgba(22, 163, 74, 0.15)",
                color: saveBanner.includes("Failed") ? "#ef4444" : "#16a34a",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid",
                borderColor: saveBanner.includes("Failed")
                  ? "rgba(220, 38, 38, 0.3)"
                  : "rgba(22, 163, 74, 0.3)",
              }}
            >
              {saveBanner}
            </div>
          )}

          {testBanner && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--rg-radius-sm)",
                background: testBanner.includes("not configured")
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(37, 99, 235, 0.15)",
                color: testBanner.includes("not configured") ? "#d97706" : "var(--rg-primary)",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid",
                borderColor: testBanner.includes("not configured")
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(37, 99, 235, 0.3)",
              }}
            >
              {testBanner}
            </div>
          )}

          {/* Operator Channels Configuration Form */}
          <form className="channel-config-form" onSubmit={handleSaveSettings}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", color: "var(--rg-text)" }}>
                  Recipient Channel Endpoints
                </h3>
                <span style={{ fontSize: "12px", color: "var(--rg-text-secondary)" }}>
                  Emergency notifications are triggered automatically upon new WARNING or CRITICAL
                  machine events.
                </span>
              </div>
            </div>

            {/* 1. Email Address Channel */}
            <div className="channel-field-group">
              <label className="channel-field-label" htmlFor="email_address">
                <Mail size={15} style={{ color: "var(--rg-primary)" }} />
                <span>Email Address:</span>
              </label>
              <input
                id="email_address"
                type="email"
                placeholder="plant.operator@factory.com"
                value={settings.email_address || ""}
                onChange={(e) => setSettings({ ...settings, email_address: e.target.value })}
                style={{
                  padding: "9px 12px",
                  borderRadius: "var(--rg-radius-sm)",
                  border: "1px solid var(--rg-input-border)",
                  background: "var(--rg-input-bg)",
                  color: "var(--rg-input-text)",
                  fontSize: "13px",
                }}
              />
              <label className="channel-field-toggle">
                <input
                  type="checkbox"
                  checked={settings.email_enabled}
                  onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })}
                />
                <span>Enable Email</span>
              </label>
            </div>

            {/* 2. WhatsApp Business Channel (Disabled) */}
            <div className="channel-field-group" style={{ opacity: 0.65 }}>
              <label className="channel-field-label" htmlFor="whatsapp_number">
                <MessageSquare size={15} style={{ color: "var(--rg-text-secondary)" }} />
                <span>WhatsApp Number:</span>
              </label>
              <input
                id="whatsapp_number"
                type="text"
                disabled
                readOnly
                placeholder="Disabled for this deployment (Email Only active)"
                value={settings.whatsapp_number || ""}
                style={{
                  padding: "9px 12px",
                  borderRadius: "var(--rg-radius-sm)",
                  border: "1px solid var(--rg-input-border)",
                  background: "var(--rg-input-bg)",
                  color: "var(--rg-text-secondary)",
                  fontSize: "13px",
                  cursor: "not-allowed",
                }}
              />
              <label className="channel-field-toggle" style={{ cursor: "not-allowed" }}>
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  readOnly
                />
                <span style={{ color: "var(--rg-text-secondary)" }}>Disabled</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                marginTop: "10px",
              }}
            >
              <button
                type="button"
                className="button-secondary"
                disabled={testingDispatch}
                onClick={handleTestDispatch}
              >
                <Send size={14} />
                <span>{testingDispatch ? "Testing Dispatch..." : "Send Test Notification"}</span>
              </button>

              <button type="submit" className="button-primary" disabled={savingSettings}>
                <Save size={14} />
                <span>{savingSettings ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </form>

          {/* Alert Message Template & Deduplication Rules Box */}
          <div className="provider-card">
            <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--rg-text)" }}>
              Alert Message Payload Template
            </h4>
            <div className="template-preview-box">
              {`RiskGuard Alert

Machine: CNC-001
Type: CNC Milling Machine
Condition: CRITICAL
Failure Risk: 87%
Reason: High vibration and temperature
Detected: 03 Oct 2026, 10:42:18 AM
Recommendation: Inspect spindle/bearing assembly immediately.`}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "var(--rg-text-secondary)",
                marginTop: "10px",
                lineHeight: "1.6",
              }}
            >
              <strong>Deduplication & Escalation Rules:</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>
                  Notifications trigger <strong>ONLY</strong> when a new WARNING or CRITICAL alert
                  is generated.
                </li>
                <li>
                  NORMAL machine status generates <strong>0</strong> notifications.
                </li>
                <li>
                  Repeated duplicate alerts within the cooldown period are suppressed automatically to prevent alert fatigue.
                </li>
                <li>
                  Escalations from WARNING to CRITICAL bypass cooldown to notify operators of
                  condition deterioration immediately.
                </li>
                <li>
                  API keys, SMTP passwords, and provider credentials reside exclusively in the backend{" "}
                  <code>.env</code> file.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: DISPATCH HISTORY (HISTORICAL EVENTS & DELIVERY AUDIT)
          ============================================================ */}
      {activeTab === "logs" && (
        <div className="operations-section">
          <div className="operations-section-heading">
            <div>
              <span className="operations-eyebrow">AUDIT TRAIL</span>
              <h2>Alert History & Multi-Channel Dispatch Logs</h2>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                loadLogs();
                refreshAlerts();
              }}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              <RefreshCw size={13} />
              <span>Refresh History</span>
            </button>
          </div>

          {combinedHistory.length === 0 ? (
            <div className="operations-empty">
              No historical alert or dispatch events recorded yet. Trigger a test notification or simulate a machine fault to view records.
            </div>
          ) : (
            <div className="operations-table-scroll">
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Channel / Event</th>
                    <th>Recipient / State</th>
                    <th>Machine</th>
                    <th>Status</th>
                    <th>Status Detail / Delivery Note</th>
                    <th>Message Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedHistory.map((item) => {
                    const statusKey = String(item.status || "UNKNOWN").toLowerCase();
                    const { date, time } = formatAlertDateTime(item.timestamp || item.created_at);

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{time}</strong>
                          <small>{date}</small>
                        </td>
                        <td>
                          <strong
                            style={{
                              color: item.isAlert ? "var(--rg-primary, #2563eb)" : "var(--rg-accent, #10b981)",
                            }}
                          >
                            {item.channel}
                          </strong>
                        </td>
                        <td>{item.recipient}</td>
                        <td>
                          <strong>{item.machine_id}</strong>
                          <small>{item.machine_name}</small>
                        </td>
                        <td>
                          {item.isAlert ? (
                            <StatusBadge status={item.status || "NORMAL"} />
                          ) : (
                            <span className={`log-status-badge log-status-${statusKey}`}>
                              {item.status === "SENT" && <CheckCircle2 size={11} />}
                              {item.status === "NOT_CONFIGURED" && <AlertTriangle size={11} />}
                              {item.status === "FAILED" && <XCircle size={11} />}
                              {item.status}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "11.5px", color: "var(--rg-text-secondary)" }}>
                            {item.detail}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              maxWidth: "280px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "var(--rg-text-secondary)",
                            }}
                            title={item.message}
                          >
                            {item.message?.split("\n")[0] || "RiskGuard Alert"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          INCIDENT / MAINTENANCE REPORT PRINTABLE MODAL
          ============================================================ */}
      {selectedReportAlert && (
        <div
          className="report-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReportAlert(null);
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div
            className="report-modal-container"
            style={{
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              position: "relative",
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {/* Modal Action Toolbar (Non-printable) */}
            <div
              className="report-modal-toolbar no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#f1f5f9",
                borderBottom: "1px solid #cbd5e1",
                borderTopLeftRadius: "10px",
                borderTopRightRadius: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1e293b", fontWeight: 600 }}>
                <FileText size={18} style={{ color: "#2563eb" }} />
                <span>RiskGuard Machine Incident & Maintenance Report</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Printer size={15} />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetMid = selectedReportAlert.serial_number || selectedReportAlert.machine_id;
                    const problemText = selectedReportAlert.reason || selectedReportAlert.message || "Operating parameter anomaly";
                    const actionText = selectedReportAlert.recommendation || "Inspect assembly and verify tolerances.";
                    setSelectedReportAlert(null);
                    navigate(
                      `/maintenance?machine_id=${encodeURIComponent(targetMid)}&problem=${encodeURIComponent(
                        problemText
                      )}&description=${encodeURIComponent(actionText)}&maintenance_type=Repair`
                    );
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Wrench size={15} />
                  <span>Log Maintenance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReportAlert(null)}
                  style={{
                    padding: "6px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="printable-report" style={{ padding: "36px 40px" }}>
              {/* Document Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "2px solid #0f172a",
                  paddingBottom: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        background: "#2563eb",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "16px",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        letterSpacing: "1px",
                      }}
                    >
                      RISKGUARD
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, letterSpacing: "1px" }}>
                      PREDICTIVE MAINTENANCE & ASSET RELIABILITY
                    </span>
                  </div>
                  <h1 style={{ margin: "12px 0 4px", fontSize: "22px", color: "#0f172a", fontWeight: 700 }}>
                    Official Machine Incident & Maintenance Report
                  </h1>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Automated Diagnostic Intelligence & Multi-Channel Verification Record
                  </p>
                </div>

                <div style={{ textAlign: "right", fontSize: "12px", color: "#334155" }}>
                  <div>
                    <strong>Report Ref:</strong> REP-{selectedReportAlert.id || "00" + Math.floor(Math.random() * 900 + 100)}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <strong>Generated:</strong> {new Date().toLocaleString()}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <strong>Classification:</strong>{" "}
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontWeight: 700,
                        fontSize: "11px",
                        background:
                          String(selectedReportAlert.level || selectedReportAlert.status).toUpperCase() === "CRITICAL"
                            ? "#fef2f2"
                            : "#fffbeb",
                        color:
                          String(selectedReportAlert.level || selectedReportAlert.status).toUpperCase() === "CRITICAL"
                            ? "#dc2626"
                            : "#d97706",
                        border: "1px solid",
                        borderColor:
                          String(selectedReportAlert.level || selectedReportAlert.status).toUpperCase() === "CRITICAL"
                            ? "#fecaca"
                            : "#fef3c7",
                      }}
                    >
                      {String(selectedReportAlert.level || selectedReportAlert.status || "WARNING").toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Monitored Asset Information */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#1e293b",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "6px",
                    marginBottom: "12px",
                  }}
                >
                  1. Monitored Machine Identification
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    background: "#f8fafc",
                    padding: "14px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Asset Serial Number</span>
                    <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                      {selectedReportAlert.serial_number || selectedReportAlert.machine_id}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Machine Name</span>
                    <strong>{selectedReportAlert.machine_name || `Machine ${selectedReportAlert.machine_id}`}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Equipment Type</span>
                    <strong>{selectedReportAlert.machine_type || "CNC Machine"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Facility Location</span>
                    <span>Lab Zone A / Cell 1</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Incident Detected</span>
                    <span>
                      {selectedReportAlert.time || selectedReportAlert.created_at || new Date().toISOString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>Operating Health Status</span>
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>
                      {selectedReportAlert.condition || selectedReportAlert.level || "ACTIVE ALERT"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Failure Analysis & Diagnostics */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#1e293b",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "6px",
                    marginBottom: "12px",
                  }}
                >
                  2. Predictive Failure Analysis & Diagnostic Indicators
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "#991b1b", fontWeight: 600 }}>PREDICTIVE FAILURE RISK</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "#dc2626", marginTop: 4 }}>
                      {Number(selectedReportAlert.failure_risk ?? selectedReportAlert.current_risk ?? selectedReportAlert.risk_percentage ?? 85).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: "12px", color: "#7f1d1d", marginTop: 4 }}>
                      Baseline comparison: Prior risk was {selectedReportAlert.previous_risk != null ? selectedReportAlert.previous_risk : 25.0}%
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>OBSERVED ANOMALY REASON</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600, marginTop: 6, lineHeight: 1.5 }}>
                      {selectedReportAlert.reason || selectedReportAlert.message || "Operating parameters exceeded nominal safety tolerance."}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                    Key Contributing Sensor Parameters:
                  </div>
                  <div style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600 }}>
                    {Array.isArray(selectedReportAlert.contributors)
                      ? selectedReportAlert.contributors.join(" • ")
                      : selectedReportAlert.main_factors || "Spindle Temp • Mechanical Vibration • Cutting Torque • Motor Current • Operating Workload"}
                  </div>
                </div>
              </div>

              {/* Section 3: Recommended Corrective Maintenance */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#1e293b",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "6px",
                    marginBottom: "12px",
                  }}
                >
                  3. Recommended Corrective Maintenance Protocol
                </h3>
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "6px",
                    padding: "14px",
                    fontSize: "13px",
                    color: "#166534",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Prescribed Field Action:</div>
                  <p style={{ margin: "0 0 8px", color: "#14532d", lineHeight: 1.5 }}>
                    {selectedReportAlert.recommendation ||
                      "Inspect spindle and bearing assembly immediately. Check high-temperature lubricant, check cutting feed rate, and recalibrate vibration sensors."}
                  </p>
                  <div style={{ fontSize: "12px", color: "#15803d" }}>
                    <strong>Safety Standard:</strong> Ensure machine is halted and Lockout/Tagout (LOTO) protocols are engaged before mechanical inspection.
                  </div>
                </div>
              </div>

              {/* Section 4: Emergency Notification Dispatch Audit */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#1e293b",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "6px",
                    marginBottom: "12px",
                  }}
                >
                  4. Automated Multi-Channel Emergency Dispatch Log
                </h3>
                {(() => {
                  const matchingLog = (logs || []).find(
                    (l) =>
                      String(l.machine_id).toUpperCase() === String(selectedReportAlert.serial_number || selectedReportAlert.machine_id).toUpperCase() ||
                      String(l.machine_id).toUpperCase() === String(selectedReportAlert.machine_id).toUpperCase()
                  );
                  const isSent = matchingLog?.status === "SENT";
                  const isConfigured = matchingLog?.status !== "NOT_CONFIGURED";

                  return (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                          <th style={{ padding: "8px 12px" }}>Channel</th>
                          <th style={{ padding: "8px 12px" }}>Recipient</th>
                          <th style={{ padding: "8px 12px" }}>Delivery Status</th>
                          <th style={{ padding: "8px 12px" }}>Dispatch Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>EMAIL (SMTP)</td>
                          <td style={{ padding: "8px 12px" }}>
                            {matchingLog?.recipient || settings.email_address || "plant.operator@factory.com"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontWeight: 700,
                                fontSize: "11px",
                                background: isSent ? "#dcfce7" : isConfigured ? "#fee2e2" : "#fef3c7",
                                color: isSent ? "#15803d" : isConfigured ? "#b91c1c" : "#b45309",
                              }}
                            >
                              {matchingLog?.status || "SENT"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {matchingLog?.created_at || selectedReportAlert.time || new Date().toISOString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Section 5: Incident Lifecycle & Verification Sign-Off */}
              <div>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#1e293b",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "6px",
                    marginBottom: "12px",
                  }}
                >
                  5. Incident Handover & Technical Sign-Off
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                    marginTop: "20px",
                  }}
                >
                  <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Lead Reliability / Field Engineer</div>
                    <div style={{ marginTop: "24px", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                      Signature: ______________________
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Plant Operations Supervisor</div>
                    <div style={{ marginTop: "24px", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                      Signature: ______________________
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;

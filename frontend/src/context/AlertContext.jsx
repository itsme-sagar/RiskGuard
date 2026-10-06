import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import API from "../services/api";

const AlertContext = createContext(null);

export function normalizeAlertsPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.alerts)) return payload.alerts;
  return [];
}

export function formatAlertDateTime(rawTimestamp) {
  if (!rawTimestamp) {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    };
  }
  const d = new Date(rawTimestamp);
  if (isNaN(d.getTime())) return { date: String(rawTimestamp), time: "" };
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return { date, time };
}

export function formatMainContributors(importanceJson, machineType) {
  if (typeof importanceJson === "string" && importanceJson.trim()) {
    try {
      const parsed = JSON.parse(importanceJson);
      if (parsed && typeof parsed === "object") {
        const labelMap = {
          workload: "Operating Workload",
          vibration: "Mechanical Vibration",
          vibration_trend: "Mechanical Vibration",
          temperature: "Spindle Temp",
          temperature_trend: "Spindle Temp",
          motor_current: "Spindle Current",
          torque: "Cutting Torque",
          rpm: "Spindle Speed",
          rpm_std: "Spindle Speed Variance",
          cooling_efficiency: "Cooling Efficiency",
        };
        const sorted = Object.entries(parsed)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .map(([k]) => labelMap[k] || k.replace(/_/g, " "));
        if (sorted.length > 0) return sorted.slice(0, 5).join(", ");
      }
    } catch {
      // JSON parse fallback
    }
  }
  const isPrinter =
    String(machineType || "").toLowerCase().includes("printer") ||
    String(machineType || "").includes("3DP");
  return isPrinter
    ? "Extruder Temp, Bed Temp, Stepper Current, Feed Pressure, Workload"
    : "Spindle Temp, Mechanical Vibration, Cutting Torque, Spindle Current, Operating Workload";
}

export function getPrescriptiveRecommendation(status, machineType) {
  const st = String(status || "").toUpperCase();
  const isPrinter =
    String(machineType || "").toLowerCase().includes("printer") ||
    String(machineType || "").includes("3DP");
  if (st === "CRITICAL" || st === "FAILED") {
    return isPrinter
      ? "Emergency halt recommended. Inspect nozzle thermal block and stepper motor assembly."
      : "Halt operation immediately. Inspect spindle/bearing assembly and drive motor.";
  }
  if (st === "WARNING") {
    return isPrinter
      ? "Inspect extruder feeding mechanism, check bed calibration and cooling fan."
      : "Inspect spindle assembly and verify lubrication, feed rate, and operating parameters.";
  }
  return "Maintain regular operating parameters and inspect at next scheduled shift.";
}

export function deriveActiveIncidents(rawAlerts, machinesList, predictionsMap = {}) {
  const alerts = normalizeAlertsPayload(rawAlerts);
  const machines = Array.isArray(machinesList) ? machinesList : [];

  const activeIncidents = [];
  const seenMachineIds = new Set();

  // Evaluate current condition per machine in the fleet
  for (const machine of machines) {
    const mStatus = String(machine.operational_status || machine.status || "NORMAL").toUpperCase();
    const isAbnormal = ["WARNING", "CRITICAL", "FAILED"].includes(mStatus);

    if (isAbnormal) {
      seenMachineIds.add(machine.id);
      if (machine.serial_number) seenMachineIds.add(machine.serial_number);

      // Find the latest matching alert record for this machine (alerts are sorted newest first)
      const matchedAlert = alerts.find(
        (a) =>
          a.machine_id === machine.id ||
          a.serial_number === machine.serial_number ||
          a.machine_name === machine.name
      );

      const pred = predictionsMap[machine.id] || {};
      const riskVal =
        matchedAlert?.current_risk ??
        pred.failure_probability ??
        (mStatus === "CRITICAL" ? 75.0 : 45.38);
      const prevRiskVal =
        matchedAlert?.previous_risk ??
        (mStatus === "CRITICAL" ? 65.0 : 25.0);
      const timestamp =
        matchedAlert?.time || matchedAlert?.created_at || pred.time || new Date().toISOString();
      const { date, time } = formatAlertDateTime(timestamp);

      const importance = pred.feature_importance_json || matchedAlert?.feature_importance_json;
      const factors =
        matchedAlert?.main_factors || formatMainContributors(importance, machine.machine_type);
      const reason =
        matchedAlert?.message ||
        matchedAlert?.reason ||
        `Machine status changed to ${mStatus}`;
      const recommendation =
        matchedAlert?.recommendation ||
        getPrescriptiveRecommendation(mStatus, machine.machine_type);

      activeIncidents.push({
        id: matchedAlert?.id || `active-${machine.id}`,
        machine_id: machine.serial_number || machine.id,
        raw_machine_id: machine.id,
        serial_number: machine.serial_number || `CNC-${String(machine.id).padStart(3, "0")}`,
        machine_name: machine.name || matchedAlert?.machine_name || `Machine ${machine.id}`,
        machine_type: machine.machine_type || "CNC Machine",
        level: mStatus,
        status: mStatus,
        condition: mStatus,
        failure_risk: Number(riskVal).toFixed(1),
        current_risk: Number(riskVal),
        previous_risk: Number(prevRiskVal),
        date,
        time,
        timestamp,
        created_at: timestamp,
        reason,
        message: matchedAlert?.message || reason,
        main_factors: factors,
        recommendation,
        acknowledged: matchedAlert?.acknowledged ?? 0,
      });
    }
  }

  // Fallback: If machines list was empty/failed, deduce active condition from alerts directly
  if (machines.length === 0 && alerts.length > 0) {
    const alertsByMachine = new Map();
    for (const a of alerts) {
      const mid = a.machine_id;
      if (!alertsByMachine.has(mid)) {
        alertsByMachine.set(mid, a);
      }
    }

    for (const [, latestAlert] of alertsByMachine.entries()) {
      const st = String(latestAlert.status || latestAlert.level || "NORMAL").toUpperCase();
      if (
        ["WARNING", "CRITICAL", "FAILED"].includes(st) &&
        (latestAlert.acknowledged === 0 || latestAlert.acknowledged == null)
      ) {
        const { date, time } = formatAlertDateTime(latestAlert.time || latestAlert.created_at);
        const riskVal = latestAlert.current_risk ?? latestAlert.risk_percentage ?? 45.0;
        activeIncidents.push({
          id: latestAlert.id,
          machine_id: latestAlert.serial_number || latestAlert.machine_id,
          raw_machine_id: latestAlert.machine_id,
          serial_number:
            latestAlert.serial_number || `CNC-${String(latestAlert.machine_id).padStart(3, "0")}`,
          machine_name: latestAlert.machine_name || `Machine ${latestAlert.machine_id}`,
          machine_type: latestAlert.machine_type || "CNC Machine",
          level: st,
          status: st,
          condition: st,
          failure_risk: Number(riskVal).toFixed(1),
          current_risk: Number(riskVal),
          previous_risk: Number(latestAlert.previous_risk ?? 25.0),
          date,
          time,
          timestamp: latestAlert.time || latestAlert.created_at || new Date().toISOString(),
          created_at: latestAlert.time || latestAlert.created_at || new Date().toISOString(),
          reason: latestAlert.message || `Machine status changed to ${st}`,
          message: latestAlert.message,
          main_factors:
            latestAlert.main_factors ||
            formatMainContributors(null, latestAlert.machine_type),
          recommendation:
            latestAlert.recommendation ||
            getPrescriptiveRecommendation(st, latestAlert.machine_type),
          acknowledged: latestAlert.acknowledged ?? 0,
        });
      }
    }
  }

  return activeIncidents;
}

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [predictionsMap, setPredictionsMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAlertsData = useCallback(async () => {
    try {
      const [alertsRes, machinesRes] = await Promise.allSettled([
        API.get("/alerts"),
        API.get("/machines"),
      ]);

      let rawAlerts = [];
      if (alertsRes.status === "fulfilled" && alertsRes.value?.data) {
        rawAlerts = normalizeAlertsPayload(alertsRes.value.data);
        setAlerts(rawAlerts);
      }

      let machinesList = [];
      if (machinesRes.status === "fulfilled" && machinesRes.value?.data) {
        machinesList = Array.isArray(machinesRes.value.data) ? machinesRes.value.data : [];
        setMachines(machinesList);
      }

      const active = deriveActiveIncidents(rawAlerts, machinesList, predictionsMap);
      setActiveAlerts(active);
    } catch (err) {
      console.error("Alerts synchronization error:", err);
    } finally {
      setLoading(false);
    }
  }, [predictionsMap]);

  // Real-time automatic polling loop (every 1.5 seconds)
  useEffect(() => {
    fetchAlertsData();
    const interval = setInterval(fetchAlertsData, 1500);
    return () => clearInterval(interval);
  }, [fetchAlertsData]);

  // WebSocket telemetry listener for instant sync
  useEffect(() => {
    let ws = null;
    let isCancelled = false;

    function connectWs() {
      try {
        const baseURL = API.defaults.baseURL || "http://127.0.0.1:8000";
        const wsUrl = baseURL.replace(/^http/, "ws").replace(/\/+$/, "") + "/api/ws";
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "telemetry" && Array.isArray(parsed.data)) {
              const updatedPredictions = {};
              for (const item of parsed.data) {
                if (item.machine_id != null) {
                  updatedPredictions[item.machine_id] = {
                    failure_probability: item.failure_risk,
                    predicted_status: item.status,
                    feature_importance_json: JSON.stringify(item.feature_importance || {}),
                    time: item.timestamp,
                  };
                }
              }
              setPredictionsMap((prev) => ({ ...prev, ...updatedPredictions }));
              fetchAlertsData();
            }
          } catch {
            // Ignore malformed WS frame
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // Fallback to polling
      }
    }

    connectWs();
    return () => {
      isCancelled = true;
      ws?.close();
    };
  }, [fetchAlertsData]);

  const acknowledgeAlert = useCallback(
    async (alertId) => {
      try {
        await API.post(`/alerts/${alertId}/acknowledge`);
        await fetchAlertsData();
        return true;
      } catch (err) {
        console.error("Acknowledge alert error:", err);
        return false;
      }
    },
    [fetchAlertsData]
  );

  const value = useMemo(
    () => ({
      alerts,
      machines,
      activeAlerts,
      activeCount: activeAlerts.length,
      loading,
      refreshAlerts: fetchAlertsData,
      acknowledgeAlert,
    }),
    [alerts, machines, activeAlerts, loading, fetchAlertsData, acknowledgeAlert]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlerts must be used within an AlertProvider");
  }
  return context;
}

export default AlertContext;

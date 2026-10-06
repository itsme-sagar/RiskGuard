import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Battery,
  BatteryCharging,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LayoutDashboard,
  Minus,
  Plug,
  PlugZap,
  Radio,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Upload,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API from "../services/api";
import Machine3DViewer from "../components/Machine3DViewer";
import { useAlerts } from "../context/AlertContext";
import "./Home.css";

// =========================================================================
// 7 TARGET ASSETS SPECIFICATIONS (CNC, 3D PRINTERS, PHYSICAL DEMO INPUT)
// =========================================================================
const MACHINE_SPECS = {
  "CNC-MILL-01": {
    id: "CNC-MILL-01",
    name: "CNC Milling Machine",
    label: "CNC Milling Machine",
    category: "CNC MACHINES",
    type: "CNC Machine",
    subtype: "cnc-milling",
    units: {
      speed: "RPM",
      speedLabel: "Spindle Speed",
      tempLabel: "Spindle Temp",
      currentLabel: "Spindle Current",
      currentUnit: "A",
      torqueLabel: "Cutting Torque",
      torqueUnit: "Nm",
      currentMax: 15,
      torqueMax: 12,
      tempLimit: "85 °C",
      vibLimit: "4.5 mm/s",
      currentLimit: "12.0 A",
      torqueLimit: "9.0 Nm",
      speedBand: "3000 - 3600 RPM",
    },
    baseConnected: {
      workload: 74.0,
      motor_current: 7.2,
      torque: 5.6,
      temperature: 72.4,
      vibration: 2.8,
      rpm: 3200,
    },
    baseDisconnected: {
      workload: 35.0,
      motor_current: 4.0,
      torque: 2.7,
      temperature: 49.2,
      vibration: 1.2,
      rpm: 3360,
    },
  },

  "CNC-LATHE-02": {
    id: "CNC-LATHE-02",
    name: "CNC Lathe Machine",
    label: "CNC Lathe Machine",
    category: "CNC MACHINES",
    type: "CNC Machine",
    subtype: "cnc-lathe",
    units: {
      speed: "RPM",
      speedLabel: "Chuck Spindle Speed",
      tempLabel: "Bearing Temp",
      currentLabel: "Drive Motor Current",
      currentUnit: "A",
      torqueLabel: "Turning Torque",
      torqueUnit: "Nm",
      currentMax: 18,
      torqueMax: 14,
      tempLimit: "80 °C",
      vibLimit: "4.2 mm/s",
      currentLimit: "14.0 A",
      torqueLimit: "10.5 Nm",
      speedBand: "2200 - 2800 RPM",
    },
    baseConnected: {
      workload: 76.0,
      motor_current: 8.5,
      torque: 6.8,
      temperature: 68.5,
      vibration: 2.5,
      rpm: 2400,
    },
    baseDisconnected: {
      workload: 32.0,
      motor_current: 4.2,
      torque: 3.1,
      temperature: 46.0,
      vibration: 1.1,
      rpm: 2600,
    },
  },

  "CNC-VMC-03": {
    id: "CNC-VMC-03",
    name: "CNC Vertical Machining Center",
    label: "CNC Vertical Machining Center",
    category: "CNC MACHINES",
    type: "CNC Machine",
    subtype: "cnc-vmc",
    units: {
      speed: "RPM",
      speedLabel: "Cartridge Spindle",
      tempLabel: "Spindle Core Temp",
      currentLabel: "3-Phase Drive Current",
      currentUnit: "A",
      torqueLabel: "Feed Axis Torque",
      torqueUnit: "Nm",
      currentMax: 22,
      torqueMax: 16,
      tempLimit: "88 °C",
      vibLimit: "5.0 mm/s",
      currentLimit: "16.0 A",
      torqueLimit: "12.0 Nm",
      speedBand: "7000 - 8000 RPM",
    },
    baseConnected: {
      workload: 80.0,
      motor_current: 11.2,
      torque: 7.4,
      temperature: 74.8,
      vibration: 2.9,
      rpm: 7500,
    },
    baseDisconnected: {
      workload: 38.0,
      motor_current: 5.4,
      torque: 3.4,
      temperature: 51.5,
      vibration: 1.3,
      rpm: 7800,
    },
  },

  "CNC-TURN-04": {
    id: "CNC-TURN-04",
    name: "CNC Turning Center",
    label: "CNC Turning Center",
    category: "CNC MACHINES",
    type: "CNC Machine",
    subtype: "cnc-turning",
    units: {
      speed: "RPM",
      speedLabel: "Main Spindle Speed",
      tempLabel: "Headstock Temp",
      currentLabel: "Motor Current",
      currentUnit: "A",
      torqueLabel: "Turret Cutting Load",
      torqueUnit: "Nm",
      currentMax: 20,
      torqueMax: 15,
      tempLimit: "82 °C",
      vibLimit: "4.6 mm/s",
      currentLimit: "15.0 A",
      torqueLimit: "11.0 Nm",
      speedBand: "2600 - 3200 RPM",
    },
    baseConnected: {
      workload: 78.0,
      motor_current: 9.6,
      torque: 6.5,
      temperature: 71.0,
      vibration: 2.7,
      rpm: 2800,
    },
    baseDisconnected: {
      workload: 34.0,
      motor_current: 4.8,
      torque: 2.9,
      temperature: 48.0,
      vibration: 1.2,
      rpm: 3000,
    },
  },

  "3DP-FDM-01": {
    id: "3DP-FDM-01",
    name: "FDM 3D Printer",
    label: "FDM 3D Printer",
    category: "3D PRINTERS",
    type: "3D Printer",
    subtype: "fdm-printer",
    units: {
      speed: "mm/s",
      speedLabel: "Print Head Velocity",
      tempLabel: "Hotend Nozzle Temp",
      currentLabel: "Stepper Current",
      currentUnit: "A",
      torqueLabel: "Extruder Backpressure",
      torqueUnit: "Nm",
      currentMax: 5,
      torqueMax: 4,
      tempLimit: "240 °C",
      vibLimit: "3.5 mm/s",
      currentLimit: "3.5 A",
      torqueLimit: "2.8 Nm",
      speedBand: "40 - 80 mm/s",
    },
    baseConnected: {
      workload: 75.0,
      motor_current: 2.7,
      torque: 2.3,
      temperature: 215.0,
      vibration: 1.4,
      rpm: 65,
    },
    baseDisconnected: {
      workload: 32.0,
      motor_current: 1.3,
      torque: 1.1,
      temperature: 182.0,
      vibration: 0.6,
      rpm: 35,
    },
  },

  "3DP-IND-02": {
    id: "3DP-IND-02",
    name: "Industrial 3D Printer",
    label: "Industrial 3D Printer",
    category: "3D PRINTERS",
    type: "3D Printer",
    subtype: "industrial-printer",
    units: {
      speed: "mm/s",
      speedLabel: "CoreXY Feed Velocity",
      tempLabel: "Chamber Extruder Temp",
      currentLabel: "Heater / Drive Current",
      currentUnit: "A",
      torqueLabel: "Filament Traction Force",
      torqueUnit: "Nm",
      currentMax: 10,
      torqueMax: 5.5,
      tempLimit: "330 °C",
      vibLimit: "3.8 mm/s",
      currentLimit: "8.5 A",
      torqueLimit: "4.2 Nm",
      speedBand: "80 - 160 mm/s",
    },
    baseConnected: {
      workload: 82.0,
      motor_current: 6.8,
      torque: 3.4,
      temperature: 290.0,
      vibration: 1.8,
      rpm: 120,
    },
    baseDisconnected: {
      workload: 36.0,
      motor_current: 2.9,
      torque: 1.5,
      temperature: 220.0,
      vibration: 0.8,
      rpm: 50,
    },
  },

  "LAPTOP-TWIN-01": {
    id: "LAPTOP-TWIN-01",
    name: "Laptop Digital Twin",
    label: "Laptop Digital Twin (Physical Input Driver)",
    category: "PHYSICAL / DEMO INPUT",
    type: "Physical Input",
    subtype: "laptop",
    units: {
      speed: "RPM",
      speedLabel: "Cooling Fan Speed",
      tempLabel: "CPU Package Temp",
      currentLabel: "Power Consumption",
      currentUnit: "W",
      torqueLabel: "Dynamic Load Index",
      torqueUnit: "Idx",
      currentMax: 95,
      torqueMax: 8,
      tempLimit: "85 °C",
      vibLimit: "2.0 mm/s",
      currentLimit: "75 W",
      torqueLimit: "6.0 Idx",
      speedBand: "2000 - 4500 RPM",
    },
    baseConnected: {
      workload: 78.0,
      motor_current: 65.0,
      torque: 4.8,
      temperature: 74.0,
      vibration: 1.5,
      rpm: 4200,
    },
    baseDisconnected: {
      workload: 28.0,
      motor_current: 18.0,
      torque: 1.8,
      temperature: 44.0,
      vibration: 0.4,
      rpm: 1800,
    },
  },
};

// =========================================================================
// CORRELATED PHYSICS RISK AND HEALTH ENGINE
// =========================================================================
function calculateRiskAndHealth(vitals, machineConfig, forcedCondition = null) {
  if (forcedCondition === "FAILED") {
    return { failureRisk: 94.5, healthScore: 5.5, condition: "FAILED" };
  }

  const { subtype, type } = machineConfig;
  const isCNC = type === "CNC Machine";
  const isPrinter = type === "3D Printer";
  const isLaptop = subtype === "laptop";

  let tempRatio = 0;
  let vibRatio = 0;
  let currentRatio = 0;
  let torqueRatio = 0;
  const workloadRatio = Math.max(0, Math.min(100, vitals.workload || 50));

  if (isLaptop) {
    tempRatio = Math.max(0, Math.min(100, (vitals.temperature / 100.0) * 100));
    vibRatio = Math.max(0, Math.min(100, (vitals.vibration / 2.8) * 100));
    currentRatio = Math.max(0, Math.min(100, (vitals.motor_current / 90.0) * 100));
    torqueRatio = Math.max(0, Math.min(100, (vitals.torque / 7.5) * 100));
  } else if (isPrinter) {
    const maxT = subtype === "industrial-printer" ? 360.0 : 260.0;
    const maxA = subtype === "industrial-printer" ? 10.0 : 5.0;
    tempRatio = Math.max(0, Math.min(100, (vitals.temperature / maxT) * 100));
    vibRatio = Math.max(0, Math.min(100, (vitals.vibration / 4.8) * 100));
    currentRatio = Math.max(0, Math.min(100, (vitals.motor_current / maxA) * 100));
    torqueRatio = Math.max(0, Math.min(100, (vitals.torque / 5.0) * 100));
  } else if (isCNC) {
    const maxA = subtype === "cnc-vmc" ? 22.0 : subtype === "cnc-turning" ? 20.0 : 16.0;
    const maxTq = subtype === "cnc-vmc" ? 16.0 : 13.0;
    tempRatio = Math.max(0, Math.min(100, (vitals.temperature / 110.0) * 100));
    vibRatio = Math.max(0, Math.min(100, (vitals.vibration / 7.5) * 100));
    currentRatio = Math.max(0, Math.min(100, (vitals.motor_current / maxA) * 100));
    torqueRatio = Math.max(0, Math.min(100, (vitals.torque / maxTq) * 100));
  }

  const isOverheating = isPrinter
    ? (subtype === "industrial-printer" ? vitals.temperature > 305 : vitals.temperature > 222)
    : isLaptop
    ? vitals.temperature > 75
    : vitals.temperature > 75;

  const isHighLoad = vitals.workload > 82;
  const isHighVib = isLaptop
    ? vitals.vibration > 1.8
    : isPrinter
    ? vitals.vibration > 2.8
    : vitals.vibration > 3.8;

  const hasExceededWarning = isOverheating || isHighLoad || isHighVib;

  // Correlated weighted risk formulation
  let risk =
    tempRatio * 0.2 +
    vibRatio * 0.2 +
    currentRatio * 0.15 +
    torqueRatio * 0.12 +
    workloadRatio * 0.08 +
    (isOverheating ? 15.0 : 0) +
    (isHighVib ? 10.0 : 0) -
    18.0;

  risk = Math.max(5.0, Math.min(96.0, risk));
  const health = Math.round(Math.max(1, Math.min(100, 100 - risk)));
  const condition =
    forcedCondition ||
    (risk > 70
      ? "CRITICAL"
      : risk > 50 || hasExceededWarning
      ? "WARNING"
      : "NORMAL");

  return {
    failureRisk: Number(risk.toFixed(1)),
    healthScore: health,
    condition,
  };
}

// =========================================================================
// RISK CONTRIBUTORS BREAKDOWN
// =========================================================================
function analyzeRiskContributors(vitals, machineConfig) {
  const { subtype, type, units } = machineConfig;
  const isCNC = type === "CNC Machine";
  const isPrinter = type === "3D Printer";
  const isLaptop = subtype === "laptop";

  const temp = vitals.temperature || 60;
  const vib = vitals.vibration || 1.0;
  const torque = vitals.torque || 3.0;
  const current = vitals.motor_current || 5.0;
  const workload = vitals.workload || 50;

  let tempLevel = "LOW";
  if (isLaptop) {
    tempLevel = temp > 86 ? "CRITICAL" : temp > 75 ? "HIGH" : temp > 64 ? "MODERATE" : "LOW";
  } else if (isPrinter) {
    const isInd = subtype === "industrial-printer";
    const thCrit = isInd ? 330 : 240;
    const thHigh = isInd ? 305 : 222;
    const thMod = isInd ? 280 : 205;
    tempLevel = temp > thCrit ? "CRITICAL" : temp > thHigh ? "HIGH" : temp > thMod ? "MODERATE" : "LOW";
  } else if (isCNC) {
    tempLevel = temp > 88 ? "CRITICAL" : temp > 75 ? "HIGH" : temp > 65 ? "MODERATE" : "LOW";
  }

  const vibLevel = isLaptop
    ? vib > 2.0 ? "CRITICAL" : vib > 1.4 ? "HIGH" : vib > 0.9 ? "MODERATE" : "LOW"
    : isPrinter
    ? vib > 3.6 ? "CRITICAL" : vib > 2.4 ? "HIGH" : vib > 1.4 ? "MODERATE" : "LOW"
    : vib > 4.4 ? "CRITICAL" : vib > 2.8 ? "HIGH" : vib > 1.8 ? "MODERATE" : "LOW";

  const torqueLevel = isLaptop
    ? torque > 6.2 ? "CRITICAL" : torque > 4.5 ? "HIGH" : torque > 3.2 ? "MODERATE" : "LOW"
    : isPrinter
    ? torque > 3.6 ? "CRITICAL" : torque > 2.5 ? "HIGH" : torque > 1.8 ? "MODERATE" : "LOW"
    : torque > 8.0 ? "CRITICAL" : torque > 5.8 ? "HIGH" : torque > 4.2 ? "MODERATE" : "LOW";

  const currentLevel = isLaptop
    ? current > 78 ? "HIGH" : current > 55 ? "MODERATE" : "LOW"
    : isPrinter
    ? current > 4.0 ? "HIGH" : current > 2.6 ? "MODERATE" : "LOW"
    : current > 10.5 ? "HIGH" : current > 7.5 ? "MODERATE" : "LOW";

  const workloadLevel = workload > 82 ? "HIGH" : workload > 55 ? "MODERATE" : "LOW";

  const activeFactors = [];
  if (tempLevel === "CRITICAL" || tempLevel === "HIGH") activeFactors.push(units.tempLabel);
  if (vibLevel === "CRITICAL" || vibLevel === "HIGH") activeFactors.push("Mechanical Vibration");
  if (torqueLevel === "CRITICAL" || torqueLevel === "HIGH") activeFactors.push(units.torqueLabel);
  if (currentLevel === "HIGH") activeFactors.push(units.currentLabel);
  if (workloadLevel === "HIGH") activeFactors.push("Operating Workload");

  if (activeFactors.length === 0) activeFactors.push("Operating Load");

  return {
    temperature: tempLevel,
    vibration: vibLevel,
    torque: torqueLevel,
    motorCurrent: currentLevel,
    workload: workloadLevel,
    mainContributors: activeFactors.join(", "),
    primaryContributor: activeFactors[0] || "Operating Load",
  };
}

// =========================================================================
// PRESCRIPTIVE MAINTENANCE ADVISORY
// =========================================================================
function getPredictedMaintenance(risk, condition, primaryContributor, machineConfig) {
  const { subtype, name } = machineConfig;

  if (condition === "FAILED") {
    return {
      status: "Immediate Inspection Required",
      badgeClass: "status-failed",
      reason: `Emergency stop triggered on ${name}. Critical parameter exceeded safety threshold (${primaryContributor}).`,
      action:
        subtype === "cnc-milling" || subtype === "cnc-vmc"
          ? "Halt spindle drive immediately. Check cartridge ceramic bearings, verify tool clamp force, and inspect cutting fluid delivery."
          : subtype === "cnc-lathe" || subtype === "cnc-turning"
          ? "Disengage chuck drive, inspect headstock bearings and 4-way toolpost clamp, and replace chipped cutting insert."
          : subtype === "fdm-printer" || subtype === "industrial-printer"
          ? "Abort printing sequence, inspect hotend thermocouple cartridge, clean clogged nozzle orifice, and inspect extruder drive teeth."
          : "Disconnect external charger, inspect CPU cooler thermal paste contact, and verify exhaust fan bearing integrity.",
    };
  }

  if (condition === "CRITICAL") {
    return {
      status: "Maintenance Required",
      badgeClass: "status-critical",
      reason: `Elevated ${primaryContributor} is driving accelerated machine wear (${risk}% failure probability).`,
      action:
        subtype === "cnc-milling" || subtype === "cnc-vmc"
          ? "Perform spindle dynamic balancing, replenish synthetic way-lube, and inspect toolholder runout."
          : subtype === "cnc-lathe" || subtype === "cnc-turning"
          ? "Check 3-jaw chuck master jaw lubrication, tighten tailstock quill locking wedge, and verify hydraulic pressure."
          : subtype === "fdm-printer" || subtype === "industrial-printer"
          ? "Inspect linear guide rail backlash, recalibrate PID temperature tuning, and tighten X-axis timing belt tension."
          : "Clean dust from heatsink dissipation fins and run fan diagnostic sweep under controlled load.",
    };
  }

  if (condition === "WARNING") {
    return {
      status: "Inspection Recommended",
      badgeClass: "status-warning",
      reason: `${primaryContributor} has drifted above nominal operating tolerances.`,
      action:
        subtype === "cnc-milling" || subtype === "cnc-vmc"
          ? "Monitor coolant concentration, inspect cutting edge wear during shift changeover, and check axis harmonic vibration."
          : subtype === "cnc-lathe" || subtype === "cnc-turning"
          ? "Check cross-slide gib adjustment, verify coolant stream alignment with tool tip, and inspect workpiece concentricity."
          : subtype === "fdm-printer" || subtype === "industrial-printer"
          ? "Verify heated bed leveling mesh, check filament spool feed resistance, and inspect heatbreak fan airflow."
          : "Monitor background thermal throttling and verify charger voltage stability.",
    };
  }

  return {
    status: "Normal Operation",
    badgeClass: "status-normal",
    reason: "All monitored telemetry vectors are within baseline design limits.",
    action: "No immediate maintenance required. Continue standard preventive monitoring cycle.",
  };
}

// Format exact Date & Time strings
function getCurrentFormattedDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return { date, time, iso: now.toISOString() };
}

// Initial History Generator
function generateChartSeed(spec, isConnected) {
  const base = isConnected ? spec.baseConnected : spec.baseDisconnected;
  const history = [];
  const now = Date.now();

  for (let i = 24; i >= 0; i--) {
    const timeLabel = new Date(now - i * 2000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const tempNoise = Math.sin(i * 0.6) * 0.5;
    const temp = Number((base.temperature + tempNoise).toFixed(1));
    const workload = Number(base.workload.toFixed(1));
    const simVitals = { ...base, temperature: temp, workload };
    const { failureRisk, healthScore } = calculateRiskAndHealth(simVitals, spec);

    history.push({
      time: timeLabel,
      temperature: temp,
      vibration: base.vibration,
      motor_current: base.motor_current,
      torque: base.torque,
      failureRisk,
      healthScore,
      workload,
    });
  }
  return history;
}

// Custom Recharts Tooltip
function IndustrialChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="home-chart-tooltip">
        <div className="tooltip-time">{label}</div>
        <div className="tooltip-metrics">
          {payload.map((item, index) => (
            <div key={index} className="tooltip-row" style={{ color: item.color }}>
              <span>{item.name}:</span>
              <strong>
                {item.value} {item.unit || ""}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function Home() {
  // Machine Selection
  const [selectedMachineId, setSelectedMachineId] = useState("CNC-MILL-01");
  const machineConfig = MACHINE_SPECS[selectedMachineId] || MACHINE_SPECS["CNC-MILL-01"];

  // Data Source: 'PHYSICAL_INPUT' | 'SIMULATION' | 'REAL_DEVICE'
  const [dataSource, setDataSource] = useState("PHYSICAL_INPUT");

  // Hardware Battery API Detection
  const supportsBattery =
    typeof navigator !== "undefined" && typeof navigator.getBattery === "function";
  const [hasBatterySupport, setHasBatterySupport] = useState(supportsBattery);
  const [batteryCharging, setBatteryCharging] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(1.0);

  // Manual Demo AC Fallback
  const [demoAcConnected, setDemoAcConnected] = useState(true);

  // Forced Scenario Preset ('NORMAL' | 'THERMAL_WARNING' | 'VIBRATION_FAULT' | 'CRITICAL_OVERLOAD' | 'FAILED')
  const [activePreset, setActivePreset] = useState("NORMAL");

  // Effective AC State
  const effectiveAcConnected =
    dataSource === "PHYSICAL_INPUT" && hasBatterySupport
      ? batteryCharging
      : demoAcConnected;

  // Real-time Machine Vitals
  const [vitals, setVitals] = useState(() => ({ ...machineConfig.baseConnected }));

  // Live Chart History
  const [history, setHistory] = useState(() =>
    generateChartSeed(machineConfig, true)
  );

  // Dynamic Directional Trends
  const [trends, setTrends] = useState({
    temperature: "stable",
    vibration: "stable",
    motor_current: "stable",
    torque: "stable",
    rpm: "stable",
    workload: "stable",
  });

  // Shared & Local Active Alerts
  const { activeAlerts: sharedActiveAlerts } = useAlerts();
  const [localActiveAlerts, setLocalActiveAlerts] = useState([]);
  const lastAlertConditionRef = useRef("NORMAL");
  const activeAlerts =
    sharedActiveAlerts && sharedActiveAlerts.length > 0 ? sharedActiveAlerts : localActiveAlerts;

  // Chart View Selector: 'all' | 'temperature' | 'vibration' | 'risk'
  const [chartView, setChartView] = useState("all");

  const prevVitalsRef = useRef(vitals);
  const tickCounterRef = useRef(0);

  // Notify Layout topbar about active machine asset
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("rg-asset-change", {
        detail: machineConfig.name,
      })
    );
  }, [machineConfig.name]);

  // Switch Machine Handler
  const handleSelectMachine = (newId) => {
    if (newId === selectedMachineId) return;
    const oldSpec = MACHINE_SPECS[selectedMachineId] || machineConfig;
    // Reset previous machine in backend
    pushTelemetryToBackend(
      selectedMachineId,
      "NORMAL",
      18.0,
      oldSpec.baseConnected,
      "Operating Load",
      `Normal operation restored on ${selectedMachineId}`,
      "No maintenance required."
    );

    const spec = MACHINE_SPECS[newId];
    if (spec) {
      setSelectedMachineId(newId);
      const base = effectiveAcConnected ? spec.baseConnected : spec.baseDisconnected;
      setVitals({ ...base });
      setHistory(generateChartSeed(spec, effectiveAcConnected));
      setActivePreset("NORMAL");
      window.dispatchEvent(new CustomEvent("rg-asset-change", { detail: spec.name }));
    }
  };

  const pushTelemetryToBackend = async (
    targetMachineId,
    targetCondition,
    targetRisk,
    targetVitals,
    targetFactors,
    targetReason,
    targetAction
  ) => {
    try {
      const spec = MACHINE_SPECS[targetMachineId] || machineConfig;
      await API.post(`/machines/${targetMachineId}/telemetry`, {
        machine_id: targetMachineId,
        machine_type: spec.type,
        level: targetCondition,
        condition: targetCondition,
        failure_risk: targetRisk,
        risk_percentage: targetRisk,
        vitals: targetVitals,
        main_factors: targetFactors,
        reason: targetReason,
        recommendation: targetAction,
      });
    } catch (err) {
      console.error("Failed to push telemetry to backend:", err);
    }
  };

  // Scenario Preset Activation Handler
  const handleApplyPreset = (presetName) => {
    setActivePreset(presetName);
    const { subtype, type } = machineConfig;
    const isCNC = type === "CNC Machine";
    const isInd = subtype === "industrial-printer";
    const isLaptop = subtype === "laptop";

    if (presetName === "NORMAL") {
      setDemoAcConnected(true);
      const base = { ...machineConfig.baseConnected };
      setVitals(base);
      pushTelemetryToBackend(
        selectedMachineId,
        "NORMAL",
        18.0,
        base,
        "Operating Load",
        `Normal operation restored on ${selectedMachineId}`,
        "No maintenance required."
      );
    } else if (presetName === "THERMAL_WARNING") {
      const warnTemp = isLaptop ? 81.0 : isInd ? 318.0 : isCNC ? 81.5 : 232.0;
      const nextV = {
        ...vitals,
        workload: 84.0,
        motor_current: isLaptop ? 74.0 : isCNC ? 9.2 : 3.4,
        temperature: warnTemp,
        vibration: isLaptop ? 1.6 : isCNC ? 2.6 : 1.3,
      };
      setVitals(nextV);
      const { failureRisk } = calculateRiskAndHealth(nextV, machineConfig, "WARNING");
      const contrib = analyzeRiskContributors(nextV, machineConfig);
      const adv = getPredictedMaintenance(failureRisk, "WARNING", contrib.primaryContributor, machineConfig);
      pushTelemetryToBackend(
        selectedMachineId,
        "WARNING",
        failureRisk,
        nextV,
        contrib.mainContributors,
        adv.reason,
        adv.action
      );
    } else if (presetName === "VIBRATION_FAULT") {
      const nextV = {
        ...vitals,
        workload: 86.0,
        vibration: isLaptop ? 2.2 : isCNC ? 4.8 : 3.4,
        torque: isLaptop ? 6.2 : isCNC ? 7.2 : 3.0,
      };
      setVitals(nextV);
      const { failureRisk } = calculateRiskAndHealth(nextV, machineConfig, "WARNING");
      const contrib = analyzeRiskContributors(nextV, machineConfig);
      const adv = getPredictedMaintenance(failureRisk, "WARNING", contrib.primaryContributor, machineConfig);
      pushTelemetryToBackend(
        selectedMachineId,
        "WARNING",
        failureRisk,
        nextV,
        contrib.mainContributors,
        adv.reason,
        adv.action
      );
    } else if (presetName === "CRITICAL_OVERLOAD") {
      const critTemp = isLaptop ? 92.5 : isInd ? 342.0 : isCNC ? 93.0 : 252.0;
      const nextV = {
        ...vitals,
        workload: 95.0,
        temperature: critTemp,
        vibration: isLaptop ? 2.6 : isCNC ? 5.8 : 3.9,
        motor_current: isLaptop ? 88.0 : isCNC ? 12.5 : 4.6,
        torque: isLaptop ? 7.4 : isCNC ? 8.8 : 3.8,
      };
      setVitals(nextV);
      const { failureRisk } = calculateRiskAndHealth(nextV, machineConfig, "CRITICAL");
      const contrib = analyzeRiskContributors(nextV, machineConfig);
      const adv = getPredictedMaintenance(failureRisk, "CRITICAL", contrib.primaryContributor, machineConfig);
      pushTelemetryToBackend(
        selectedMachineId,
        "CRITICAL",
        failureRisk,
        nextV,
        contrib.mainContributors,
        adv.reason,
        adv.action
      );
    } else if (presetName === "FAILED") {
      const nextV = {
        ...vitals,
        rpm: 0,
        temperature: isLaptop ? 98.0 : isInd ? 365.0 : isCNC ? 104.0 : 265.0,
        vibration: isLaptop ? 3.1 : isCNC ? 7.2 : 4.6,
        motor_current: isLaptop ? 94.0 : isCNC ? 14.8 : 6.2,
      };
      setVitals(nextV);
      const { failureRisk } = calculateRiskAndHealth(nextV, machineConfig, "FAILED");
      const contrib = analyzeRiskContributors(nextV, machineConfig);
      const adv = getPredictedMaintenance(failureRisk, "FAILED", contrib.primaryContributor, machineConfig);
      pushTelemetryToBackend(
        selectedMachineId,
        "CRITICAL",
        failureRisk,
        nextV,
        contrib.mainContributors,
        adv.reason,
        adv.action
      );
    }
  };

  // Battery Status API Listener
  useEffect(() => {
    let batteryInstance = null;
    let isMounted = true;

    if (typeof navigator !== "undefined" && typeof navigator.getBattery === "function") {
      navigator
        .getBattery()
        .then((battery) => {
          if (!isMounted) return;
          batteryInstance = battery;
          setHasBatterySupport(true);
          setBatteryCharging(Boolean(battery.charging));
          if (typeof battery.level === "number") setBatteryLevel(battery.level);

          battery.addEventListener("chargingchange", (e) => {
            const isCharging = e?.target ? e.target.charging : batteryInstance?.charging;
            if (typeof isCharging === "boolean") setBatteryCharging(isCharging);
          });
        })
        .catch(() => {
          if (!isMounted) return;
          setHasBatterySupport(false);
          setDataSource("SIMULATION");
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Main Live Simulation & Correlated Physics Loop (every 1200ms)
  useEffect(() => {
    const simInterval = 1200;

    const timer = setInterval(() => {
      tickCounterRef.current += 1;
      const { subtype, type } = machineConfig;
      const isCNC = type === "CNC Machine";
      const isInd = subtype === "industrial-printer";
      const isLaptop = subtype === "laptop";

      setVitals((prev) => {
        let targetWorkload = effectiveAcConnected
          ? machineConfig.baseConnected.workload
          : machineConfig.baseDisconnected.workload;

        let targetTemp = effectiveAcConnected
          ? machineConfig.baseConnected.temperature
          : machineConfig.baseDisconnected.temperature;

        let targetVib = effectiveAcConnected
          ? machineConfig.baseConnected.vibration
          : machineConfig.baseDisconnected.vibration;

        let targetCurrent = effectiveAcConnected
          ? machineConfig.baseConnected.motor_current
          : machineConfig.baseDisconnected.motor_current;

        let targetTorque = effectiveAcConnected
          ? machineConfig.baseConnected.torque
          : machineConfig.baseDisconnected.torque;

        let targetRpm = effectiveAcConnected
          ? machineConfig.baseConnected.rpm
          : machineConfig.baseDisconnected.rpm;

        // Apply Preset overrides
        if (activePreset === "THERMAL_WARNING") {
          targetTemp = isLaptop ? 81.5 : isInd ? 318.0 : isCNC ? 82.0 : 230.0;
          targetWorkload = 84.0;
        } else if (activePreset === "VIBRATION_FAULT") {
          targetVib = isLaptop ? 2.2 : isCNC ? 4.8 : 3.4;
          targetTorque = isLaptop ? 6.2 : isCNC ? 6.8 : 2.9;
          targetWorkload = 85.0;
        } else if (activePreset === "CRITICAL_OVERLOAD") {
          targetTemp = isLaptop ? 92.5 : isInd ? 342.0 : isCNC ? 92.0 : 250.0;
          targetVib = isLaptop ? 2.6 : isCNC ? 5.6 : 3.8;
          targetCurrent = isLaptop ? 86.0 : isCNC ? 12.0 : 4.4;
          targetTorque = isLaptop ? 7.4 : isCNC ? 8.4 : 3.6;
          targetWorkload = 94.0;
        } else if (activePreset === "FAILED") {
          targetRpm = 0;
          targetTemp = isLaptop ? 98.0 : isInd ? 365.0 : isCNC ? 104.0 : 262.0;
          targetVib = isLaptop ? 3.0 : isCNC ? 7.0 : 4.5;
          targetCurrent = isLaptop ? 94.0 : isCNC ? 14.5 : 6.0;
        }

        // Smooth physics-based step transitions
        const wlStep = (targetWorkload - prev.workload) * 0.28 + (Math.random() - 0.5) * 0.2;
        const nextWorkload = Number(
          Math.max(10, Math.min(100, prev.workload + wlStep)).toFixed(1)
        );

        const currentStep =
          (targetCurrent - prev.motor_current) * 0.25 + (Math.random() - 0.5) * 0.05;
        const nextCurrent = Number(
          Math.max(0.4, prev.motor_current + currentStep).toFixed(1)
        );

        const torqueStep =
          (targetTorque - prev.torque) * 0.25 + (Math.random() - 0.5) * 0.04;
        const nextTorque = Number(Math.max(0.2, prev.torque + torqueStep).toFixed(1));

        const tempStep =
          (targetTemp - prev.temperature) * 0.22 + (Math.random() - 0.5) * 0.12;
        const nextTemp = Number(Math.max(20, prev.temperature + tempStep).toFixed(1));

        const vibStep = (targetVib - prev.vibration) * 0.25 + (Math.random() - 0.5) * 0.02;
        const nextVib = Number(Math.max(0.2, prev.vibration + vibStep).toFixed(1));

        const rpmStep = (targetRpm - prev.rpm) * 0.3 + (Math.random() - 0.5) * 3;
        const nextRpm = Math.round(Math.max(0, prev.rpm + rpmStep));

        const updated = {
          workload: nextWorkload,
          motor_current: nextCurrent,
          torque: nextTorque,
          temperature: nextTemp,
          vibration: nextVib,
          rpm: activePreset === "FAILED" ? 0 : nextRpm,
        };

        // Directional Trend Calculation
        if (tickCounterRef.current % 3 === 0 && prevVitalsRef.current) {
          const old = prevVitalsRef.current;
          const getTrend = (v1, v0, eps = 0.2) => {
            const diff = v1 - v0;
            if (Math.abs(diff) < eps) return "stable";
            return diff > 0 ? "increasing" : "decreasing";
          };
          setTrends({
            temperature: getTrend(updated.temperature, old.temperature, 0.3),
            vibration: getTrend(updated.vibration, old.vibration, 0.1),
            motor_current: getTrend(updated.motor_current, old.motor_current, 0.1),
            torque: getTrend(updated.torque, old.torque, 0.1),
            rpm: getTrend(updated.rpm, old.rpm, 6),
            workload: getTrend(updated.workload, old.workload, 0.8),
          });
          prevVitalsRef.current = updated;
        }

        // Correlated Risk and Health
        const { failureRisk, healthScore, condition } = calculateRiskAndHealth(
          updated,
          machineConfig,
          activePreset === "FAILED" ? "FAILED" : null
        );

        // Append to rolling chart
        const timeStr = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        setHistory((prevH) => [
          ...prevH.slice(-39),
          {
            time: timeStr,
            temperature: updated.temperature,
            vibration: updated.vibration,
            motor_current: updated.motor_current,
            torque: updated.torque,
            failureRisk,
            healthScore,
            workload: updated.workload,
          },
        ]);

        // Auto-generate meaningful Alert on condition transition
        if (condition !== lastAlertConditionRef.current && condition !== "NORMAL") {
          lastAlertConditionRef.current = condition;
          const contributorInfo = analyzeRiskContributors(updated, machineConfig);
          const advisory = getPredictedMaintenance(
            failureRisk,
            condition,
            contributorInfo.primaryContributor,
            machineConfig
          );

          pushTelemetryToBackend(
            selectedMachineId,
            condition === "FAILED" ? "CRITICAL" : condition,
            failureRisk,
            updated,
            contributorInfo.mainContributors,
            advisory.reason,
            advisory.action
          );
        } else if (condition === "NORMAL" && lastAlertConditionRef.current !== "NORMAL") {
          lastAlertConditionRef.current = "NORMAL";
          pushTelemetryToBackend(
            selectedMachineId,
            "NORMAL",
            failureRisk,
            updated,
            "Operating Load",
            `Machine ${selectedMachineId} returned to normal`,
            "No maintenance required."
          );
        }

        return updated;
      });
    }, simInterval);

    return () => clearInterval(timer);
  }, [effectiveAcConnected, activePreset, selectedMachineId, machineConfig]);

  // Derived current condition & contributor breakdown
  const { failureRisk, healthScore, condition } = calculateRiskAndHealth(
    vitals,
    machineConfig,
    activePreset === "FAILED" ? "FAILED" : null
  );
  const contributorData = analyzeRiskContributors(vitals, machineConfig);
  const maintenanceInfo = getPredictedMaintenance(
    failureRisk,
    condition,
    contributorData.primaryContributor,
    machineConfig
  );

  // Trend Badge Component
  const renderTrendBadge = (trend) => {
    if (trend === "increasing") {
      return (
        <span className="vital-trend trend-increasing">
          <TrendingUp size={12} />
          <span>↗ Increasing</span>
        </span>
      );
    }
    if (trend === "decreasing") {
      return (
        <span className="vital-trend trend-decreasing">
          <TrendingDown size={12} />
          <span>↘ Decreasing</span>
        </span>
      );
    }
    return (
      <span className="vital-trend trend-stable">
        <Minus size={12} />
        <span>→ Stable</span>
      </span>
    );
  };

  // Severity Pill Component
  const renderSeverityBadge = (level) => {
    const cls =
      level === "CRITICAL"
        ? "pill-critical"
        : level === "HIGH"
        ? "pill-high"
        : level === "MODERATE"
        ? "pill-moderate"
        : "pill-low";
    return <span className={`contributor-pill ${cls}`}>{level}</span>;
  };

  const isLaptop = machineConfig.subtype === "laptop";
  const isPrinter = machineConfig.type === "3D Printer";
  const isIndPrinter = machineConfig.subtype === "industrial-printer";

  return (
    <div className="home-page-container">
      {/* ============================================================
          SECTION 1: HERO OVERVIEW
          ============================================================ */}
      <section className="home-hero-section">
        <div className="home-hero-glow" />
        <div className="home-hero-wrapper">
          <div className="home-hero-content">
            <div className="home-badge-wrapper">
              <span className="home-badge-pill">
                <Sparkles size={14} className="badge-sparkle-icon" />
                CATCHING THE BREAKDOWN BEFORE IT HAPPENS
              </span>
            </div>

            <h1 className="home-hero-title">
              Protect Your Machines.
              <br />
              <span className="text-highlight">Catching the breakdown before it happens.</span>
            </h1>

            <p className="home-hero-description">
              Predictive maintenance platform for CNC machines and 3D printers. RiskGuard continuously monitors industrial
              assets through real-time telemetry and physical hardware signals, detecting abnormal
              vibration, thermal drift, and mechanical overload before catastrophic downtime occurs.
            </p>

            <div className="home-hero-actions">
              <Link to="/dashboard" className="home-btn home-btn-primary">
                <LayoutDashboard size={18} />
                <span>Open Dashboard</span>
              </Link>

              <Link to="/upload" className="home-btn home-btn-secondary">
                <Upload size={18} />
                <span>Upload Sensor Data</span>
              </Link>

              <Link to="/alerts" className="home-btn home-btn-outline">
                <AlertTriangle size={18} />
                <span>View Alert Stream</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: SIMULATION DEMO BANNER & CONTROLS
          ============================================================ */}
      <section className="home-sim-header-section">
        <div className="home-sim-banner">
          <div className="banner-left">
            <div className="banner-title-group">
              <h2>Live Digital Twin Simulation</h2>
              <div className="banner-status-indicators">
                <span
                  className={`live-status-badge ${
                    condition === "FAILED" ? "is-failed" : "is-live"
                  }`}
                >
                  <span className={`live-dot ${condition === "FAILED" ? "dot-failed" : ""}`} />
                  {condition === "FAILED" ? "FAULT STOPPED" : "SIMULATION ACTIVE"}
                </span>

                <span className="source-indicator-badge">
                  Source: <strong>{dataSource === "PHYSICAL_INPUT" ? "Physical Laptop Charger" : "Simulation Engine"}</strong>
                </span>
              </div>
            </div>

            <div className="banner-subtext">
              <Info size={14} className="info-icon" />
              <span>
                <strong>Physical Input → Virtual Machine:</strong> Real-time hardware signals
                and live engineering controls drive the interactive industrial digital twin.
              </span>
            </div>
          </div>

          <div className="banner-right">
            {/* Target Asset Dropdown */}
            <div className="machine-selector-wrapper">
              <span className="selector-label">Target Asset:</span>
              <div className="scada-asset-select-wrapper">
                <select
                  id="target-asset-select"
                  className="scada-asset-select"
                  value={selectedMachineId}
                  onChange={(e) => handleSelectMachine(e.target.value)}
                  aria-label="Target Asset Selection"
                >
                  <optgroup label="CNC MACHINES">
                    <option value="CNC-MILL-01">CNC Milling Machine (CNC-MILL-01)</option>
                    <option value="CNC-LATHE-02">CNC Lathe Machine (CNC-LATHE-02)</option>
                    <option value="CNC-VMC-03">CNC Vertical Machining Center (CNC-VMC-03)</option>
                    <option value="CNC-TURN-04">CNC Turning Center (CNC-TURN-04)</option>
                  </optgroup>
                  <optgroup label="3D PRINTERS">
                    <option value="3DP-FDM-01">FDM 3D Printer (3DP-FDM-01)</option>
                    <option value="3DP-IND-02">Industrial 3D Printer (3DP-IND-02)</option>
                  </optgroup>
                  <optgroup label="PHYSICAL / DEMO INPUT">
                    <option value="LAPTOP-TWIN-01">Laptop Digital Twin (LAPTOP-TWIN-01)</option>
                  </optgroup>
                </select>
                <ChevronRight size={14} className="scada-select-arrow" style={{ transform: "rotate(90deg)" }} />
              </div>
            </div>

            {/* Source Mode Selector */}
            <div className="source-selector-wrapper">
              <span className="selector-label">Data Mode:</span>
              <div className="machine-toggle-group">
                <button
                  type="button"
                  className={`machine-tab-btn ${dataSource === "PHYSICAL_INPUT" ? "active" : ""}`}
                  onClick={() => setDataSource("PHYSICAL_INPUT")}
                  title="Driven by Laptop AC Charger"
                >
                  <PlugZap size={13} />
                  <span>Physical AC</span>
                </button>
                <button
                  type="button"
                  className={`machine-tab-btn ${dataSource === "SIMULATION" ? "active" : ""}`}
                  onClick={() => setDataSource("SIMULATION")}
                  title="Interactive Demonstration Controls"
                >
                  <Sliders size={13} />
                  <span>Simulation</span>
                </button>
                <button
                  type="button"
                  className={`machine-tab-btn ${dataSource === "REAL_DEVICE" ? "active" : ""}`}
                  onClick={() => setDataSource("REAL_DEVICE")}
                  title="OPC-UA / MQTT IoT Gateway Ready"
                >
                  <Radio size={13} />
                  <span>IoT Gateway</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            SECTION 3: 3D DIGITAL TWIN & INTERACTIVE CONTROL CENTER
            ============================================================ */}
        <div className="twins-and-controls-grid">
          {/* Left: 3D Machine Simulation Canvas */}
          <div className="digital-twin-column">
            <Machine3DViewer
              machineType={machineConfig.type}
              machineId={selectedMachineId}
              subtype={machineConfig.subtype}
              vitals={vitals}
              condition={condition}
              isLive={true}
              isAcConnected={effectiveAcConnected}
            />
          </div>

          {/* Right: Live Interactive Control Deck */}
          <div className="control-deck-column">
            <div className="deck-card">
              <div className="deck-card-header">
                <span className="deck-kicker">HACKATHON LIVE DEMO CONTROL DECK</span>
                <span className="deck-badge">Interactive State Tuning</span>
              </div>

              {/* Presets Grid */}
              <div className="presets-section">
                <span className="deck-sublabel">Condition Presets (Live Trigger):</span>
                <div className="presets-btn-grid">
                  <button
                    type="button"
                    className={`preset-btn preset-normal ${activePreset === "NORMAL" ? "is-active" : ""}`}
                    onClick={() => handleApplyPreset("NORMAL")}
                  >
                    <CheckCircle2 size={13} />
                    <span>1. Normal Operation</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn preset-warning ${activePreset === "THERMAL_WARNING" ? "is-active" : ""}`}
                    onClick={() => handleApplyPreset("THERMAL_WARNING")}
                  >
                    <Flame size={13} />
                    <span>2. Thermal Warning</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn preset-warning ${activePreset === "VIBRATION_FAULT" ? "is-active" : ""}`}
                    onClick={() => handleApplyPreset("VIBRATION_FAULT")}
                  >
                    <Activity size={13} />
                    <span>3. Vibration Surge</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn preset-critical ${activePreset === "CRITICAL_OVERLOAD" ? "is-active" : ""}`}
                    onClick={() => handleApplyPreset("CRITICAL_OVERLOAD")}
                  >
                    <AlertTriangle size={13} />
                    <span>4. Critical Overload</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn preset-failed ${activePreset === "FAILED" ? "is-active" : ""}`}
                    onClick={() => handleApplyPreset("FAILED")}
                  >
                    <AlertOctagon size={13} />
                    <span>5. Emergency Fault</span>
                  </button>
                </div>
              </div>

              {/* Physical AC Signal Controls */}
              <div className="physical-input-section">
                <div className="section-label-row">
                  <span className="deck-sublabel">Physical Signal Driver (Laptop Charger):</span>
                  {hasBatterySupport && (
                    <span className="battery-badge">
                      Hardware Sensor: {effectiveAcConnected ? "PLUGGED IN" : "ON BATTERY"} ({Math.round(batteryLevel * 100)}%)
                    </span>
                  )}
                </div>

                <div className="fallback-buttons-row">
                  <button
                    type="button"
                    className={`demo-ac-btn btn-plugged ${effectiveAcConnected ? "is-active" : ""}`}
                    onClick={() => {
                      setDemoAcConnected(true);
                      setActivePreset("NORMAL");
                    }}
                  >
                    <PlugZap size={14} />
                    <span>AC CONNECTED (High Load)</span>
                  </button>

                  <button
                    type="button"
                    className={`demo-ac-btn btn-unplugged ${!effectiveAcConnected ? "is-active" : ""}`}
                    onClick={() => {
                      setDemoAcConnected(false);
                      setActivePreset("NORMAL");
                    }}
                  >
                    <BatteryCharging size={14} />
                    <span>AC DISCONNECTED (Idle/Cool)</span>
                  </button>
                </div>
              </div>

              {/* Real-time Fine-Tuning Sliders */}
              <div className="sliders-section">
                <span className="deck-sublabel">Live Parameter Overrides:</span>

                <div className="slider-item">
                  <div className="slider-label-row">
                    <span>Operating Workload:</span>
                    <strong>{vitals.workload}%</strong>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="1"
                    value={vitals.workload}
                    onChange={(e) =>
                      setVitals((prev) => ({
                        ...prev,
                        workload: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="slider-item">
                  <div className="slider-label-row">
                    <span>{machineConfig.units.tempLabel}:</span>
                    <strong>{vitals.temperature} °C</strong>
                  </div>
                  <input
                    type="range"
                    min={isPrinter ? (isIndPrinter ? "180" : "150") : "30"}
                    max={isPrinter ? (isIndPrinter ? "360" : "270") : "110"}
                    step="0.5"
                    value={vitals.temperature}
                    onChange={(e) =>
                      setVitals((prev) => ({
                        ...prev,
                        temperature: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="slider-item">
                  <div className="slider-label-row">
                    <span>Vibration Harmonics:</span>
                    <strong>{vitals.vibration} mm/s</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max={isLaptop ? "3.2" : "8.0"}
                    step="0.1"
                    value={vitals.vibration}
                    onChange={(e) =>
                      setVitals((prev) => ({
                        ...prev,
                        vibration: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: LIVE CONDITION EXPLANATION BANNER
          ============================================================ */}
      <section className={`condition-announcement-card condition-border-${condition.toLowerCase()}`}>
        <div className="announcement-left">
          <div className={`announcement-icon-box box-${condition.toLowerCase()}`}>
            {condition === "NORMAL" && <CheckCircle2 size={24} />}
            {condition === "WARNING" && <AlertTriangle size={24} />}
            {condition === "CRITICAL" && <ShieldAlert size={24} />}
            {condition === "FAILED" && <AlertOctagon size={24} />}
          </div>

          <div className="announcement-copy">
            <div className="announcement-top-line">
              <span className={`condition-tag-pill tag-${condition.toLowerCase()}`}>
                ● {condition}
              </span>
              <strong className="announcement-machine">{selectedMachineId} ({machineConfig.name})</strong>
              <span className="announcement-risk">Failure Risk: <strong>{failureRisk}%</strong></span>
            </div>
            <p className="announcement-text">
              {condition === "FAILED"
                ? `CRITICAL FAULT: Machine operation has halted due to catastrophic ${contributorData.primaryContributor.toLowerCase()} overload. Safety interlock active.`
                : condition === "CRITICAL"
                ? `CRITICAL CONDITION: Machine failure risk is elevated (${failureRisk}%). Primary degradation driver is abnormal ${contributorData.primaryContributor.toLowerCase()}. Prescriptive maintenance intervention required.`
                : condition === "WARNING"
                ? `WARNING: ${contributorData.primaryContributor} has drifted above nominal design limits. Failure risk is currently ${failureRisk}%.`
                : "NORMAL: Machine operates with optimal thermal balance, mechanical stability, and nominal cutting load."}
            </p>
          </div>
        </div>

        <div className="announcement-right">
          <span className="health-display-label">Asset Health</span>
          <div className="health-display-val">
            <strong>{healthScore}</strong>
            <small>/ 100</small>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5: LIVE MACHINE VITALS GRID
          ============================================================ */}
      <section className="home-vitals-section">
        <div className="section-title-bar">
          <div>
            <span className="section-kicker">REAL-TIME SENSOR TELEMETRY</span>
            <h2 className="section-heading">Live Machine Vitals</h2>
          </div>
          <div className="vitals-meta-tag">
            <span className="live-dot" />
            <span>Streaming continuous telemetry to degradation model</span>
          </div>
        </div>

        <div className="vitals-cards-grid">
          {/* 1. Temperature */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <Thermometer size={16} className="metric-icon icon-temperature" />
                <span className="metric-name">{machineConfig.units.tempLabel}</span>
              </div>
              {renderTrendBadge(trends.temperature)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.temperature}</span>
              <span className="metric-unit">°C</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-temp"
                style={{
                  width: `${Math.min(
                    100,
                    isPrinter
                      ? (vitals.temperature / (isIndPrinter ? 350 : 260)) * 100
                      : (vitals.temperature / 100) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Nominal limit: {machineConfig.units.tempLimit}</span>
            </div>
          </div>

          {/* 2. Vibration */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <Activity size={16} className="metric-icon icon-vibration" />
                <span className="metric-name">Mechanical Vibration</span>
              </div>
              {renderTrendBadge(trends.vibration)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.vibration}</span>
              <span className="metric-unit">mm/s</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-vib"
                style={{
                  width: `${Math.min(
                    100,
                    (vitals.vibration / (isLaptop ? 2.5 : 6.5)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Nominal limit: {machineConfig.units.vibLimit}</span>
            </div>
          </div>

          {/* 3. Motor Current / Power */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <Zap size={16} className="metric-icon icon-current" />
                <span className="metric-name">{machineConfig.units.currentLabel}</span>
              </div>
              {renderTrendBadge(trends.motor_current)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.motor_current}</span>
              <span className="metric-unit">{machineConfig.units.currentUnit}</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-current"
                style={{
                  width: `${Math.min(
                    100,
                    (vitals.motor_current / machineConfig.units.currentMax) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Rated limit: {machineConfig.units.currentLimit}</span>
            </div>
          </div>

          {/* 4. Torque / Force */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <Gauge size={16} className="metric-icon icon-torque" />
                <span className="metric-name">{machineConfig.units.torqueLabel}</span>
              </div>
              {renderTrendBadge(trends.torque)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.torque}</span>
              <span className="metric-unit">{machineConfig.units.torqueUnit}</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-torque"
                style={{
                  width: `${Math.min(
                    100,
                    (vitals.torque / machineConfig.units.torqueMax) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Peak rating: {machineConfig.units.torqueLimit}</span>
            </div>
          </div>

          {/* 5. Speed / RPM */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <RotateCw size={16} className="metric-icon icon-rpm" />
                <span className="metric-name">{machineConfig.units.speedLabel}</span>
              </div>
              {renderTrendBadge(trends.rpm)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.rpm}</span>
              <span className="metric-unit">{machineConfig.units.speed}</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-rpm"
                style={{
                  width: `${Math.min(
                    100,
                    (vitals.rpm / (isLaptop ? 5000 : isPrinter ? 150 : 8500)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Operating band: {machineConfig.units.speedBand}</span>
            </div>
          </div>

          {/* 6. Workload */}
          <div className="vital-metric-card">
            <div className="metric-card-top">
              <div className="metric-header-left">
                <Cpu size={16} className="metric-icon icon-workload" />
                <span className="metric-name">Operating Workload</span>
              </div>
              {renderTrendBadge(trends.workload)}
            </div>

            <div className="metric-reading-row">
              <span className="metric-value">{vitals.workload}</span>
              <span className="metric-unit">%</span>
            </div>

            <div className="metric-progress-track">
              <div
                className="metric-progress-fill fill-workload"
                style={{ width: `${vitals.workload}%` }}
              />
            </div>
            <div className="metric-card-footer">
              <span>Target load: {effectiveAcConnected ? "High (~75%)" : "Idle (~32%)"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6: RISK CONTRIBUTORS & PREDICTED MAINTENANCE
          ============================================================ */}
      <section className="contributors-and-maintenance-grid">
        {/* Card A: Risk Contributors */}
        <div className="home-panel-card">
          <div className="panel-card-header">
            <div>
              <span className="section-kicker">PHYSICAL DEGRADATION VECTORS</span>
              <h3 className="panel-title">Risk Contributors</h3>
            </div>
            <span className="panel-tag">Telemetry Vector Analysis</span>
          </div>

          <div className="contributors-list">
            <div className="contributor-row">
              <div className="contributor-name-group">
                <Thermometer size={16} className="text-red" />
                <span>{machineConfig.units.tempLabel}</span>
              </div>
              <div className="contributor-status-group">
                <span className="contributor-val">{vitals.temperature} °C</span>
                {renderSeverityBadge(contributorData.temperature)}
              </div>
            </div>

            <div className="contributor-row">
              <div className="contributor-name-group">
                <Activity size={16} className="text-amber" />
                <span>Mechanical Vibration</span>
              </div>
              <div className="contributor-status-group">
                <span className="contributor-val">{vitals.vibration} mm/s</span>
                {renderSeverityBadge(contributorData.vibration)}
              </div>
            </div>

            <div className="contributor-row">
              <div className="contributor-name-group">
                <Gauge size={16} className="text-green" />
                <span>{machineConfig.units.torqueLabel}</span>
              </div>
              <div className="contributor-status-group">
                <span className="contributor-val">{vitals.torque} {machineConfig.units.torqueUnit}</span>
                {renderSeverityBadge(contributorData.torque)}
              </div>
            </div>

            <div className="contributor-row">
              <div className="contributor-name-group">
                <Zap size={16} className="text-blue" />
                <span>{machineConfig.units.currentLabel}</span>
              </div>
              <div className="contributor-status-group">
                <span className="contributor-val">{vitals.motor_current} {machineConfig.units.currentUnit}</span>
                {renderSeverityBadge(contributorData.motorCurrent)}
              </div>
            </div>

            <div className="contributor-row">
              <div className="contributor-name-group">
                <Cpu size={16} className="text-cyan" />
                <span>Operating Workload</span>
              </div>
              <div className="contributor-status-group">
                <span className="contributor-val">{vitals.workload} %</span>
                {renderSeverityBadge(contributorData.workload)}
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Predicted Maintenance */}
        <div className="home-panel-card maintenance-advisory-card">
          <div className="panel-card-header">
            <div>
              <span className="section-kicker">INTELLIGENT PRESCRIPTIVE AI</span>
              <h3 className="panel-title">Predicted Maintenance</h3>
            </div>
            <span className={`advisory-status-badge ${maintenanceInfo.badgeClass}`}>
              {maintenanceInfo.status}
            </span>
          </div>

          <div className="maintenance-details-body">
            <div className="advisory-field">
              <span className="advisory-field-label">Diagnosis Reason:</span>
              <p className="advisory-reason">{maintenanceInfo.reason}</p>
            </div>

            <div className="advisory-field">
              <span className="advisory-field-label">Primary Contributing Parameter:</span>
              <strong className="advisory-contributor">{contributorData.mainContributors}</strong>
            </div>

            <div className="advisory-field">
              <span className="advisory-field-label">Recommended Corrective Action:</span>
              <div className="advisory-action-box">
                <Wrench size={16} className="action-wrench-icon" />
                <span>{maintenanceInfo.action}</span>
              </div>
            </div>

            <div className="advisory-footer-meta">
              <span>Failure Probability: <strong>{failureRisk}%</strong></span>
              <span>Health Score: <strong>{healthScore} / 100</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7: LIVE SIGNALS CHARTS
          ============================================================ */}
      <section className="home-chart-section">
        <div className="chart-panel-container">
          <div className="chart-panel-header">
            <div>
              <span className="section-kicker">STREAMING SENSOR HISTOGRAM</span>
              <h3 className="chart-title">Live Signals & Trend Graphs</h3>
            </div>

            {/* View Filter Buttons */}
            <div className="chart-filter-pills">
              <button
                type="button"
                className={`chart-filter-btn ${chartView === "all" ? "is-active" : ""}`}
                onClick={() => setChartView("all")}
              >
                All Signals
              </button>
              <button
                type="button"
                className={`chart-filter-btn ${chartView === "temperature" ? "is-active" : ""}`}
                onClick={() => setChartView("temperature")}
              >
                Temperature Trend
              </button>
              <button
                type="button"
                className={`chart-filter-btn ${chartView === "vibration" ? "is-active" : ""}`}
                onClick={() => setChartView("vibration")}
              >
                Vibration Trend
              </button>
              <button
                type="button"
                className={`chart-filter-btn ${chartView === "risk" ? "is-active" : ""}`}
                onClick={() => setChartView("risk")}
              >
                Failure Risk
              </button>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={history} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gVib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--rg-border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="time"
                  stroke="var(--rg-text-secondary)"
                  fontSize={11}
                  tickLine={false}
                  minTickGap={24}
                />

                {(chartView === "all" || chartView === "temperature") && (
                  <YAxis
                    yAxisId="temp"
                    stroke="#3b82f6"
                    fontSize={11}
                    tickLine={false}
                    domain={isPrinter ? [140, 360] : [30, 115]}
                    unit="°C"
                  />
                )}

                {(chartView === "all" || chartView === "vibration") && (
                  <YAxis
                    yAxisId="vib"
                    orientation={chartView === "vibration" ? "left" : "right"}
                    stroke="#f59e0b"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, isLaptop ? 4 : 8]}
                    unit="mm/s"
                  />
                )}

                {chartView === "risk" && (
                  <YAxis
                    yAxisId="risk"
                    stroke="#ef4444"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                )}

                <Tooltip content={<IndustrialChartTooltip />} />

                {(chartView === "all" || chartView === "temperature") && (
                  <Area
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature"
                    stroke="#3b82f6"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#gTemp)"
                    unit="°C"
                    isAnimationActive={false}
                  />
                )}

                {(chartView === "all" || chartView === "vibration") && (
                  <Area
                    yAxisId="vib"
                    type="monotone"
                    dataKey="vibration"
                    name="Vibration"
                    stroke="#f59e0b"
                    strokeWidth={2.0}
                    fillOpacity={1}
                    fill="url(#gVib)"
                    unit="mm/s"
                    isAnimationActive={false}
                  />
                )}

                {(chartView === "all" || chartView === "risk") && (
                  <Area
                    yAxisId={chartView === "risk" ? "risk" : "temp"}
                    type="monotone"
                    dataKey="failureRisk"
                    name="Failure Risk"
                    stroke="#ef4444"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#gRisk)"
                    unit="%"
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-footer-legend">
            <div className="legend-item">
              <span className="legend-indicator indicator-temp" />
              <span>{machineConfig.units.tempLabel} (°C)</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator indicator-vib" />
              <span>Vibration (mm/s)</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator indicator-risk" />
              <span>Failure Risk (%)</span>
            </div>
            <div className="legend-meta">
              <span>Rolling buffer of latest 40 readings (Synchronous digital twin state)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8: LIVE ALERTS LOG WITH EXACT TIMESTAMPS
          ============================================================ */}
      <section className="home-alerts-section">
        <div className="section-title-bar">
          <div>
            <span className="section-kicker">EVENT-DRIVEN CONDITION LOG</span>
            <h2 className="section-heading">Live Incident & Alert Stream</h2>
          </div>
          <Link to="/alerts?tab=logs" className="view-all-alerts-link">
            <span>View Full Alerts History</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="alerts-empty-box">
            <CheckCircle2 size={24} className="text-green" />
            <div>
              <strong>No active incident alerts.</strong>
              <span>
                Alerts are triggered automatically when machine condition transitions into Warning,
                Critical, or Fault states.
              </span>
            </div>
          </div>
        ) : (
          <div className="live-alerts-grid">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`live-alert-card card-border-${String(alert.level).toLowerCase()}`}
              >
                <div className="alert-top-row">
                  <div className="alert-identity">
                    <span className={`alert-level-badge badge-${String(alert.level).toLowerCase()}`}>
                      {alert.level}
                    </span>
                    <strong>{alert.machine_id}</strong>
                    <span className="alert-type-label">({alert.machine_type})</span>
                  </div>

                  <div className="alert-timestamp-group">
                    <span className="timestamp-date">{alert.date}</span>
                    <span className="timestamp-time">{alert.time}</span>
                  </div>
                </div>

                <div className="alert-metrics-row">
                  <span>
                    Failure Risk: <strong>{alert.failure_risk}%</strong>
                  </span>
                  <span>
                    Main Contributors: <strong>{alert.main_factors}</strong>
                  </span>
                  <span>
                    Status: <strong className="text-amber">{alert.status}</strong>
                  </span>
                </div>

                <p className="alert-reason-text">
                  <strong>Reason: </strong>
                  {alert.reason}
                </p>

                <div className="alert-action-pill">
                  <Wrench size={13} />
                  <span>
                    <strong>Recommended Action: </strong>
                    {alert.recommendation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============================================================
          SECTION 9: ARCHITECTURE PIPELINE EXPLANATION
          ============================================================ */}
      <section className="home-pipeline-section">
        <div className="pipeline-header">
          <span className="section-kicker">DEMONSTRATION ARCHITECTURE</span>
          <h2 className="section-heading">Physical Input → Virtual Machine Pipeline</h2>
          <p className="pipeline-subtitle">
            Single Source of Truth: Physical hardware and live telemetry drive digital twin
            animation, ML risk scoring, and predictive maintenance.
          </p>
        </div>

        <div className="pipeline-flow-container">
          <div className={`pipeline-step-card ${effectiveAcConnected ? "step-connected" : "step-disconnected"}`}>
            <div className="step-badge">1. Input Ingestion</div>
            <div className="step-icon-wrap">
              {effectiveAcConnected ? (
                <PlugZap size={22} className="step-icon text-green" />
              ) : (
                <Battery size={22} className="step-icon text-amber" />
              )}
            </div>
            <h4 className="step-title">AC Power State</h4>
            <div className="step-value-highlight">
              {effectiveAcConnected ? "AC CONNECTED" : "AC DISCONNECTED"}
            </div>
            <p className="step-description">
              Hardware charger telemetry captured from local OS battery status.
            </p>
          </div>

          <div className="pipeline-arrow-divider">
            <ChevronRight size={22} className="pipeline-arrow desktop-arrow" />
            <ArrowRight size={20} className="pipeline-arrow mobile-arrow" />
          </div>

          <div className="pipeline-step-card">
            <div className="step-badge">2. Machine Load</div>
            <div className="step-icon-wrap">
              <Cpu size={22} className="step-icon text-blue" />
            </div>
            <h4 className="step-title">Virtual Workload</h4>
            <div className="step-value-highlight">{vitals.workload}% Duty Cycle</div>
            <p className="step-description">
              {effectiveAcConnected
                ? "Demands active cutting/printing load"
                : "Steps down to idling standby mode"}
            </p>
          </div>

          <div className="pipeline-arrow-divider">
            <ChevronRight size={22} className="pipeline-arrow desktop-arrow" />
            <ArrowRight size={20} className="pipeline-arrow mobile-arrow" />
          </div>

          <div className="pipeline-step-card">
            <div className="step-badge">3. 3D Digital Twin</div>
            <div className="step-icon-wrap">
              <Layers size={22} className="step-icon text-cyan" />
            </div>
            <h4 className="step-title">Live 3D Motion</h4>
            <div className="step-value-highlight">
              {vitals.temperature}°C • {vitals.rpm} {machineConfig.units.speed}
            </div>
            <p className="step-description">
              Real-time spindle rotation, axis toolpaths, and dynamic thermal glow.
            </p>
          </div>

          <div className="pipeline-arrow-divider">
            <ChevronRight size={22} className="pipeline-arrow desktop-arrow" />
            <ArrowRight size={20} className="pipeline-arrow mobile-arrow" />
          </div>

          <div className="pipeline-step-card">
            <div className="step-badge">4. Degradation Model</div>
            <div className="step-icon-wrap">
              <ShieldCheck size={22} className="step-icon text-green" />
            </div>
            <h4 className="step-title">Machine Health</h4>
            <div className="step-value-highlight">{healthScore} / 100</div>
            <p className="step-description">
              Asset health index computed across multi-parameter sensor vectors.
            </p>
          </div>

          <div className="pipeline-arrow-divider">
            <ChevronRight size={22} className="pipeline-arrow desktop-arrow" />
            <ArrowRight size={20} className="pipeline-arrow mobile-arrow" />
          </div>

          <div className="pipeline-step-card">
            <div className="step-badge">5. AI Risk & Alert</div>
            <div className="step-icon-wrap">
              <AlertTriangle size={22} className="step-icon text-red" />
            </div>
            <h4 className="step-title">Failure Risk & Advisory</h4>
            <div className="step-value-highlight">
              {failureRisk}% [{condition}]
            </div>
            <p className="step-description">
              Automatic alert emission with exact timestamps and prescriptive actions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
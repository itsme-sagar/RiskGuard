export interface Machine {
  id: number;
  serial_number: string;
  name: string;
  machine_type: string;
  model: string;
  location: string;
  install_date: string;
  operational_status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  operating_hours: number;
  threshold_sensitivity: number;
  created_at: string;
}

export interface Telemetry {
  machine_id: number;
  name: string;
  serial_number: string;
  machine_type: string;
  location: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  failure_risk: number;
  temperature: number;
  vibration: number;
  motor_current: number;
  rpm: number;
  operating_hours: number;
  workload: number;
  feature_importance: Record<string, number>;
  timestamp: string;
}

export interface Alert {
  id: number;
  time: string;
  machine_id: number;
  machine_name: string;
  previous_risk: number;
  current_risk: number;
  status: string;
  message: string;
  acknowledged: number;
}

export interface MaintenanceRecord {
  id: number;
  machine_id: number;
  machine_name: string;
  date: string;
  issue: string;
  action: string;
  technician: string;
  notes: string;
}

export interface HistoricalReading {
  id: number;
  time: string;
  machine_id: number;
  temperature: number;
  vibration: number;
  motor_current: number;
  rpm: number;
  operating_hours: number;
  workload: number;
}
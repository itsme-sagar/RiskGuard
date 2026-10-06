import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  Activity, AlertTriangle, Wrench, Play, Pause, RotateCcw, Zap, Gauge,
  Thermometer, Wind, Clock, Cpu, Menu, X, AlertCircle, CheckCircle,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import { Machine, Telemetry, Alert, MaintenanceRecord } from './types'
import './index.css'

type AnyRecord = Record<string, any>

interface ChartPoint {
  time: string
  temperature?: number
  vibration?: number
  motor_current?: number
  rpm?: number
  workload?: number
}

const API_BASE = '/api'

function riskPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n))
}

function normalizeStatus(value: unknown, risk: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  const s = String(value ?? '').toUpperCase()
  if (s === 'CRITICAL' || s === 'BROKEN') return 'CRITICAL'
  if (s === 'WARNING' || s === 'MAINTENANCE') return 'WARNING'
  if (risk >= 70) return 'CRITICAL'
  if (risk >= 40) return 'WARNING'
  return 'NORMAL'
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function normalizePrediction(raw: AnyRecord): AnyRecord {
  const risk = riskPercent(
    raw.failure_risk ?? raw.failure_probability ?? raw.risk ?? raw.predicted_risk,
  )
  return {
    risk,
    status: normalizeStatus(raw.status ?? raw.predicted_status ?? raw.condition, risk),
    failureType: String(raw.predicted_failure_type ?? raw.failure_type ?? raw.prediction ?? 'NORMAL'),
    featureImportance: (raw.feature_importance ?? raw.features ?? {}) as Record<string, number>,
  }
}

function readingsToValues(raw: unknown): Record<string, number> {
  const values: Record<string, number> = {}
  if (!Array.isArray(raw)) return values

  for (const row of raw as AnyRecord[]) {
    const sensor = String(row.sensor_type ?? row.sensor ?? row.name ?? '').toLowerCase()
    const value = Number(row.value ?? row.reading ?? row.measurement)
    if (!Number.isFinite(value)) continue

    if (sensor.includes('temperature') || sensor === 'temp') values.temperature = value
    else if (sensor.includes('vibration')) values.vibration = value
    else if (sensor.includes('motor') && sensor.includes('current')) values.motor_current = value
    else if (sensor === 'current' || sensor.includes('current')) values.motor_current = value
    else if (sensor === 'rpm' || sensor.includes('speed')) values.rpm = value
    else if (sensor.includes('workload') || sensor.includes('load')) values.workload = value
    else if (sensor.includes('operating')) values.operating_hours = value
  }

  return values
}

function normalizeHistory(raw: unknown): ChartPoint[] {
  if (!Array.isArray(raw)) return []
  const groups: Record<string, ChartPoint> = {}

  for (const row of raw as AnyRecord[]) {
    const time = String(row.time ?? row.timestamp ?? row.created_at ?? '')
    if (!time) continue
    groups[time] ??= { time }

    const sensor = String(row.sensor_type ?? row.sensor ?? '').toLowerCase()
    const value = Number(row.value ?? row.reading ?? row.measurement)
    if (!Number.isFinite(value)) continue

    if (row.temperature !== undefined || sensor.includes('temperature') || sensor === 'temp') {
      groups[time].temperature = firstNumber(row.temperature, value)
    }
    if (row.vibration !== undefined || sensor.includes('vibration')) {
      groups[time].vibration = firstNumber(row.vibration, value)
    }
    if (row.motor_current !== undefined || sensor.includes('current')) {
      groups[time].motor_current = firstNumber(row.motor_current, value)
    }
    if (row.rpm !== undefined || sensor === 'rpm') {
      groups[time].rpm = firstNumber(row.rpm, value)
    }
    if (row.workload !== undefined || sensor.includes('workload') || sensor.includes('load')) {
      groups[time].workload = firstNumber(row.workload, value)
    }
  }

  return Object.values(groups)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(-120)
}

export default function App() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [telemetry, setTelemetry] = useState<Record<number, Telemetry>>({})
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [history, setHistory] = useState<ChartPoint[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'maintenance'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [simScenario, setSimScenario] = useState('NORMAL')
  const [simSpeed, setSimSpeed] = useState(1)
  const [simRunning, setSimRunning] = useState(false)
  const [error, setError] = useState('')
  const previousStatus = useRef<Record<number, string>>({})

  const fetchJson = async (path: string, init?: RequestInit): Promise<any> => {
    const response = await fetch(`${API_BASE}${path}`, init)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return response.json()
  }

  const fetchMachines = async (): Promise<Machine[]> => {
    const data = await fetchJson('/machines')
    const list = Array.isArray(data) ? data : []
    setMachines(list)
    if (selectedMachineId === null && list.length > 0) setSelectedMachineId(list[0].id)
    return list
  }

  const fetchAlerts = async () => {
    try { setAlerts(await fetchJson('/alerts')) } catch (e) { console.error('Alerts:', e) }
  }

  const fetchMaintenance = async () => {
    try { setMaintenance(await fetchJson('/maintenance')) } catch (e) { console.error('Maintenance:', e) }
  }

  const fetchMachineTelemetry = async (machineList: Machine[]) => {
    try {
      const results = await Promise.all(machineList.map(async (machine) => {
        try {
          const [predictionRaw, readingsRaw] = await Promise.all([
            fetchJson(`/machines/${machine.id}/prediction`),
            fetchJson(`/machines/${machine.id}/readings?hours=1`),
          ])

          const prediction = normalizePrediction(predictionRaw ?? {})
          const sensorValues = readingsToValues(readingsRaw)
          const raw = predictionRaw as AnyRecord
          const direct = (raw?.readings ?? raw?.latest_reading ?? {}) as AnyRecord

          const t: Telemetry = {
            machine_id: machine.id,
            name: machine.name,
            serial_number: machine.serial_number,
            machine_type: machine.machine_type,
            location: machine.location,
            status: prediction.status,
            failure_risk: prediction.risk,
            temperature: firstNumber(sensorValues.temperature, direct.temperature, raw.temperature),
            vibration: firstNumber(sensorValues.vibration, direct.vibration, raw.vibration),
            motor_current: firstNumber(sensorValues.motor_current, direct.motor_current, raw.motor_current),
            rpm: firstNumber(sensorValues.rpm, direct.rpm, raw.rpm),
            operating_hours: firstNumber(machine.operating_hours, direct.operating_hours, raw.operating_hours),
            workload: firstNumber(sensorValues.workload, direct.workload, raw.workload),
            feature_importance: prediction.featureImportance,
            timestamp: String(raw.timestamp ?? raw.time ?? new Date().toISOString()),
          }
          return t
        } catch (e) {
          console.error(`Telemetry for ${machine.id}:`, e)
          return null
        }
      }))

      const next: Record<number, Telemetry> = {}
      for (const item of results) {
        if (!item) continue
        next[item.machine_id] = item
        if (previousStatus.current[item.machine_id] && previousStatus.current[item.machine_id] !== item.status) {
          if (item.status === 'CRITICAL') {
            console.info(`CRITICAL prediction: ${item.name} risk ${item.failure_risk.toFixed(0)}%`)
          }
        }
        previousStatus.current[item.machine_id] = item.status
      }
      if (Object.keys(next).length > 0) {
        setTelemetry(next)
        setBackendConnected(true)
        setError('')
      }
    } catch (e) {
      setBackendConnected(false)
      setError('Backend connection unavailable')
      console.error('Telemetry polling:', e)
    }
  }

  const fetchHistory = async (machineId: number) => {
    setIsHistoryLoading(true)
    try {
      const raw = await fetchJson(`/machines/${machineId}/history?hours=4`)
      setHistory(normalizeHistory(raw))
    } catch (e) {
      console.error('History:', e)
      setHistory([])
    } finally {
      setIsHistoryLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const list = await fetchMachines()
        if (!cancelled) await fetchMachineTelemetry(list)
        await fetchAlerts()
        await fetchMaintenance()
      } catch (e) {
        if (!cancelled) {
          setBackendConnected(false)
          setError('Backend connection unavailable')
        }
      }
    }
    load()

    const poll = window.setInterval(async () => {
      try {
        const list = await fetchMachines()
        await fetchMachineTelemetry(list)
        await fetchAlerts()
      } catch (e) {
        if (!cancelled) setBackendConnected(false)
      }
    }, 2000)

    const maintenancePoll = window.setInterval(fetchMaintenance, 5000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearInterval(maintenancePoll)
    }
  }, [])

  useEffect(() => {
    if (selectedMachineId !== null) {
      fetchHistory(selectedMachineId)
      const interval = window.setInterval(() => fetchHistory(selectedMachineId), 5000)
      return () => window.clearInterval(interval)
    }
    setHistory([])
  }, [selectedMachineId])

  const handleStartSimulation = async (scenario: string) => {
    if (selectedMachineId === null) return
    try {
      const res = await fetch(`${API_BASE}/machines/${selectedMachineId}/simulate/start?scenario=${encodeURIComponent(scenario)}&speed=${simSpeed}`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      setSimScenario(scenario)
      setSimRunning(true)
    } catch (e) {
      console.error('Start simulation:', e)
      setError('Unable to start simulation')
    }
  }

  const handlePauseSimulation = async () => {
    if (selectedMachineId === null) return
    try {
      const res = await fetch(`${API_BASE}/machines/${selectedMachineId}/simulate/pause`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      setSimRunning(false)
    } catch (e) { console.error('Pause:', e); setError('Unable to pause simulation') }
  }

  const handleResetSimulation = async () => {
    if (selectedMachineId === null) return
    try {
      const res = await fetch(`${API_BASE}/machines/${selectedMachineId}/simulate/reset`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      setSimScenario('NORMAL')
      setSimRunning(false)
    } catch (e) { console.error('Reset:', e); setError('Unable to reset simulation') }
  }

  const acknowledgeAlert = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchAlerts()
    } catch (e) { console.error('Acknowledge:', e); setError('Unable to acknowledge alert') }
  }

  const getStatusColor = (status: string) => status === 'CRITICAL' ? 'text-red-400' : status === 'WARNING' ? 'text-yellow-400' : 'text-green-400'
  const getStatusBgColor = (status: string) => status === 'CRITICAL' ? 'bg-red-500/10 border-red-500/40' : status === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-green-500/10 border-green-500/40'

  const selectedMachine = machines.find(m => m.id === selectedMachineId)
  const selectedTelemetry = selectedMachineId !== null ? telemetry[selectedMachineId] : null
  const activeAlerts = alerts.filter(a => !a.acknowledged)
  const dashboardStats = useMemo(() => {
    const values = Object.values(telemetry)
    return {
      total: machines.length,
      normal: values.filter(t => t.status === 'NORMAL').length,
      warning: values.filter(t => t.status === 'WARNING').length,
      critical: values.filter(t => t.status === 'CRITICAL').length,
      alerts: activeAlerts.length,
      avgRisk: values.length ? values.reduce((s, t) => s + t.failure_risk, 0) / values.length : 0,
    }
  }, [machines.length, telemetry, activeAlerts.length])

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-300 overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} border-r border-slate-800 bg-slate-900 flex flex-col transition-all duration-300 z-40`}>
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4">
          {sidebarOpen && <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-500" /><span className="font-bold text-sm">PredMaint</span></div>}
          <button onClick={() => setSidebarOpen(v => !v)} className="p-1 hover:bg-slate-800 rounded">{sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          {([
            ['dashboard', Cpu, 'Dashboard'],
            ['alerts', AlertTriangle, 'Alerts'],
            ['maintenance', Wrench, 'Maintenance'],
          ] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-3 px-4 py-2 rounded transition-colors relative ${activeTab === tab ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'hover:bg-slate-800'}`}>
              <Icon className="h-5 w-5" />
              {sidebarOpen && <span className="text-sm">{label}</span>}
              {tab === 'alerts' && activeAlerts.length > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-2 text-xs ${backendConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`h-2 w-2 rounded-full ${backendConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {sidebarOpen && <span>{backendConnected ? 'Backend Connected' : 'Backend Offline'}</span>}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-8">
          <div><h1 className="text-xl font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-cyan-500" />Predictive Maintenance System</h1><p className="text-xs text-slate-500 mt-1">Manufacturing Laboratory • CNC Machines & 3D Printers</p></div>
          <div className="flex items-center gap-5 text-xs"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-500" />{new Date().toLocaleTimeString()}</span><span className="px-3 py-1 rounded bg-slate-800">Active Alerts: <b className="text-red-400">{activeAlerts.length}</b></span></div>
        </header>

        {error && <div className="mx-6 mt-4 border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 rounded-lg px-4 py-2 text-sm flex justify-between"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  ['Total Machines', dashboardStats.total, 'text-cyan-400'],
                  ['Normal', dashboardStats.normal, 'text-green-400'],
                  ['Warning', dashboardStats.warning, 'text-yellow-400'],
                  ['Critical', dashboardStats.critical, 'text-red-400'],
                  ['Avg Risk', `${dashboardStats.avgRisk.toFixed(1)}%`, 'text-purple-400'],
                ].map(([label, value, color]) => <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-xl p-4"><div className="text-xs text-slate-500">{label}</div><div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div></div>)}
              </div>

              <section>
                <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Machine Status</h2><span className="text-xs text-slate-500">Predictions refreshed every 2 seconds</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {machines.map(machine => {
                    const t = telemetry[machine.id]
                    const status = t?.status ?? machine.operational_status ?? 'NORMAL'
                    const risk = t?.failure_risk ?? 0
                    return <button key={machine.id} onClick={() => setSelectedMachineId(machine.id)} className={`text-left border rounded-xl p-5 transition-all hover:-translate-y-0.5 ${getStatusBgColor(status)} ${selectedMachineId === machine.id ? 'ring-2 ring-cyan-500' : ''}`}>
                      <div className="flex justify-between items-start"><div><div className="font-bold text-white">{machine.name}</div><div className="text-xs text-slate-500 mt-1">{machine.serial_number} • {machine.machine_type}</div></div><span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusBgColor(status)} ${getStatusColor(status)}`}>{status}</span></div>
                      <div className="mt-5 flex items-end justify-between"><div><div className="text-xs text-slate-500">Failure Risk</div><div className={`text-3xl font-black ${getStatusColor(status)}`}>{risk.toFixed(0)}%</div></div><Gauge className={`h-8 w-8 ${getStatusColor(status)}`} /></div>
                      <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${status === 'CRITICAL' ? 'bg-red-500' : status === 'WARNING' ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${risk}%` }} /></div>
                    </button>
                  })}
                </div>
              </section>

              {selectedMachine && selectedTelemetry && (
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6"><div><h2 className="text-xl font-bold">{selectedMachine.name}</h2><p className="text-xs text-slate-500">{selectedMachine.serial_number} • {selectedMachine.model} • {selectedMachine.location}</p></div><div className={`px-4 py-2 rounded-lg border ${getStatusBgColor(selectedTelemetry.status)}`}><span className="text-xs text-slate-500">Predicted Condition</span><div className={`font-black ${getStatusColor(selectedTelemetry.status)}`}>{selectedTelemetry.status} • {selectedTelemetry.failure_risk.toFixed(1)}% risk</div></div></div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {([
                      { label: 'Temperature', value: selectedTelemetry.temperature, unit: '°C', Icon: Thermometer },
                      { label: 'Vibration', value: selectedTelemetry.vibration, unit: 'mm/s', Icon: Wind },
                      { label: 'Motor Current', value: selectedTelemetry.motor_current, unit: 'A', Icon: Zap },
                      { label: 'RPM', value: selectedTelemetry.rpm, unit: 'RPM', Icon: Activity },
                      { label: 'Workload', value: selectedTelemetry.workload, unit: '%', Icon: Gauge },
                      { label: 'Operating Hours', value: selectedTelemetry.operating_hours, unit: 'h', Icon: Clock },
                    ] as Array<{ label: string; value: number; unit: string; Icon: ComponentType<{ className?: string }> }>).map(({ label, value, unit, Icon }) => (
                      <div key={label} className="bg-slate-800 rounded-lg p-4">
                        <Icon className="h-4 w-4 text-cyan-500 mb-3" />
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="text-lg font-bold text-white mt-1">{Number(value).toFixed(2)} <span className="text-xs text-slate-500">{unit}</span></div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-slate-800 rounded-lg p-4"><h3 className="font-bold text-sm mb-4">Temperature Trend</h3><div className="h-64">{isHistoryLoading ? <div className="h-full grid place-items-center text-slate-500 text-sm">Loading telemetry…</div> : history.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} /><Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="h-full grid place-items-center text-slate-500 text-sm">No historical readings yet</div>}</div></div>
                    <div className="bg-slate-800 rounded-lg p-4"><h3 className="font-bold text-sm mb-4">Vibration Trend</h3><div className="h-64">{history.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="time" hide /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} /><Line type="monotone" dataKey="vibration" stroke="#22d3ee" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="h-full grid place-items-center text-slate-500 text-sm">No vibration history yet</div>}</div></div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-slate-800 rounded-lg p-4"><h3 className="font-bold text-sm mb-4">Model Feature Importance</h3>{Object.keys(selectedTelemetry.feature_importance).length ? <ResponsiveContainer width="100%" height={260}><BarChart data={Object.entries(selectedTelemetry.feature_importance).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({ name, value: Number(value) * 100 }))} layout="vertical" margin={{ left: 25, right: 20 }}><XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={10} /><YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" fontSize={10} /><Tooltip formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'Importance']} /><Bar dataKey="value" radius={[0,4,4,0]}>{Object.keys(selectedTelemetry.feature_importance).slice(0,8).map((_,i) => <Cell key={i} fill={i < 3 ? '#06b6d4' : '#475569'} />)}</Bar></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">Feature importance is not available in this prediction response.</p>}</div>
                    <div className="bg-slate-800 rounded-lg p-4"><h3 className="font-bold text-sm mb-4">Simulation Controls</h3><div className="flex flex-wrap gap-3"><button onClick={() => handleStartSimulation('NORMAL')} className="px-4 py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-2"><Activity className="h-4 w-4" />Normal</button><button onClick={() => handleStartSimulation('GRADUAL_DEGRADATION')} className="px-4 py-2 rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-2"><AlertCircle className="h-4 w-4" />Degrade</button><button onClick={() => handleStartSimulation('NEAR_FAILURE')} className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Near Failure</button><button onClick={simRunning ? handlePauseSimulation : () => handleStartSimulation(simScenario)} className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-2">{simRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{simRunning ? 'Pause' : 'Play'}</button><button onClick={handleResetSimulation} className="px-4 py-2 rounded-lg bg-slate-700 flex items-center gap-2"><RotateCcw className="h-4 w-4" />Reset</button><select value={simSpeed} onChange={e => setSimSpeed(Number(e.target.value))} className="bg-slate-700 rounded-lg px-3 py-2 text-sm"><option value={1}>1x</option><option value={5}>5x</option><option value={10}>10x</option></select></div><p className="text-xs text-slate-500 mt-4">Demo path: NORMAL → GRADUAL DEGRADATION → NEAR FAILURE. Risk and status come from the backend ML prediction.</p></div>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'alerts' && <div className="p-6"><h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-red-500" />Alerts</h2>{activeAlerts.length === 0 ? <div className="text-center py-16"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" /><p className="text-slate-400">No active alerts.</p></div> : <div className="space-y-4">{activeAlerts.map(alert => <div key={alert.id} className="border-l-4 border-red-500 bg-red-500/10 rounded-lg p-4"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><p className="font-bold text-red-400">{alert.machine_name}</p><p className="text-sm mt-1">{alert.message}</p><div className="flex gap-4 mt-2 text-xs text-slate-400"><span>{new Date(alert.time).toLocaleTimeString()}</span><span>Risk: {Number(alert.current_risk).toFixed(0)}%</span></div></div><button onClick={() => acknowledgeAlert(alert.id)} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold">Acknowledge</button></div></div>)}</div>}</div>}

          {activeTab === 'maintenance' && <div className="p-6"><h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Wrench className="h-6 w-6 text-green-500" />Maintenance History</h2>{maintenance.length === 0 ? <div className="text-center py-16 text-slate-400">No maintenance records found.</div> : <div className="space-y-4">{maintenance.map(record => <div key={record.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800"><div className="flex items-start justify-between mb-2"><div><p className="font-bold text-white">{record.machine_name}</p><p className="text-xs text-slate-400">Machine ID: {record.machine_id}</p></div><span className="text-xs text-slate-400">{new Date(record.date).toLocaleString()}</span></div><div className="space-y-2 text-sm"><p><strong>Issue:</strong> {record.issue}</p><p><strong>Action:</strong> {record.action}</p><p><strong>Technician:</strong> {record.technician}</p>{record.notes && <p className="text-slate-400"><strong>Notes:</strong> {record.notes}</p>}</div></div>)}</div>}</div>}
        </div>
      </main>
    </div>
  )
}

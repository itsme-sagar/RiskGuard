import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function SensorChart({ machines }) {
  const chartData = machines.map((machine, index) => ({
    name: `M-${index + 1}`,
    risk: machine.risk_score,
  }));

  return (
    <div
      style={{
        background: "var(--rg-card)",
        color: "var(--rg-text)",
        border: "1px solid var(--rg-border)",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "var(--rg-shadow)",
        marginTop: "20px",
      }}
    >
      <h2 style={{ color: "var(--rg-text)", marginTop: 0 }}>Failure Risk by Machine</h2>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rg-border)" />
            <XAxis dataKey="name" stroke="var(--rg-text-secondary)" />
            <YAxis stroke="var(--rg-text-secondary)" />
            <Tooltip />
            <Bar dataKey="risk" fill="var(--rg-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default SensorChart;
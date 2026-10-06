function MachineTable({ machines }) {
  const getStatusColor = (status) => {
    if (status === "CRITICAL" || status === "FAILED") return "var(--rg-danger)";
    if (status === "WARNING") return "var(--rg-warning)";
    return "var(--rg-success)";
  };

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
      <h2 style={{ color: "var(--rg-text)", marginTop: 0 }}>Machine Predictions</h2>
      <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--rg-card-sub)", borderBottom: "1px solid var(--rg-border)" }}>
            <th align="left" style={{ color: "var(--rg-label)" }}>Machine</th>
            <th align="left" style={{ color: "var(--rg-label)" }}>Type</th>
            <th align="left" style={{ color: "var(--rg-label)" }}>Risk Score</th>
            <th align="left" style={{ color: "var(--rg-label)" }}>Status</th>
            <th align="left" style={{ color: "var(--rg-label)" }}>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {machines.map((machine, index) => {
            const status = String(machine.status || machine.current_values?.status || "NORMAL").toUpperCase();
            return (
              <tr key={index} style={{ borderBottom: "1px solid var(--rg-border)", color: "var(--rg-text)" }}>
                <td><strong style={{ color: "var(--rg-primary)" }}>{machine.machine_id || `Machine-${index + 1}`}</strong></td>
                <td style={{ color: "var(--rg-text-secondary)" }}>{machine.machine_type || "CNC"}</td>
                <td><strong>{machine.current_values?.failure_risk ?? machine.failure_risk ?? 0}%</strong></td>
                <td style={{ color: getStatusColor(status), fontWeight: "bold" }}>{status}</td>
                <td style={{ color: "var(--rg-text-secondary)" }}>{machine.current_values?.recommendation ?? machine.recommendation ?? "Maintain monitoring."}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MachineTable;
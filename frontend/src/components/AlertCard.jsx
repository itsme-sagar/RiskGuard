import StatusBadge from "./StatusBadge";

function AlertCard({ machine, index }) {
  const healthStatus = machine.health_status || machine.status || "NORMAL";

  return (
    <article className={`risk-alert-card is-${String(healthStatus).toLowerCase()}`}>
      <div className="risk-alert-top">
        <div><strong>{machine.machine_id || `Machine-${index + 1}`}</strong><span>{machine.machine_type || "Machine"}</span></div>
        <StatusBadge status={healthStatus} />
      </div>
      <div className="risk-alert-risk"><span>Failure Risk</span><strong>{machine.risk_score ?? machine.failure_risk ?? 0}%</strong></div>
      <p>{machine.recommendation || "Inspect the machine at the next maintenance interval."}</p>
    </article>
  );
}

export default AlertCard;
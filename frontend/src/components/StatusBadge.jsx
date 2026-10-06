function StatusBadge({ status = "NORMAL", className = "" }) {
  const normalized = String(status || "NORMAL").toUpperCase();
  return <span className={`status-badge status-${normalized.toLowerCase()} ${className}`.trim()}>{normalized}</span>;
}

export default StatusBadge;

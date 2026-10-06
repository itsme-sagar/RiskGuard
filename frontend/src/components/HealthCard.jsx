import { createElement } from "react";

function HealthCard({ title, value, detail, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-card-copy">
        <h3>{title}</h3>
        <p>{value}</p>
      </div>
      {icon && <span className="stat-card-icon">{createElement(icon, { size: 18, "aria-hidden": true })}</span>}
      {detail && <span className="stat-card-detail">{detail}</span>}
    </article>
  );
}

export default HealthCard;
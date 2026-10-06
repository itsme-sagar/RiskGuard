import riskguardLogo from "../assets/riskguard-logo.png";

function BrandLogo({ className = "", size = "default" }) {
  return (
    <div
      className={`riskguard-logo ${size === "small" ? "riskguard-logo-small" : ""} ${className}`}
      title="RiskGuard"
    >
      <img
        src={riskguardLogo}
        alt="RiskGuard Logo"
        className="riskguard-official-logo"
      />
    </div>
  );
}

export default BrandLogo;
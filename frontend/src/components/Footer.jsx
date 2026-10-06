import riskguardLogo from "../assets/riskguard-logo.png";
import "./Footer.css";

function Footer() {
  return (
    <footer className="rg-global-footer">
      <div className="rg-footer-container">
        {/* Left Column: Brand, Tagline, and Platform Description */}
        <div className="rg-footer-brand-col">
          <div className="rg-footer-brand-row">
            <div className="rg-footer-logo-badge">
              <img
                src={riskguardLogo}
                alt="RiskGuard Official Logo"
                className="rg-footer-logo-img"
              />
            </div>
            <div className="rg-footer-title-group">
              <strong className="rg-footer-brand-name">RiskGuard</strong>
              <span className="rg-footer-tagline">Catching the breakdown before it happens.</span>
            </div>
          </div>
          <p className="rg-footer-description">
            Predictive Maintenance Platform for CNC Machines & 3D Printers
          </p>
        </div>

        {/* Right Column: Author Credit, Version Badge, and Copyright */}
        <div className="rg-footer-meta-col">
          <div className="rg-footer-credits">
            Designed & Developed by <strong>Sagar Dhakal & Co.</strong>
          </div>
          <div className="rg-footer-sub-row">
            <span className="rg-footer-version-badge">RiskGuard v1.0</span>
            <span className="rg-footer-divider">•</span>
            <span className="rg-footer-copyright">© 2026 RiskGuard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

import { createElement, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import BrandLogo from "./BrandLogo";
import Footer from "./Footer";
import { useAlerts } from "../context/AlertContext";
import "./Layout.css";

const navigation = [
  { label: "Home", path: "/home", icon: Home },
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Machines", path: "/machines", icon: Cpu },
  { label: "Upload Data", path: "/upload", icon: Upload },
  { label: "Maintenance Records", path: "/maintenance", icon: Wrench },
  { label: "Alerts", path: "/alerts", icon: Bell },
];

function Layout({ children }) {
  const location = useLocation();
  const { activeCount } = useAlerts();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentAsset, setCurrentAsset] = useState("CNC Milling Machine");

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("rg-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("rg-theme", theme);
  }, [theme]);

  // Listen to asset change events from Home page
  useEffect(() => {
    const handleAssetChange = (e) => {
      if (e.detail) setCurrentAsset(e.detail);
    };
    window.addEventListener("rg-asset-change", handleAssetChange);
    return () => window.removeEventListener("rg-asset-change", handleAssetChange);
  }, []);

  const pageTitle = navigation.find((item) => item.path === location.pathname)?.label || "Home";

  return (
    <div className={`app-shell${isCollapsed ? " is-collapsed" : ""}`}>
      {isMobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside className={`app-sidebar${isMobileOpen ? " is-mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandLogo />
          <span className="sidebar-brand-copy">
            <strong>RiskGuard</strong>
            <span>Catching the breakdown before it happens.</span>
          </span>
          <button
            className="sidebar-mobile-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={label}
              to={path}
              className={({ isActive }) =>
                `sidebar-link${isActive && location.pathname === path ? " is-active" : ""}`
              }
              title={label}
              onClick={() => setIsMobileOpen(false)}
            >
              {createElement(Icon, { size: 18, strokeWidth: 1.9, "aria-hidden": true })}
              <span className="sidebar-link-label">{label}</span>
              {label === "Alerts" && activeCount > 0 && (
                <span className="sidebar-alert-badge">{activeCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-online-indicator" />
          <span className="sidebar-online-label">Operational</span>
        </div>

        <button
          className="sidebar-collapse"
          type="button"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        >
          {isCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span className="sidebar-link-label">{isCollapsed ? "Expand" : "Collapse"}</span>
        </button>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="topbar-breadcrumb">
              <span>RiskGuard</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{pageTitle}</strong>
              {location.pathname === "/home" && (
                <>
                  <span className="breadcrumb-divider">/</span>
                  <span className="topbar-asset-tag">Current Asset: <strong>{currentAsset}</strong></span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* Theme Toggle Controls */}
            <div className="theme-toggle-group">
              <button
                type="button"
                className={`theme-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => setTheme("dark")}
                title="Switch to Dark Industrial Mode"
              >
                <Moon size={13} />
                <span>DARK</span>
              </button>
              <button
                type="button"
                className={`theme-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => setTheme("light")}
                title="Switch to Light Engineering Mode"
              >
                <Sun size={13} />
                <span>LIGHT</span>
              </button>
            </div>

            <div className="topbar-status">
              <span className="topbar-live-dot" />
              SYSTEM LIVE
            </div>
          </div>
        </header>

        <main className="app-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export default Layout;
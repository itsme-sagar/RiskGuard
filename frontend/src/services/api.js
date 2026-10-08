import axios from "axios";

// Backend URLs
const localBackendUrl = "http://127.0.0.1:8000";
const productionBackendUrl = "https://riskguard-v2rf.onrender.com";

// Use VITE_API_URL when configured.
// Otherwise:
// - Vercel production → Render backend
// - Local development → local FastAPI backend
const envUrl = import.meta.env.VITE_API_URL;

const isProduction =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("vercel.app");

const resolvedBaseUrl =
  envUrl ||
  (isProduction ? productionBackendUrl : localBackendUrl);

const API = axios.create({
  baseURL: resolvedBaseUrl,
});

// Interceptor to ensure endpoints route with /api prefix if not already included
API.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith("http")) {
    let url = config.url;

    const baseHasApi = (config.baseURL || "")
      .replace(/\/+$/, "")
      .endsWith("/api");

    if (!baseHasApi && !url.startsWith("/api/") && url !== "/api") {
      url = `/api${url.startsWith("/") ? "" : "/"}${url}`;
    } else if (baseHasApi && url.startsWith("/api/")) {
      url = url.replace(/^\/api/, "");
    }

    config.url = url;
  }

  return config;
});

export default API;
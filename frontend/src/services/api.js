import axios from "axios";

// Default backend port is 8000 (matching start_servers.bat and backend/main.py)
const defaultBaseUrl = "http://127.0.0.1:8000";
const envUrl = import.meta.env.VITE_API_URL;
const resolvedBaseUrl = envUrl ? envUrl.replace(":8002", ":8000") : defaultBaseUrl;

const API = axios.create({
  baseURL: resolvedBaseUrl,
});

// Interceptor to ensure endpoints route with /api prefix if not already included
API.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith("http")) {
    let url = config.url;
    const baseHasApi = (config.baseURL || "").replace(/\/+$/, "").endsWith("/api");
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
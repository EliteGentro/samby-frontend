const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8001/api/prototype'

/** Base URL for every request from the frontend to the backend API. */
export const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_ANALYSIS_URL ||
  DEFAULT_BACKEND_URL
).replace(/\/$/, '')

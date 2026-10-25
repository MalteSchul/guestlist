import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the backend runs on :8000 (compose or `uv run`). In production nginx forwards
// /api; /docs and /openapi.json are only proxied here, for the API docs during development.
const backend = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": backend, "/docs": backend, "/openapi.json": backend },
  },
});

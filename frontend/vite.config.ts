/// <reference types="node" />
import { execSync } from "node:child_process";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the backend runs on :8000 (compose or `uv run`). In production nginx forwards
// /api; /docs and /openapi.json are only proxied here, for the API docs during development.
const backend = "http://localhost:8000";

/** The commit this is built from, for the settings page: GIT_SHA from the image build (the
 * Docker context has no .git), else the checkout's. */
function gitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_SHA__: JSON.stringify(gitSha()),
    __BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: { "/api": backend, "/docs": backend, "/openapi.json": backend },
  },
});

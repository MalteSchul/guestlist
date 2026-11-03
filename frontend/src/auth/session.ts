import type { components } from "../api/schema";

type AuthMode = components["schemas"]["AuthConfig"]["mode"];

let mode: Promise<AuthMode> | undefined;

/** Whether hosts log in at all, asked from the backend once per page load (the same image runs
 * everywhere): "dev" is the local bypass, every request is the dev user (A13). Plain `fetch`, as
 * the API client reports to this module. */
export function authMode(): Promise<AuthMode> {
  mode ??= fetch("/api/auth/config")
    .then((response) => {
      if (!response.ok) throw new Error(`auth config: ${response.status}`);
      return response.json() as Promise<{ mode: AuthMode }>;
    })
    .then((config) => config.mode);
  // A failed load is tried again next time instead of failing every later call.
  mode.catch(() => (mode = undefined));
  return mode;
}

const listeners = new Set<() => void>();

/** Called when the host API answers "not logged in" (A28); returns the unsubscribe. */
export function onLoginNeeded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loginNeeded(): void {
  listeners.forEach((listener) => listener());
}

/** Google's login page via the backend, then back to this page; without the mark of a login
 * that failed, when this is the retry. */
export function loginUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("login");
  return `/api/auth/google?${new URLSearchParams({ to: url.pathname + url.search })}`;
}

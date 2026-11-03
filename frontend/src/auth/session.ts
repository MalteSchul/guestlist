import { UserManager, WebStorageStateStore } from "oidc-client-ts";

import type { components } from "../api/schema";

type AuthConfig = components["schemas"]["AuthConfig"];

/** Where to go once the login service sends the host back: the page they wanted. */
export type ReturnTo = { path: string };

let session: Promise<UserManager | null> | undefined;

/** How hosts log in, asked from the backend once per page load (the same image runs everywhere).
 * `null` means no login: the local dev bypass, every request is the dev user (A13). Plain
 * `fetch`, not the API client: the client asks this for its tokens. */
export function loginSession(): Promise<UserManager | null> {
  session ??= fetch("/api/auth/config")
    .then((response) => {
      if (!response.ok) throw new Error(`auth config: ${response.status}`);
      return response.json() as Promise<AuthConfig>;
    })
    .then((config) => (config.mode === "oidc" ? userManager(config) : null));
  // A failed load is tried again next time instead of failing every later call.
  session.catch(() => (session = undefined));
  return session;
}

function userManager(config: AuthConfig): UserManager {
  const home = `${window.location.origin}/`; // the one redirect URI the login service knows
  return new UserManager({
    authority: config.authority!,
    client_id: config.client_id!,
    redirect_uri: home,
    post_logout_redirect_uri: home,
    // offline_access: a refresh token, so the login is renewed without the page leaving.
    scope: `openid profile email offline_access ${config.scope}`,
    // In localStorage rather than per tab, so a host stays logged in in every tab.
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });
}

/** The access token for the host API, renewed first if it ran out; none without a login. */
export async function accessToken(): Promise<string | undefined> {
  const manager = await loginSession();
  if (!manager) return undefined;
  let user = await manager.getUser();
  if (user?.expired) user = await manager.signinSilent().catch(() => null);
  return user?.access_token;
}

/** What the login service adds to the address when it sends the host back. */
const LOGIN_PARAMS = ["code", "state", "session_state", "error", "error_description", "error_uri"];

/** Off to the login service, and back to this page afterwards; without the parameters of a
 * login that failed, when this is the retry. */
export async function signIn(manager: UserManager): Promise<void> {
  const url = new URL(window.location.href);
  LOGIN_PARAMS.forEach((param) => url.searchParams.delete(param));
  const returnTo: ReturnTo = { path: url.pathname + url.search };
  await manager.signinRedirect({ state: returnTo });
}

/** The logged-in host's login service account, if any: for the settings page. */
export async function signedIn(): Promise<UserManager | null> {
  const manager = await loginSession();
  return manager && (await manager.getUser()) ? manager : null;
}

/** The API refused the token (expired for good, or revoked): log in again. */
export async function loginExpired(): Promise<void> {
  const manager = await loginSession();
  if (!manager) return;
  await manager.removeUser();
  await signIn(manager);
}

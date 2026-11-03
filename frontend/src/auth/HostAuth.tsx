import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, unwrap } from "../api/client";
import { Layout } from "../components/Layout";
import { useLoad } from "../components/useLoad";
import { loginUrl, onLoginNeeded } from "./session";

/** Host pages need a login (A28); guest pages never come here. Without one, or when it ran out,
 * the host sees the login page, and Google brings them back to the page they opened. With the
 * dev bypass everyone is logged in. */
export function HostAuth({ page }: { page: () => ReactNode }) {
  const { t } = useTranslation();
  const [loggedOut, setLoggedOut] = useState(false);
  // Before the check below starts, so its "not logged in" isn't missed.
  useEffect(() => onLoginNeeded(() => setLoggedOut(true)), []);
  const me = useLoad(() => unwrap(api.GET("/api/admin/me")), []);

  if (loggedOut) return <Login />;
  if (me.error) return <Waiting text={t("common.error")} error />;
  if (!me.data) return <Waiting text={t("common.loading")} />;
  return <>{page()}</>;
}

function Login() {
  const { t } = useTranslation();
  const failed = new URLSearchParams(window.location.search).get("login") === "failed";

  return (
    <Layout>
      <h1>{t("auth.title")}</h1>
      {failed && <p className="error">{t("auth.failed")}</p>}
      <div className="actions">
        <a className="button google-login" href={loginUrl()}>
          <GoogleLogo />
          {t("auth.google")}
        </a>
      </div>
    </Layout>
  );
}

/** Google's "G", as their sign-in button guidelines ask for. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Waiting({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <Layout>
      <p className={error ? "error" : "muted"}>{text}</p>
    </Layout>
  );
}

import type { User, UserManager } from "oidc-client-ts";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "react-oidc-context";

import { Layout } from "../components/Layout";
import { useLoad } from "../components/useLoad";
import { loginSession, type ReturnTo, signIn } from "./session";

/** Host pages need a login (A7); guest pages never come here. Without one the host goes straight
 * to the login service and comes back to the page they opened. `page` is read only after that,
 * because the address it routes by is then the page they wanted. With the dev bypass there's
 * no login at all. */
export function HostAuth({ page }: { page: () => ReactNode }) {
  const { t } = useTranslation();
  const session = useLoad(loginSession, []);

  if (session.error) return <Waiting text={t("common.error")} error />;
  if (session.data === undefined) return <Waiting text={t("common.loading")} />;
  if (session.data === null) return <>{page()}</>;
  return (
    <AuthProvider userManager={session.data} onSigninCallback={backToPage}>
      <RequireLogin manager={session.data} page={page} />
    </AuthProvider>
  );
}

/** Back from the login service: the address loses the login's parameters and becomes the page
 * the host had opened. */
function backToPage(user: User | undefined) {
  const to = (user?.state as ReturnTo | undefined)?.path ?? "/";
  window.history.replaceState({}, document.title, to);
}

function RequireLogin({ manager, page }: { manager: UserManager; page: () => ReactNode }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const started = useRef(false);
  const loggedOut = !auth.isLoading && !auth.isAuthenticated && !auth.error;

  // Once per page: if the login service sends them back without a login, they choose to retry.
  useEffect(() => {
    if (!loggedOut || started.current) return;
    started.current = true;
    void signIn(manager);
  }, [loggedOut, manager]);

  if (auth.isAuthenticated) return <>{page()}</>;
  if (auth.error) {
    return (
      <Layout>
        <p className="error">{t("auth.failed")}</p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => void signIn(manager)}>
            {t("auth.retry")}
          </button>
        </div>
      </Layout>
    );
  }
  return <Waiting text={t("auth.signingIn")} />;
}

function Waiting({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <Layout>
      <p className={error ? "error" : "muted"}>{text}</p>
    </Layout>
  );
}

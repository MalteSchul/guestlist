import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../api/client";
import { chooseLanguage, LANGUAGES } from "../i18n";

/** `admin` adds the host navigation. `switcher={false}` hides DE/EN, for pages that can only be
 * shown in one language (A21). */
export function Layout({
  children,
  admin = false,
  switcher = true,
}: {
  children: ReactNode;
  admin?: boolean;
  switcher?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const path = window.location.pathname;
  const inContacts = path.startsWith("/admin/contacts");
  return (
    <>
      <header className="topbar">
        <span className="brand">{t("app.name")}</span>
        {admin && (
          <nav className="nav" aria-label={t("app.nav")}>
            <a href="/" aria-current={inContacts ? undefined : "page"}>
              {t("app.events")}
            </a>
            <a href="/admin/contacts" aria-current={inContacts ? "page" : undefined}>
              {t("app.contacts")}
            </a>
          </nav>
        )}
        {switcher && (
          <nav className="languages" aria-label="Language">
            {LANGUAGES.map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={i18n.language === language}
                onClick={() => chooseLanguage(language)}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main>{children}</main>
    </>
  );
}

/** Shows the error if there is one, a loading line until there's data, otherwise the content. */
export function Loaded<T>({
  data,
  error,
  children,
}: {
  data: T | undefined;
  error: Error | undefined;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <p className="error">{notFound ? t("common.notFound") : t("common.error")}</p>;
  }
  if (data === undefined) return <p className="muted">{t("common.loading")}</p>;
  return <>{children(data)}</>;
}

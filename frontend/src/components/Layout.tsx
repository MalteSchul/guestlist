import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../api/client";
import { chooseLanguage, LANGUAGES } from "../i18n";
import { chooseTheme, useTheme } from "../theme";

/** `admin` adds the host navigation. `switcher={false}` hides DE/EN, for pages that can only be
 * shown in one language (A21); the light/dark switch is always there. */
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
  const theme = useTheme();
  const header = useRef<HTMLElement>(null);

  // The header stays at the top and can wrap on a phone: its height, for what has to stay
  // clear of it (--topbar-height in styles.css).
  useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const height = el.getBoundingClientRect().height; // unrounded, so nothing peeks through
      document.documentElement.style.setProperty("--topbar-height", `${height}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className="topbar" ref={header}>
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
        <div className="topbar-controls">
          <div className="switch" role="group" aria-label={t("app.theme")}>
            <button
              type="button"
              aria-pressed={theme === "light"}
              aria-label={t("app.light")}
              title={t("app.light")}
              onClick={() => chooseTheme("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              aria-label={t("app.dark")}
              title={t("app.dark")}
              onClick={() => chooseTheme("dark")}
            >
              <MoonIcon />
            </button>
          </div>
          {switcher && (
            <div className="switch" role="group" aria-label="Language">
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
            </div>
          )}
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
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

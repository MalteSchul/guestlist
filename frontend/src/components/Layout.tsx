import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../api/client";
import { Icon } from "./Icon";

/** `admin` adds the host navigation. Theme and language are on the settings page, behind the
 * gear; the settings page itself leaves the gear out. */
export function Layout({
  children,
  admin = false,
  settings = true,
}: {
  children: ReactNode;
  admin?: boolean;
  settings?: boolean;
}) {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const inContacts = path.startsWith("/admin/contacts");
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
        {settings && (
          <a
            className="icon topbar-settings"
            href="/settings"
            aria-label={t("app.settings")}
            title={t("app.settings")}
          >
            <Icon name="settings" />
          </a>
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

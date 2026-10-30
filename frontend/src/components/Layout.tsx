import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../api/client";
import { Icon } from "./Icon";

/** `admin` is the host's header: the name leads back to the events, with the tabs next to it.
 * Theme and language are on the settings page, behind the gear, which stays there on the
 * settings page and shows it is the current one. */
export function Layout({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const inContacts = path.startsWith("/admin/contacts");
  const inEvents = path === "/" || path.startsWith("/admin/events");
  const inSettings = path === "/settings" || path === "/admin/settings";
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
        {admin ? (
          <a className="brand" href="/">
            {t("app.name")}
          </a>
        ) : (
          <span className="brand">{t("app.name")}</span>
        )}
        {admin && (
          <nav className="nav" aria-label={t("app.nav")}>
            <a href="/" aria-current={inEvents ? "page" : undefined}>
              {t("app.events")}
            </a>
            <a href="/admin/contacts" aria-current={inContacts ? "page" : undefined}>
              {t("app.contacts")}
            </a>
          </nav>
        )}
        <a
          className="icon topbar-settings"
          href={admin ? "/admin/settings" : "/settings"}
          aria-label={t("app.settings")}
          title={t("app.settings")}
          aria-current={inSettings ? "page" : undefined}
        >
          <Icon name="settings" />
        </a>
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

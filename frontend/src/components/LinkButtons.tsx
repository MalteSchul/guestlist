import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "./Icon";

/** Copying a link to the clipboard: "copied" for two seconds, then back to "idle". */
export function useCopyLink(link: string) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  // The clipboard only exists on HTTPS and localhost; elsewhere `navigator.clipboard` is undefined.
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return { link, state, copy };
}

export type CopyLink = ReturnType<typeof useCopyLink>;

/** Open and Copy for a link that is sent to guests. Copying can fail; the caller shows
 * `CopyFailed` where there is room for a line. */
export function LinkButtons({ copy }: { copy: CopyLink }) {
  const { t } = useTranslation();
  const copied = copy.state === "copied";
  return (
    <>
      <a
        className="icon ghost"
        href={copy.link}
        target="_blank"
        rel="noreferrer"
        aria-label={t("common.openLink")}
        title={t("common.openLink")}
      >
        <Icon name="open" />
      </a>
      <button
        type="button"
        className={copied ? "icon ghost done" : "icon ghost"}
        aria-label={t(`common.copy.${copied ? "copied" : "idle"}`)}
        title={t(`common.copy.${copied ? "copied" : "idle"}`)}
        onClick={() => void copy.copy()}
      >
        <Icon name={copied ? "check" : "copy"} />
      </button>
    </>
  );
}

export function CopyFailed({ copy }: { copy: CopyLink }) {
  const { t } = useTranslation();
  return copy.state === "failed" ? <p className="error">{t("common.copy.failed")}</p> : null;
}

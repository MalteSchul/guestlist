import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "./Icon";

/** Host-written text cut to three lines, with a chevron to show all of it. The chevron only
 * appears when something is cut off. */
export function ExpandableText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Measured while clamped; again when the width changes, since that moves the line breaks.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, open]);

  const label = open ? t("common.showLess") : t("common.showAll");
  return (
    <div className="expandable">
      <p ref={ref} className={open ? "prose" : "prose clamp"}>
        {text}
      </p>
      {(cut || open) && (
        <button
          type="button"
          className="icon ghost"
          aria-expanded={open}
          aria-label={label}
          title={label}
          onClick={() => setOpen(!open)}
        >
          <Icon name="expand" />
        </button>
      )}
    </div>
  );
}

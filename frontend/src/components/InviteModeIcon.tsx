import type { Schemas } from "../api/client";

/** How a group is invited (D31): one envelope for one invite for all, several for one each.
 * `label` is for screen readers and the tooltip; leave it out next to the text itself. */
export function InviteModeIcon({
  mode,
  label,
}: {
  mode: Schemas["GroupOut"]["invite_mode"];
  label?: string;
}) {
  return (
    <span className="mode-icon" title={label} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {mode === "together" ? (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </>
        ) : (
          <>
            <rect x="6" y="3" width="16" height="12" rx="2" />
            <path d="m6 5 8 5.5L22 5" />
            <path d="M2 7v11a2 2 0 0 0 2 2h14" />
          </>
        )}
      </svg>
    </span>
  );
}

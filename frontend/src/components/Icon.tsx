const PATHS = {
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  delete: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7.5V19l-4-2v-4.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  personAdd: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  groupAdd: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M2 19v-.5A4.5 4.5 0 0 1 6.5 14h3a4.5 4.5 0 0 1 4.5 4.5v.5" />
      <path d="M14 5.2a3 3 0 0 1 0 5.6" />
      <path d="M19.5 13v6M16.5 16h6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  hide: (
    <>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c5.5 0 9 5.5 9 7 0 .6-.6 1.8-1.7 3.1" />
      <path d="M6.6 6.6C4.2 8.1 3 10.9 3 12c0 1.5 3.5 7 9 7 1.9 0 3.6-.7 5-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </>
  ),
  show: (
    <>
      <path d="M3 12c0-1.5 3.5-7 9-7s9 5.5 9 7-3.5 7-9 7-9-5.5-9-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  duplicate: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      <path d="M14.5 12v5M12 14.5h5" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chart: <path d="M5 20v-7M12 20V5M19 20V10" />,
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  sort: <path d="M8 5v14M4 15l4 4 4-4M16 19V5M12 9l4-4 4 4" />,
  choiceOne: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  choiceMany: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <path d="M5.8 7.6l1.4 1.4 2-2.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <path d="M14.5 7.5H20M14.5 16.5H20" />
    </>
  ),
  freeText: <path d="M5 7h14M5 12h14M5 17h9" />,
  required: <path d="M12 5v14M5.5 8.5l13 7M18.5 8.5l-13 7" />,
  table: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16M10 10v9" />
    </>
  ),
  select: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  // How far an invite is: empty, half, done. The colour is only a second cue.
  progressOpen: <circle cx="12" cy="12" r="8" />,
  progressPartial: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" />
    </>
  ),
  progressDone: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M8 3v3a4 4 0 0 0 1.5 3.1L12 12l2.5-2.9A4 4 0 0 0 16 6V3" />
      <path d="M8 21v-3a4 4 0 0 1 1.5-3.1L12 12l2.5 2.9A4 4 0 0 1 16 18v3" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
      <path d="M12 17h.01" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

/** A line icon for an action or a fact. Decorative: the button or link it sits in, or the text
 * next to it, carries the label. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

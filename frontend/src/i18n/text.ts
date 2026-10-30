export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** From the start to the end, the date only once if both are on the same day. */
export function formatDateRange(start: string, end: string | null | undefined, language: string): string {
  const format = new Intl.DateTimeFormat(language, { dateStyle: "full", timeStyle: "short" });
  return end ? format.formatRange(new Date(start), new Date(end)) : format.format(new Date(start));
}

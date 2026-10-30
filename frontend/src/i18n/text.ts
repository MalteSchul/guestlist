/** Compares names the way the language sorts them: Ä with A, no matter the case, 2 before 10. */
export function nameCollator(language: string): Intl.Collator {
  return new Intl.Collator(language, { sensitivity: "base", numeric: true });
}

/** The people of an invite (or anything with a name) A to Z. */
export function sortedByName<T extends { name: string }>(items: readonly T[], language: string): T[] {
  const collator = nameCollator(language);
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
}

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

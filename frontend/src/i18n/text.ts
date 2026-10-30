export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(iso),
  );
}

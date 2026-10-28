/** Search as people type: case and accents don't matter ("muller" finds "Müller"), and every
 * word must appear somewhere ("anna fuß" finds Anna in the "Fußball" group). */
export function matches(query: string, ...texts: string[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = texts.map(fold).join(" ");
  return words.every((word) => haystack.includes(word));
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

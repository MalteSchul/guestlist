/** Search as people type: case and accents don't matter ("muller" finds "Müller"), and every
 * word must appear somewhere ("anna fuß" finds Anna in the "Fußball" group). An empty search
 * matches everything, so a filtered list shows all of it. */
export function matches(query: string, ...texts: string[]): boolean {
  return !query.trim() || rank(query, texts[0] ?? "", ...texts.slice(1)) !== null;
}

/** A list filtered and ranked by a search: items whose own name matches come first (starting
 * with the text, then every word starting a word, then anywhere), then those that match only
 * through something related to them, a group's members or a contact's groups, in the same order
 * of the best related name. Equal ranks keep the list's order; an empty search keeps all of it. */
export function searchList<T>(
  items: T[],
  query: string,
  name: (item: T) => string,
  related: (item: T) => string[],
): T[] {
  if (!query.trim()) return items;
  const ranked = items.flatMap((item) => {
    const own = rank(query, name(item));
    if (own !== null) return [{ item, score: own }];
    const others = related(item);
    if (rank(query, name(item), ...others) === null) return [];
    // Matches only across the name and the related ones ("lia tennis"): after the single hits.
    const best = Math.min(...others.map((other) => rank(query, other) ?? 3));
    return [{ item, score: 3 + best }];
  });
  return ranked.sort((a, b) => a.score - b.score).map(({ item }) => item);
}

/** How well a name matches, for sorting suggestions; null if it doesn't. Emoji and punctuation
 * count as gaps between words, so "lia" starts a word in "🦄 Lia ❤️ Recker".
 * 0: the name starts with the first word ("lia" → "Lia Müller", "🦄 Lia …")
 * 1: every word starts a word of the name ("lia" → "Julia Lia")
 * 2: the words appear anywhere, also in `more` ("lia" → "Amelia") */
export function rank(query: string, name: string, ...more: string[]): 0 | 1 | 2 | null {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const folded = fold(name);
  const haystack = [folded, ...more.map(fold)].join(" ");
  if (!words.every((word) => haystack.includes(word))) return null;
  const starts = wordStarts(folded);
  if (!words.every((word) => starts.some((start) => start.startsWith(word)))) return 2;
  return starts[0]?.startsWith(words[0]!) ? 0 : 1;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

/** The name from the start of each word on: "🦄 lia recker" → ["lia recker", "recker"]. */
function wordStarts(text: string): string[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => text.slice(match.index));
}

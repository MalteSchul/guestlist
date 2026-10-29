/** Reads an address book export in the browser: Google Contacts ("Google CSV" or vCard), or this
 * app's own CSV or JSON. Only names, birth years and labels are kept (from JSON also the groups'
 * settings and members); nothing else in the file is ever sent (D32). */

import { JSON_FORMAT } from "./exportFile";

export type ImportedContact = { name: string; birth_year: number | null; groups: string[] };
/** A group as this app's JSON wrote it down: its setting, and its members' names in order. */
export type ImportedGroup = {
  name: string;
  invite_mode: "together" | "separately";
  members: string[];
};

const MAX_NAME = 200; // ShortText in the backend
const MAX_GROUPS = 20;
const MAX_DECLARED_GROUPS = 200;
const MAX_MEMBERS = 2000;

/** `withoutName`: entries skipped because nothing in them is a name, e.g. only a phone number,
 * which must not end up in the address book as one. `groups` are only in this app's JSON. */
export function parseContacts(text: string): {
  contacts: ImportedContact[];
  withoutName: number;
  groups: ImportedGroup[];
} {
  const clean = text.replace(/^\uFEFF/, "");
  const { contacts: all, groups } = /^\s*[{[]/.test(clean)
    ? parseJson(clean)
    : {
        contacts: /^\s*BEGIN:VCARD/im.test(clean) ? parseVCards(clean) : parseCsv(clean),
        groups: [],
      };
  const contacts = all.filter((contact) => /\p{L}/u.test(contact.name));
  return { contacts, withoutName: all.length - contacts.length, groups };
}

/** What the backend gets for the picked contacts. A file with groups of its own says who is in
 * each, in order, so its contacts carry no labels; a group stays if someone in it is picked, or
 * it never had members. */
export function importBody(
  contacts: ImportedContact[],
  groups: ImportedGroup[],
  picked: Set<number>,
): { contacts: ImportedContact[]; groups: ImportedGroup[] } {
  const chosen = contacts.filter((_, i) => picked.has(i));
  if (groups.length === 0) return { contacts: chosen, groups: [] };
  const names = new Set(chosen.map((contact) => contact.name.toLocaleLowerCase()));
  return {
    contacts: chosen.map((contact) => ({ ...contact, groups: [] })),
    groups: groups.flatMap((group) => {
      const members = group.members.filter((name) => names.has(name.toLocaleLowerCase()));
      return members.length > 0 || group.members.length === 0 ? [{ ...group, members }] : [];
    }),
  };
}

// This app's JSON (exportFile.ts)

function parseJson(text: string): { contacts: ImportedContact[]; groups: ImportedGroup[] } {
  const nothing = { contacts: [], groups: [] };
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return nothing;
  }
  if (!isRecord(file) || file.format !== JSON_FORMAT) return nothing;

  const seen = new Set<string>();
  const groups = list(file.groups).flatMap((entry): ImportedGroup[] => {
    if (!isRecord(entry) || typeof entry.name !== "string") return [];
    const name = tidy(entry.name);
    if (!name || seen.has(name.toLocaleLowerCase())) return [];
    seen.add(name.toLocaleLowerCase());
    return [
      {
        name,
        invite_mode: entry.invite_mode === "together" ? "together" : "separately",
        members: list(entry.members)
          .flatMap((member) => (typeof member === "string" ? [tidy(member)] : []))
          .filter(Boolean)
          .slice(0, MAX_MEMBERS),
      },
    ];
  }).slice(0, MAX_DECLARED_GROUPS);

  // Each contact lists its groups for the picking list and its search; the groups themselves
  // are what the import sends.
  const groupsOf = new Map<string, string[]>();
  for (const group of groups) {
    for (const member of group.members) {
      const key = member.toLocaleLowerCase();
      groupsOf.set(key, [...(groupsOf.get(key) ?? []), group.name]);
    }
  }
  const contacts = list(file.contacts).flatMap((entry): ImportedContact[] => {
    if (!isRecord(entry) || typeof entry.name !== "string") return [];
    const name = tidy(entry.name);
    return [
      contact(name, birthYear(String(entry.birth_year ?? "")), groupsOf.get(name.toLocaleLowerCase()) ?? []),
    ];
  });
  return { contacts, groups };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// vCard (RFC 6350; Google exports 3.0)

function parseVCards(text: string): ImportedContact[] {
  // Long lines continue on the next one, indented by a space or tab.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const contacts: ImportedContact[] = [];
  let card: Map<string, string[]> | undefined;
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    // "item1.EMAIL;TYPE=home" → "EMAIL"
    const key = line.slice(0, colon).split(";")[0]!.replace(/^.*\./, "").toUpperCase();
    const value = line.slice(colon + 1);
    if (key === "BEGIN" && value.toUpperCase() === "VCARD") card = new Map();
    else if (key === "END" && card) {
      contacts.push(fromVCard(card));
      card = undefined;
    } else if (card) card.set(key, [...(card.get(key) ?? []), value]);
  }
  return contacts;
}

function fromVCard(card: Map<string, string[]>): ImportedContact {
  const first = (key: string) => card.get(key)?.[0] ?? "";
  // N: family;given;additional;prefix;suffix
  const [family = "", given = "", additional = ""] = splitEscaped(first("N"), ";");
  const name =
    unescapeText(first("FN")) || words(given, additional, family) || unescapeText(first("NICKNAME"));
  const groups = (card.get("CATEGORIES") ?? []).flatMap((value) => splitEscaped(value, ","));
  return contact(name, birthYear(first("BDAY")), groups.filter((g) => !GOOGLE_SYSTEM.has(g)));
}

/** Google's own groups, not ones the user made. */
const GOOGLE_SYSTEM = new Set(["myContacts", "starred"]);

function splitEscaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (char === "\\" && i + 1 < value.length) current += char + value[++i];
    else if (char === separator) {
      parts.push(unescapeText(current));
      current = "";
    } else current += char;
  }
  parts.push(unescapeText(current));
  return parts;
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) => (char.toLowerCase() === "n" ? " " : char));
}

// Google CSV: one row per contact, a header row naming the columns

function parseCsv(text: string): ImportedContact[] {
  const [header, ...rows] = csvRows(text);
  if (!header) return [];
  const index = new Map(header.map((name, i) => [name.trim().toLowerCase(), i]));
  const column = (row: string[], ...names: string[]) => {
    for (const name of names) {
      const value = row[index.get(name.toLowerCase()) ?? -1]?.trim();
      if (value) return value;
    }
    return "";
  };
  return rows.map((row) => {
    const name =
      column(row, "Name") ||
      words(column(row, "First Name"), column(row, "Middle Name"), column(row, "Last Name")) ||
      words(column(row, "Given Name"), column(row, "Additional Name"), column(row, "Family Name")) ||
      column(row, "Nickname", "File As");
    // "* myContacts ::: Familie ::: Arbeit"; the starred ones are Google's own.
    const labels = column(row, "Labels", "Group Membership")
      .split(":::")
      .map((label) => label.trim())
      .filter((label) => label && !label.startsWith("*"));
    return contact(name, birthYear(column(row, "Birthday")), labels);
  });
}

/** RFC 4180: quoted fields may hold commas, quotes ("") and line breaks. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

// Shared

function contact(name: string, birth_year: number | null, groups: string[]): ImportedContact {
  return {
    name: tidy(name),
    birth_year,
    groups: [...new Set(groups.map((g) => g.trim().slice(0, MAX_NAME)).filter(Boolean))].slice(
      0,
      MAX_GROUPS,
    ),
  };
}

/** One line, no stray spaces, as long as the backend takes. */
function tidy(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

function words(...parts: string[]): string {
  return parts.map((part) => unescapeText(part).trim()).filter(Boolean).join(" ");
}

/** "1990-05-17", "19900517", "1990-05-17T00:00:00Z" or just "1990" (the export's); birthdays
 * without a year ("--05-17") have none. */
function birthYear(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(?:-?\d{2}-?\d{2})?(?!\d)/);
  const year = match ? Number(match[1]) : NaN;
  return year >= 1900 && year <= 2100 ? year : null;
}

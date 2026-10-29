/** Writes the address book as a file, in the browser. Nothing is sent anywhere.
 *
 * CSV: name, birth year and groups, the columns Google Contacts uses, for spreadsheets and other
 * address books. JSON: everything the app keeps, also each group's setting, its members in order
 * and groups without members; a backup that the import restores. */

type Contact = { id: string; name: string; birth_year?: number | null; group_ids: string[] };
type Group = {
  id: string;
  name: string;
  invite_mode: "together" | "separately";
  member_ids: string[];
};

/** Marks a JSON file as this app's, so the import doesn't take any other JSON for one. */
export const JSON_FORMAT = "guestlist-address-book";

// A byte order mark, so Excel reads the CSV as UTF-8 (umlauts, emoji); the import skips it.
const BOM = "﻿";

export function toCsv(contacts: Contact[], groups: Group[]): string {
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const rows = contacts.map((contact) => [
    contact.name,
    contact.birth_year ? String(contact.birth_year) : "",
    contact.group_ids.flatMap((id) => groupNames.get(id) ?? []).join(" ::: "),
  ]);
  return BOM + [["Name", "Birthday", "Labels"], ...rows].map(csvLine).join("\r\n") + "\r\n";
}

/** RFC 4180: a field with a comma, quote or line break is quoted, and its quotes doubled. */
function csvLine(fields: string[]): string {
  return fields
    .map((field) => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
    .join(",");
}

/** What a selection exports: the chosen contacts and groups, and the people in the chosen groups
 * (a group without them would be empty). A contact is only in the chosen groups: the file holds
 * what was ticked, not the rest of the address book around it. */
export function exportSelection<C extends Contact, G extends Group>(
  contacts: C[],
  groups: G[],
  chosen: Set<string>,
): { contacts: C[]; groups: G[] } {
  const picked = groups.filter((group) => chosen.has(group.id));
  const inPicked = new Set(picked.flatMap((group) => group.member_ids));
  const pickedIds = new Set(picked.map((group) => group.id));
  return {
    contacts: contacts
      .filter((contact) => chosen.has(contact.id) || inPicked.has(contact.id))
      .map((contact) => ({
        ...contact,
        group_ids: contact.group_ids.filter((id) => pickedIds.has(id)),
      })),
    groups: picked,
  };
}

/** Contacts have unique names, so a group names its members instead of pointing at IDs: the file
 * says the same wherever it is restored. */
export function toJson(contacts: Contact[], groups: Group[]): string {
  const names = new Map(contacts.map((contact) => [contact.id, contact.name]));
  return (
    JSON.stringify(
      {
        format: JSON_FORMAT,
        version: 1,
        contacts: contacts.map((contact) => ({
          name: contact.name,
          birth_year: contact.birth_year ?? null,
        })),
        groups: groups.map((group) => ({
          name: group.name,
          invite_mode: group.invite_mode,
          members: group.member_ids.flatMap((id) => names.get(id) ?? []),
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

/** Hands the browser a file to save. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

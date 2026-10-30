import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { SaveBar, useSave } from "../admin/forms";
import {
  type ImportedContact,
  type ImportedGroup,
  type Share,
  importBody,
  parseContacts,
} from "./importFile";
import { matches } from "../../components/search";
import { SearchField } from "../../components/SearchField";
import { useReveal } from "../../components/useReveal";

/** Import from a Google Contacts export (or any vCard/CSV). The file never leaves the browser;
 * only the picked contacts' names, birth years and labels are sent (D32). */
export function ImportContacts({
  contacts,
  onImported,
  onClose,
}: {
  contacts: Schemas["ContactOut"][];
  onImported: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const reveal = useReveal<HTMLElement>();
  const [found, setFound] = useState<ImportedContact[]>();
  const [declared, setDeclared] = useState<ImportedGroup[]>([]); // a JSON file's own groups
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Schemas["ImportResult"]>();
  const [fileName, setFileName] = useState<string>();
  const [withoutName, setWithoutName] = useState(0);
  const [search, setSearch] = useState("");
  const [share, setShare] = useState<Share>({ birthYear: true, labels: true });
  const known = new Set(contacts.map((contact) => contact.name.toLocaleLowerCase()));
  const isKnown = (contact: ImportedContact) => known.has(contact.name.toLocaleLowerCase());
  // Names are unique (the backend skips the rest too): a name already in the address book, or
  // one the file had earlier, can't be imported, so it isn't listed; a line says how many.
  const twice = new Set(
    (found ?? []).flatMap((contact, i) =>
      (found ?? [])
        .slice(0, i)
        .some((earlier) => earlier.name.toLocaleLowerCase() === contact.name.toLocaleLowerCase())
        ? [i]
        : [],
    ),
  );
  const blocked = (i: number) => isKnown(found![i]!) || twice.has(i);
  const knownCount = (found ?? []).filter(isKnown).length;
  const twiceCount = [...twice].filter((i) => !isKnown(found![i]!)).length;
  const importable = (found ?? []).flatMap((_, i) => (blocked(i) ? [] : [i]));

  async function read(file: File | undefined) {
    setError(undefined);
    setResult(undefined);
    if (!file) return;
    const { contacts: parsed, withoutName: skipped, groups } = parseContacts(await file.text());
    setWithoutName(skipped);
    setDeclared(groups);
    if (parsed.length === 0) {
      setFound(undefined);
      setError(t("contacts.import.nothing"));
      return;
    }
    setFound(parsed);
    setSearch("");
    // Everything that can be imported, i.e. not a name already there or earlier in the file.
    const seen = new Set(known);
    setPicked(
      new Set(
        parsed.flatMap((contact, i) => {
          const key = contact.name.toLocaleLowerCase();
          if (seen.has(key)) return [];
          seen.add(key);
          return [i];
        }),
      ),
    );
  }

  // The list shows, and searches, only what the import will carry.
  const visible = importable.filter((i) =>
    matches(search, found![i]!.name, ...(share.labels ? found![i]!.groups : [])),
  );
  const visiblePicked = visible.filter((i) => picked.has(i)).length;

  function pickVisible(on: boolean) {
    setPicked((all) => {
      const next = new Set(all);
      for (const i of visible) {
        if (on) next.add(i);
        else next.delete(i);
      }
      return next;
    });
  }

  function toggle(index: number, on: boolean) {
    setPicked((all) => {
      const next = new Set(all);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!found) return;
    const body = importBody(found, declared, picked, share);
    void save.run(async () => {
      setResult(await unwrap(api.POST("/api/admin/contacts/import", { body })));
      setFound(undefined);
      await onImported();
    });
  }

  return (
    <section className="card" ref={reveal}>
      <h2>{t("contacts.import.title")}</h2>
      <p className="muted">{t("contacts.import.how")}</p>
      <p className="hint">{t("contacts.import.privacy")}</p>
      <div className="field">
        <span>{t("contacts.import.include")}</span>
        <div className="choices">
          <label className="choice">
            <input
              type="checkbox"
              checked={share.birthYear}
              onChange={(e) => setShare({ ...share, birthYear: e.target.checked })}
            />
            {t("contacts.import.birthYear")}
          </label>
          <label className="choice">
            <input
              type="checkbox"
              checked={share.labels}
              onChange={(e) => setShare({ ...share, labels: e.target.checked })}
            />
            {t("contacts.import.labels")}
          </label>
        </div>
      </div>
      {/* A button like every other, in the page's language; the browser's own file input
          would say "Choose File" in the browser's. */}
      <div className="field">
        <span>{t("contacts.import.file")}</span>
        <div className="row-start">
          <label className="button">
            {t("contacts.import.choose")}
            <input
              type="file"
              className="sr-only"
              accept=".vcf,.csv,.json,text/vcard,text/csv,application/json"
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name);
                void read(e.target.files?.[0]);
              }}
            />
          </label>
          {fileName && <span className="muted">{fileName}</span>}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <p className="success">
          {t("contacts.import.done", { count: result.contacts, groups: result.groups })}
          {result.skipped > 0 && ` ${t("contacts.import.skipped", { count: result.skipped })}`}
        </p>
      )}

      {found && (
        <form onSubmit={submit}>
          {withoutName > 0 && (
            <p className="hint">{t("contacts.import.withoutName", { count: withoutName })}</p>
          )}
          {knownCount > 0 && (
            <p className="hint">{t("contacts.import.knownHidden", { count: knownCount })}</p>
          )}
          {twiceCount > 0 && (
            <p className="hint">{t("contacts.import.twiceHidden", { count: twiceCount })}</p>
          )}
          {importable.length > 8 && (
            <SearchField label={t("contacts.searchHint")} value={search} onChange={setSearch} />
          )}
          {/* One checkbox for everything the search shows, as in a mail client: a dash while
              only some of them are ticked. */}
          <div className="import-list">
            <div className="import-head">
              <label className="choice">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = visiblePicked > 0 && visiblePicked < visible.length;
                  }}
                  checked={visible.length > 0 && visiblePicked === visible.length}
                  disabled={visible.length === 0}
                  onChange={(e) => pickVisible(e.target.checked)}
                />
                <strong>
                  {visible.length < importable.length
                    ? t("contacts.import.matching", {
                        count: visible.length,
                        total: importable.length,
                      })
                    : t("contacts.import.found", { count: importable.length })}
                </strong>
              </label>
              <span className="muted">{t("contacts.import.picked", { count: picked.size })}</span>
            </div>
            <ul className="rows">
              {visible.map((i) => {
                const contact = found[i]!;
                return (
                  <li key={i}>
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={picked.has(i)}
                        onChange={(e) => toggle(i, e.target.checked)}
                      />
                      <span>
                        {contact.name}
                        {share.birthYear && contact.birth_year && (
                          <span className="muted"> · {contact.birth_year}</span>
                        )}
                        {share.labels && contact.groups.length > 0 && (
                          <span className="muted"> · {contact.groups.join(", ")}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <SaveBar
            save={save}
            label={t("contacts.import.submit", { count: picked.size })}
            onCancel={() => setFound(undefined)}
            disabled={picked.size === 0}
          />
        </form>
      )}
      {!found && (
        <div className="actions">
          <button type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      )}
    </section>
  );
}

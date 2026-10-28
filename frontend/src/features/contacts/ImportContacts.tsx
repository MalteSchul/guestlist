import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { SaveBar, useSave } from "../admin/forms";
import { type ImportedContact, parseContacts } from "./importFile";
import { matches } from "./search";

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
  const [found, setFound] = useState<ImportedContact[]>();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Schemas["ImportResult"]>();
  const [fileName, setFileName] = useState<string>();
  const [withoutName, setWithoutName] = useState(0);
  const [search, setSearch] = useState("");
  const known = new Set(contacts.map((contact) => contact.name.toLocaleLowerCase()));
  const isKnown = (contact: ImportedContact) => known.has(contact.name.toLocaleLowerCase());

  async function read(file: File | undefined) {
    setError(undefined);
    setResult(undefined);
    if (!file) return;
    const { contacts: parsed, withoutName: skipped } = parseContacts(await file.text());
    setWithoutName(skipped);
    if (parsed.length === 0) {
      setFound(undefined);
      setError(t("contacts.import.nothing"));
      return;
    }
    setFound(parsed);
    setSearch("");
    // Already in the address book (same name): left out unless picked, so a second import of
    // the same file adds nothing twice.
    setPicked(new Set(parsed.flatMap((contact, i) => (isKnown(contact) ? [] : [i]))));
  }

  const visible = (found ?? []).flatMap((contact, i) =>
    matches(search, contact.name, ...contact.groups) ? [i] : [],
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
    const body = { contacts: found.filter((_, i) => picked.has(i)) };
    void save.run(async () => {
      setResult(await unwrap(api.POST("/api/admin/contacts/import", { body })));
      setFound(undefined);
      await onImported();
    });
  }

  return (
    <section className="card">
      <h2>{t("contacts.import.title")}</h2>
      <p className="muted">{t("contacts.import.how")}</p>
      <p className="hint">{t("contacts.import.privacy")}</p>
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
              accept=".vcf,.csv,text/vcard,text/csv"
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
        </p>
      )}

      {found && (
        <form onSubmit={submit}>
          {withoutName > 0 && (
            <p className="hint">{t("contacts.import.withoutName", { count: withoutName })}</p>
          )}
          {found.length > 8 && (
            <input
              type="search"
              className="search"
              aria-label={t("contacts.search")}
              placeholder={t("contacts.searchHint")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                  {visible.length < found.length
                    ? t("contacts.import.matching", { count: visible.length, total: found.length })
                    : t("contacts.import.found", { count: found.length })}
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
                        {contact.birth_year && (
                          <span className="muted"> · {contact.birth_year}</span>
                        )}
                        {contact.groups.length > 0 && (
                          <span className="muted"> · {contact.groups.join(", ")}</span>
                        )}
                        {isKnown(contact) && (
                          <span className="badge">{t("contacts.import.known")}</span>
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

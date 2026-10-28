import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Picker } from "../../components/Picker";
import { type SuggestItem, SuggestInput } from "../../components/Suggest";
import { useLoad } from "../../components/useLoad";
import { SaveBar, useSave } from "./forms";
import { useReveal } from "../../components/useReveal";

type Event = Schemas["EventOut"];
type Invite = Schemas["InviteOut"];
type Contact = Schemas["ContactOut"];
type Group = Schemas["GroupOut"];
type InviteMode = Group["invite_mode"];

/** Typed-in names or contacts from the host's address book (D9), or a whole group (D31). */
export function NewInvite({
  event,
  invites,
  onCreated,
}: {
  event: Event;
  invites: Invite[];
  onCreated: (created: Invite[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<"persons" | "group">();
  const contacts = useLoad(() => unwrap(api.GET("/api/admin/contacts")), []);
  const groups = useLoad(() => unwrap(api.GET("/api/admin/groups")), []);
  // A contact gets at most one invite per event (D21).
  const invited = new Set(invites.flatMap((i) => i.persons.map((p) => p.contact_id)));

  if (!open) {
    return (
      <p className="row-start">
        <button type="button" onClick={() => setOpen("persons")}>
          + {t("admin.event.newInvite")}
        </button>
        {(groups.data?.length ?? 0) > 0 && (
          <button type="button" onClick={() => setOpen("group")}>
            + {t("admin.event.inviteGroup")}
          </button>
        )}
      </p>
    );
  }

  const done = (created: Invite[]) => {
    onCreated(created);
    setOpen(undefined);
  };
  return open === "persons" ? (
    <PersonsForm
      event={event}
      contacts={(contacts.data ?? []).filter((contact) => !invited.has(contact.id))}
      onCreated={(invite) => done([invite])}
      onCancel={() => setOpen(undefined)}
    />
  ) : (
    <GroupForm
      event={event}
      groups={groups.data ?? []}
      contacts={contacts.data ?? []}
      invited={invited}
      onCreated={done}
      onCancel={() => setOpen(undefined)}
    />
  );
}

type Row = { key: number; name: string; contactId?: string };

function PersonsForm({
  event,
  contacts,
  onCreated,
  onCancel,
}: {
  event: Event;
  /** Not invited yet, so they can be suggested. */
  contacts: Contact[];
  onCreated: (invite: Invite) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: "" }]);
  const reveal = useReveal<HTMLFormElement>();
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<number>(0);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  useEffect(() => {
    const input = inputs.current.get(focus);
    input?.focus({ preventScroll: true });
    // The first row comes into view with the whole form (`reveal`); later ones only as needed.
    if (focus !== 0) input?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const linked = new Set(rows.map((row) => row.contactId));
  const suggestions = contacts.filter((contact) => !linked.has(contact.id));
  const items = suggestions.map((contact) => ({
    id: contact.id,
    label: contact.name,
    detail: contact.birth_year?.toString(), // tells two people of the same name apart
  }));
  const names = rows.map((row) => row.name.trim()).filter(Boolean);
  // "Anna", "Anna & Tom", "Anna, Tom & Lea": used when no name is typed in.
  const suggested =
    names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

  /** There's always one empty row at the end: typing into it adds the next one. */
  function withFreeRow(all: Row[]): Row[] {
    return all.at(-1)?.name ? [...all, { key: nextKey.current++, name: "" }] : all;
  }

  /** A name that matches a contact links the row to it; editing it again unlinks. */
  function linkedRow(key: number, value: string): Row {
    const match = suggestions.find(
      (c) => c.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
    );
    return { key, name: match ? match.name : value, contactId: match?.id };
  }

  function change(key: number, value: string) {
    setRows((all) =>
      withFreeRow(all.map((row) => (row.key === key ? linkedRow(key, value) : row))),
    );
  }

  /** A suggestion taken with Enter or a click: the row is linked, the cursor goes on. */
  function choose(index: number, item: SuggestItem) {
    const updated = withFreeRow(
      rows.map((row, i) => (i === index ? { key: row.key, name: item.label, contactId: item.id } : row)),
    );
    setRows(updated);
    const next = updated[index + 1];
    if (next) setFocus(next.key);
  }

  /** With the keyboard, the cursor moves to the row above (below for the first one), so typing
   * goes on; a mouse click on × only removes the row. */
  function remove(key: number, byKeyboard: boolean) {
    const index = rows.findIndex((row) => row.key === key);
    const neighbour = rows[index - 1] ?? rows[index + 1];
    setRows((all) => withFreeRow(all.filter((row) => row.key !== key)));
    if (neighbour && byKeyboard) setFocus(neighbour.key);
  }

  function keyDown(row: Row, index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // Enter goes to the next row; only the button saves
      const next = rows[index + 1];
      if (next) setFocus(next.key);
    } else if (e.key === "Backspace" && !row.name && index < rows.length - 1) {
      e.preventDefault();
      remove(row.key, true);
    }
  }

  /** A pasted list (one name per line) becomes one row per name. */
  function paste(row: Row, e: ClipboardEvent<HTMLInputElement>) {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const pasted = [
      linkedRow(row.key, row.name + lines[0]),
      ...lines.slice(1).map((line) => linkedRow(nextKey.current++, line)),
    ];
    setRows((all) => {
      const index = all.findIndex((r) => r.key === row.key);
      return withFreeRow([...all.slice(0, index), ...pasted, ...all.slice(index + 1)]);
    });
    setFocus(pasted.at(-1)!.key);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const persons = rows
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), contact_id: row.contactId ?? null }));
    void save.run(async () => {
      onCreated(
        await unwrap(
          api.POST("/api/admin/events/{event_id}/invites", {
            params: { path: { event_id: event.id } },
            body: { name: name.trim() || suggested, persons },
          }),
        ),
      );
    });
  }

  return (
    <form onSubmit={submit} onChange={save.reset} className="card" ref={reveal}>
      <h2>{t("admin.event.newInvite")}</h2>
      <fieldset className="field plain">
        <legend>{t("admin.event.persons")}</legend>
        <ul className="name-rows">
          {rows.map((row, i) => (
            <li key={row.key}>
              {/* The badge sits inside the input, so every row is equally wide. A linked row
                  suggests nothing, so Enter goes on; editing its name unlinks it. */}
              <span className="name-input">
                <SuggestInput
                  inputRef={(el) => {
                    if (el) inputs.current.set(row.key, el);
                    else inputs.current.delete(row.key);
                  }}
                  className={row.contactId ? "linked" : undefined}
                  aria-label={t("admin.event.personNumber", { number: i + 1 })}
                  placeholder={
                    i === 0 ? t("admin.event.personPlaceholder") : t("admin.event.morePlaceholder")
                  }
                  value={row.name}
                  required={i === 0 && names.length === 0}
                  items={row.contactId ? [] : items}
                  onValueChange={(value) => change(row.key, value)}
                  onPick={(item) => choose(i, item)}
                  onKeyDown={(e) => keyDown(row, i, e)}
                  onPaste={(e) => paste(row, e)}
                />
                {row.contactId && <span className="badge">{t("admin.event.fromContacts")}</span>}
              </span>
              {/* The free row at the end can't be removed; its space stays so rows line up. */}
              {i < rows.length - 1 ? (
                <button
                  type="button"
                  className="icon"
                  aria-label={t("common.remove")}
                  title={t("common.remove")}
                  // detail is 0 when Enter or Space pressed the button, the click count otherwise
                  onClick={(e) => remove(row.key, e.detail === 0)}
                >
                  ×
                </button>
              ) : (
                rows.length > 1 && <span className="icon-space" />
              )}
            </li>
          ))}
        </ul>
        <span className="hint">
          {contacts.length > 0 ? t("admin.event.personsHintContacts") : t("admin.event.personsHint")}
        </span>
      </fieldset>
      <label className="field">
        <span>{t("admin.event.inviteName")}</span>
        <input
          type="text"
          value={name}
          placeholder={suggested}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="hint">{t("admin.event.inviteNameHint")}</span>
      </label>
      <SaveBar save={save} label={t("admin.event.createInvite")} onCancel={onCancel} />
    </form>
  );
}

function GroupForm({
  event,
  groups,
  contacts,
  invited,
  onCreated,
  onCancel,
}: {
  event: Event;
  groups: Group[];
  contacts: Contact[];
  invited: Set<string | null>;
  onCreated: (created: Invite[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const [groupId, setGroupId] = useState<string>();
  const reveal = useReveal<HTMLFormElement>();
  const group = groups.find((g) => g.id === groupId);
  // The group's own setting, until the host picks the other one for this event (D31).
  const [mode, setMode] = useState<InviteMode>("together");
  const names = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const members = group?.member_ids ?? [];
  const fresh = members.filter((id) => !invited.has(id));

  function pick([id]: string[]) {
    setGroupId(id);
    setMode(groups.find((g) => g.id === id)?.invite_mode ?? "together");
  }

  // Once a group is chosen, the cursor moves to the create button, so Enter creates the invite.
  // Scrolling is left to `reveal`.
  useEffect(() => {
    if (!groupId) return;
    reveal.current?.querySelector<HTMLButtonElement>("button.primary")?.focus({ preventScroll: true });
  }, [groupId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    void save.run(async () => {
      const result = await unwrap(
        api.POST("/api/admin/events/{event_id}/invites/group", {
          params: { path: { event_id: event.id } },
          body: { group_id: groupId, invite_mode: mode },
        }),
      );
      onCreated(result.invites);
    });
  }

  return (
    <form onSubmit={submit} onChange={save.reset} className="card" ref={reveal}>
      <h2>{t("admin.event.inviteGroup")}</h2>
      <Picker
        single
        label={t("admin.event.group")}
        placeholder={t("contacts.groups.search")}
        items={groups.map((g) => ({
          id: g.id,
          label: g.name,
          detail: t("contacts.groups.memberCount", { count: g.member_ids.length }),
        }))}
        selected={groupId ? [groupId] : []}
        onChange={pick}
      />
      {group && (
        <>
          <fieldset className="field plain">
            <legend>{t("admin.event.groupMode")}</legend>
            <div className="choices">
              {(["together", "separately"] as const).map((m) => (
                <label key={m} className="choice">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    // Browsers don't submit a form on Enter in a radio button by themselves.
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }}
                  />
                  {t(`contacts.inviteModes.${m}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted">
            {members.length === 0
              ? t("contacts.groups.noMembers")
              : members.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ", "}
                    {invited.has(id) ? (
                      <s title={t("admin.event.alreadyInvited")}>{names.get(id)}</s>
                    ) : (
                      names.get(id)
                    )}
                  </span>
                ))}
          </p>
          {fresh.length < members.length && (
            <p className="hint">
              {t("admin.event.skipped", { count: members.length - fresh.length })}
            </p>
          )}
        </>
      )}
      {group ? (
        <SaveBar
          save={save}
          label={
            mode === "together"
              ? t("admin.event.createInvite")
              : t("admin.event.createInvites", { count: fresh.length })
          }
          onCancel={onCancel}
        />
      ) : (
        <div className="actions">
          <button type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      )}
    </form>
  );
}

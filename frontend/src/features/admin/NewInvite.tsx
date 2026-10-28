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
import { useLoad } from "../../components/useLoad";
import { SaveBar, useSave } from "./forms";

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
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<number>(0);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const listId = `contacts-${event.id}`;

  useEffect(() => {
    inputs.current.get(focus)?.focus();
  }, [focus]);

  const linked = new Set(rows.map((row) => row.contactId));
  const suggestions = contacts.filter((contact) => !linked.has(contact.id));
  const names = rows.map((row) => row.name.trim()).filter(Boolean);
  // "Anna", "Anna & Tom", "Anna, Tom & Lea": used when no name is typed in.
  const suggested =
    names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

  /** A name that matches a contact links the row to it; editing it again unlinks. */
  function change(key: number, value: string) {
    const match = suggestions.find(
      (c) => c.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
    );
    setRows((all) =>
      all.map((row) =>
        row.key !== key
          ? row
          : { key, name: match ? match.name : value, contactId: match?.id },
      ),
    );
  }

  function add(after: number, values: string[] = [""]) {
    const added = values.map((value) => ({ key: nextKey.current++, name: value }));
    setRows((all) => {
      const index = all.findIndex((row) => row.key === after);
      return [...all.slice(0, index + 1), ...added, ...all.slice(index + 1)];
    });
    setFocus(added.at(-1)!.key);
  }

  /** The cursor moves to the row above, or below for the first one. */
  function remove(key: number) {
    const index = rows.findIndex((row) => row.key === key);
    const neighbour = rows[index - 1] ?? rows[index + 1];
    setRows((all) => all.filter((row) => row.key !== key));
    if (neighbour) setFocus(neighbour.key);
  }

  function keyDown(row: Row, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // Enter adds the next person; the button saves
      if (row.name.trim()) add(row.key);
    } else if (e.key === "Backspace" && !row.name && rows.length > 1) {
      e.preventDefault();
      remove(row.key);
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
    change(row.key, row.name + lines[0]);
    add(row.key, lines.slice(1));
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
    <form onSubmit={submit} onChange={save.reset} className="card">
      <h2>{t("admin.event.newInvite")}</h2>
      <fieldset className="field plain">
        <legend>{t("admin.event.persons")}</legend>
        <datalist id={listId}>
          {suggestions.map((contact) => (
            <option key={contact.id} value={contact.name} />
          ))}
        </datalist>
        <ul className="name-rows">
          {rows.map((row, i) => (
            <li key={row.key}>
              {/* The badge sits inside the input, so every row is equally wide. A linked row
                  needs no suggestions; editing its name unlinks it and brings them back. */}
              <span className="name-input">
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(row.key, el);
                    else inputs.current.delete(row.key);
                  }}
                  type="text"
                  className={row.contactId ? "linked" : undefined}
                  list={!row.contactId && suggestions.length > 0 ? listId : undefined}
                  aria-label={t("admin.event.personNumber", { number: i + 1 })}
                  placeholder={i === 0 ? t("admin.event.personPlaceholder") : undefined}
                  value={row.name}
                  required={i === 0}
                  onChange={(e) => change(row.key, e.target.value)}
                  onKeyDown={(e) => keyDown(row, e)}
                  onPaste={(e) => paste(row, e)}
                />
                {row.contactId && <span className="badge">{t("admin.event.fromContacts")}</span>}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon"
                  aria-label={t("common.remove")}
                  title={t("common.remove")}
                  onClick={() => remove(row.key)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        <span className="hint">
          {contacts.length > 0 ? t("admin.event.personsHintContacts") : t("admin.event.personsHint")}
        </span>
        <p>
          <button type="button" onClick={() => add(rows.at(-1)!.key)}>
            + {t("admin.event.addPerson")}
          </button>
        </p>
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
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === groupId);
  // The group's own setting, until the host picks the other one for this event (D31).
  const [mode, setMode] = useState<InviteMode>(group?.invite_mode ?? "together");
  const names = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const members = group?.member_ids ?? [];
  const fresh = members.filter((id) => !invited.has(id));

  function pick(id: string) {
    setGroupId(id);
    setMode(groups.find((g) => g.id === id)?.invite_mode ?? "together");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} onChange={save.reset} className="card">
      <h2>{t("admin.event.inviteGroup")}</h2>
      <label className="field">
        <span>{t("admin.event.group")}</span>
        <select value={groupId} onChange={(e) => pick(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.member_ids.length})
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field plain">
        <legend>{t("admin.event.groupMode")}</legend>
        <div className="choices">
          {(["together", "separately"] as const).map((m) => (
            <label key={m} className="choice">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
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
      <SaveBar
        save={save}
        label={
          mode === "together"
            ? t("admin.event.createInvite")
            : t("admin.event.createInvites", { count: fresh.length })
        }
        onCancel={onCancel}
      />
    </form>
  );
}

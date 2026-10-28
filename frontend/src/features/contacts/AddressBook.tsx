import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { InviteModeIcon } from "../../components/InviteModeIcon";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { SaveBar, useSave } from "../admin/forms";
import { ImportContacts } from "./ImportContacts";
import { Picker } from "../../components/Picker";
import { matches } from "../../components/search";
import { useReveal } from "../../components/useReveal";

type Contact = Schemas["ContactOut"];
type Group = Schemas["GroupOut"];
type InviteMode = Group["invite_mode"];

const INVITE_MODES: InviteMode[] = ["together", "separately"];

/** The host's own people and groups, reused for every event (D8). */
export function AddressBook() {
  const contacts = useLoad(() => unwrap(api.GET("/api/admin/contacts")), []);
  const groups = useLoad(() => unwrap(api.GET("/api/admin/groups")), []);

  // After every change, so the page shows what the backend stored; memberships change both.
  async function reload() {
    const [c, g] = await Promise.all([
      unwrap(api.GET("/api/admin/contacts")),
      unwrap(api.GET("/api/admin/groups")),
    ]);
    contacts.setData(c);
    groups.setData(g);
  }

  return (
    <Layout admin>
      <Loaded {...contacts}>
        {(contactList) => (
          <Loaded {...groups}>
            {(groupList) => (
              <Book contacts={contactList} groups={groupList} reload={reload} />
            )}
          </Loaded>
        )}
      </Loaded>
    </Layout>
  );
}

function Book({
  contacts,
  groups,
  reload,
}: {
  contacts: Contact[];
  groups: Group[];
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);

  return (
    <>
      <div className="row">
        <h1>{t("contacts.title")}</h1>
        {!importing && (
          <button type="button" onClick={() => setImporting(true)}>
            {t("contacts.import.open")}
          </button>
        )}
      </div>
      {importing && (
        <ImportContacts
          contacts={contacts}
          onImported={reload}
          onClose={() => setImporting(false)}
        />
      )}
      <Groups contacts={contacts} groups={groups} reload={reload} />
      <Contacts contacts={contacts} groups={groups} reload={reload} />
    </>
  );
}

// Groups

function Groups({
  contacts,
  groups,
  reload,
}: {
  contacts: Contact[];
  groups: Group[];
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a group's ID
  const [adding, setAdding] = useState(false);
  const names = new Map(contacts.map((contact) => [contact.id, contact.name]));

  function remove(group: Group) {
    if (!window.confirm(t("contacts.groups.confirmDelete", { name: group.name }))) return;
    void action.run(async () => {
      await unwrap(
        api.DELETE("/api/admin/groups/{group_id}", { params: { path: { group_id: group.id } } }),
      );
      await reload();
    });
  }

  return (
    <>
      <h2>{t("contacts.groups.title")}</h2>
      <p className="muted">{t("contacts.groups.hint")}</p>
      {action.error && <p className="error">{action.error}</p>}
      {groups.length === 0 && !adding && <p className="muted">{t("contacts.groups.empty")}</p>}
      <ul className="cards">
        {groups.map((group) =>
          editing === group.id ? (
            <li key={group.id} className="card">
              <GroupForm
                group={group}
                contacts={contacts}
                onSubmit={async (body) => {
                  await unwrap(
                    api.PUT("/api/admin/groups/{group_id}", {
                      params: { path: { group_id: group.id } },
                      body,
                    }),
                  );
                  await reload();
                  setEditing(undefined);
                }}
                onCancel={() => setEditing(undefined)}
              />
            </li>
          ) : (
            <li key={group.id} className="card">
              <div className="row">
                <span>
                  <strong>{group.name}</strong>
                  <InviteModeIcon
                    mode={group.invite_mode}
                    label={t(`contacts.inviteModes.${group.invite_mode}`)}
                  />
                </span>
                <span className="controls">
                  <button type="button" onClick={() => setEditing(group.id)}>
                    {t("common.edit")}
                  </button>
                  <button type="button" className="danger" onClick={() => remove(group)}>
                    {t("common.delete")}
                  </button>
                </span>
              </div>
              <p className="muted">
                {group.member_ids.length === 0
                  ? t("contacts.groups.noMembers")
                  : group.member_ids.map((id) => names.get(id)).join(", ")}
              </p>
            </li>
          ),
        )}
      </ul>
      {adding ? (
        <div className="card">
          <GroupForm
            contacts={contacts}
            onSubmit={async (body) => {
              await unwrap(api.POST("/api/admin/groups", { body }));
              await reload();
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <p>
          <button type="button" onClick={() => setAdding(true)}>
            + {t("contacts.groups.add")}
          </button>
        </p>
      )}
    </>
  );
}

function GroupForm({
  group,
  contacts,
  onSubmit,
  onCancel,
}: {
  group?: Group;
  contacts: Contact[];
  onSubmit: (body: Schemas["GroupIn"]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const reveal = useReveal<HTMLFormElement>();
  const [name, setName] = useState(group?.name ?? "");
  const [mode, setMode] = useState<InviteMode>(group?.invite_mode ?? "together");
  // In the order they were added: also the order of the persons on a shared invite.
  const [members, setMembers] = useState(group?.member_ids ?? []);

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSubmit({ name, invite_mode: mode, member_ids: members }));
  }

  return (
    <form onSubmit={submit} onChange={save.reset} ref={reveal}>
      <label className="field">
        <span>{t("contacts.groups.name")} *</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <fieldset className="field plain">
        <legend>{t("contacts.groups.inviteMode")}</legend>
        <div className="choices">
          {INVITE_MODES.map((m) => (
            <label key={m} className="choice">
              <input
                type="radio"
                name="invite_mode"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <InviteModeIcon mode={m} />
              {t(`contacts.inviteModes.${m}`)}
            </label>
          ))}
        </div>
        <span className="hint">{t("contacts.groups.inviteModeHint")}</span>
      </fieldset>

      {contacts.length === 0 ? (
        <p className="hint">{t("contacts.groups.noContacts")}</p>
      ) : (
        <Picker
          label={t("contacts.groups.members")}
          placeholder={t("contacts.searchName")}
          items={contacts.map((contact) => ({
            id: contact.id,
            label: contact.name,
            detail: contact.birth_year?.toString(), // tells two people of the same name apart
          }))}
          selected={members}
          onChange={setMembers}
        />
      )}

      <SaveBar save={save} onCancel={onCancel} />
    </form>
  );
}

// Contacts

function Contacts({
  contacts,
  groups,
  reload,
}: {
  contacts: Contact[];
  groups: Group[];
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a contact's ID
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const shown = contacts.filter((contact) =>
    matches(search, contact.name, ...contact.group_ids.map((id) => groupNames.get(id) ?? "")),
  );

  function remove(contact: Contact) {
    if (!window.confirm(t("contacts.confirmDelete", { name: contact.name }))) return;
    void action.run(async () => {
      await unwrap(
        api.DELETE("/api/admin/contacts/{contact_id}", {
          params: { path: { contact_id: contact.id } },
        }),
      );
      await reload();
    });
  }

  return (
    <>
      <h2>{t("contacts.list", { count: contacts.length })}</h2>
      {action.error && <p className="error">{action.error}</p>}
      {contacts.length > 0 && (
        <p>
          <input
            type="search"
            className="search"
            aria-label={t("contacts.search")}
            placeholder={t("contacts.searchHint")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </p>
      )}
      {contacts.length === 0 && !adding && <p className="muted">{t("contacts.empty")}</p>}
      {contacts.length > 0 && shown.length === 0 && (
        <p className="muted">{t("contacts.noMatch", { query: search.trim() })}</p>
      )}
      {shown.length > 0 && (
        <ul className="card rows">
          {shown.map((contact) =>
            editing === contact.id ? (
              <li key={contact.id}>
                <ContactForm
                  contact={contact}
                  groups={groups}
                  onSubmit={async (body) => {
                    await unwrap(
                      api.PUT("/api/admin/contacts/{contact_id}", {
                        params: { path: { contact_id: contact.id } },
                        body,
                      }),
                    );
                    await reload();
                    setEditing(undefined);
                  }}
                  onCancel={() => setEditing(undefined)}
                />
              </li>
            ) : (
              <li key={contact.id} className="item-row">
                <span>
                  <strong>{contact.name}</strong>
                  {contact.birth_year && <span className="muted">{contact.birth_year}</span>}
                  {contact.group_ids.map((id) => (
                    <span key={id} className="badge">
                      {groupNames.get(id)}
                    </span>
                  ))}
                </span>
                <span className="controls">
                  <button type="button" onClick={() => setEditing(contact.id)}>
                    {t("common.edit")}
                  </button>
                  <button type="button" className="danger" onClick={() => remove(contact)}>
                    {t("common.delete")}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {adding ? (
        <div className="card">
          <ContactForm
            groups={groups}
            onSubmit={async (body) => {
              await unwrap(api.POST("/api/admin/contacts", { body }));
              await reload();
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <p>
          <button type="button" onClick={() => setAdding(true)}>
            + {t("contacts.add")}
          </button>
        </p>
      )}
    </>
  );
}

function ContactForm({
  contact,
  groups,
  onSubmit,
  onCancel,
}: {
  contact?: Contact;
  groups: Group[];
  onSubmit: (body: Schemas["ContactIn"]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const save = useSave();
  const reveal = useReveal<HTMLFormElement>();
  const [name, setName] = useState(contact?.name ?? "");
  const [birthYear, setBirthYear] = useState(contact?.birth_year?.toString() ?? "");
  const [groupIds, setGroupIds] = useState(contact?.group_ids ?? []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const year = birthYear.trim() ? Number(birthYear) : null;
    void save.run(() => onSubmit({ name, birth_year: year, group_ids: groupIds }));
  }

  return (
    <form onSubmit={submit} onChange={save.reset} ref={reveal}>
      <div className="columns">
        <label className="field">
          <span>{t("contacts.name")} *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t("contacts.birthYear")}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="(19|20)[0-9]{2}"
            placeholder="1990"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </label>
      </div>
      {groups.length > 0 && (
        <Picker
          label={t("contacts.groups.title")}
          placeholder={t("contacts.groups.search")}
          items={groups.map((group) => ({
            id: group.id,
            label: group.name,
            detail: t("contacts.groups.memberCount", { count: group.member_ids.length }),
          }))}
          selected={groupIds}
          onChange={setGroupIds}
        />
      )}
      <SaveBar save={save} onCancel={onCancel} />
    </form>
  );
}

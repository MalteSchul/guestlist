import { Fragment, type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { InviteModeIcon } from "../../components/InviteModeIcon";
import { Layout, Loaded } from "../../components/Layout";
import { SelectBox } from "../../components/SelectBox";
import { useLoad } from "../../components/useLoad";
import { IconButton, SaveBar, useSave } from "../admin/forms";
import { ExportMenu } from "./ExportMenu";
import { exportSelection } from "./exportFile";
import { ImportContacts } from "./ImportContacts";
import { SelectionBar } from "./SelectionBar";
import { Picker } from "../../components/Picker";
import { rank, searchList } from "../../components/search";
import { SearchField } from "../../components/SearchField";
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
  // Select mode: rows can be ticked, and nothing in the lists can be edited, deleted or added.
  const [selecting, setSelecting] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  // Contacts and groups are ticked in one go, so the selection is the page's, not a list's.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulk = useSave();

  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const shownGroups = searchList(
    groups,
    groupSearch,
    (group) => group.name,
    (group) => group.member_ids.map((id) => contactNames.get(id) ?? ""),
  );
  const shownContacts = searchList(
    contacts,
    contactSearch,
    (contact) => contact.name,
    (contact) => contact.group_ids.map((id) => groupNames.get(id) ?? ""),
  );

  // Only what can be seen counts: a search that hides a ticked row takes it out of what the
  // buttons act on (it is ticked again when the search is cleared).
  const pickedGroups = shownGroups.filter((group) => selected.has(group.id));
  const pickedContacts = shownContacts.filter((contact) => selected.has(contact.id));
  const count = pickedGroups.length + pickedContacts.length;
  const chosen = exportSelection(
    contacts,
    groups,
    new Set([...pickedGroups, ...pickedContacts].map((item) => item.id)),
  );

  function pick(ids: string[], on: boolean) {
    bulk.clearError(); // a failed delete says nothing about a different selection
    setSelected((all) => {
      const next = new Set(all);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  /** Into select mode with nothing ticked, or out of it, dropping what was ticked. */
  function toggleSelecting() {
    bulk.clearError();
    setSelected(new Set());
    setImporting(false);
    setSelecting(!selecting);
  }

  function removeSelected() {
    const what = [
      pickedContacts.length > 0 &&
        t("contacts.selection.contacts", { count: pickedContacts.length }),
      pickedGroups.length > 0 && t("contacts.selection.groups", { count: pickedGroups.length }),
    ].filter(Boolean);
    const notes = [
      pickedContacts.length > 0 && t("contacts.selection.contactsNote"),
      pickedGroups.length > 0 && t("contacts.selection.groupsNote"),
    ].filter(Boolean);
    const question = t("contacts.selection.confirmDelete", {
      what:
        what.length === 2
          ? t("contacts.selection.both", { contacts: what[0], groups: what[1] })
          : what[0],
    });
    if (!window.confirm(`${question}\n\n${notes.join(" ")}`)) return;
    void bulk.run(async () => {
      await unwrap(
        api.POST("/api/admin/address-book/delete", {
          body: {
            contact_ids: pickedContacts.map((contact) => contact.id),
            group_ids: pickedGroups.map((group) => group.id),
          },
        }),
      );
      setSelected(new Set());
      await reload();
    });
  }

  return (
    <>
      <div className="row">
        <h1>{t("contacts.title")}</h1>
        <span className="heading-actions">
          {!selecting && <ExportMenu contacts={contacts} groups={groups} />}
          {!selecting && !importing && (
            <IconButton
              icon="import"
              label={t("contacts.import.open")}
              onClick={() => setImporting(true)}
            />
          )}
          <IconButton
            icon="select"
            label={t("contacts.selection.start")}
            pressed={selecting}
            disabled={contacts.length === 0 && groups.length === 0}
            onClick={toggleSelecting}
          />
        </span>
      </div>
      {importing && (
        <ImportContacts
          contacts={contacts}
          onImported={reload}
          onClose={() => setImporting(false)}
        />
      )}
      <Groups
        contacts={contacts}
        groups={groups}
        shown={shownGroups}
        names={contactNames}
        search={groupSearch}
        onSearch={setGroupSearch}
        selecting={selecting}
        selected={selected}
        onPick={pick}
        reload={reload}
      />
      <Contacts
        contacts={contacts}
        groups={groups}
        shown={shownContacts}
        names={groupNames}
        search={contactSearch}
        onSearch={setContactSearch}
        selecting={selecting}
        selected={selected}
        onPick={pick}
        reload={reload}
      />
      {selecting && (
        <SelectionBar
          count={count}
          contacts={chosen.contacts}
          groups={chosen.groups}
          busy={bulk.status === "saving"}
          error={bulk.error}
          onDone={toggleSelecting}
          onDelete={removeSelected}
        />
      )}
    </>
  );
}

/** What the two lists share for select mode (see Book). */
type Picking = {
  selecting: boolean;
  selected: Set<string>;
  onPick: (ids: string[], on: boolean) => void;
};

/** In select mode a tap on a row ticks it, like its box; a tap on the box is the box's. */
function tickOnClick(picking: Picking, id: string) {
  if (!picking.selecting) return undefined;
  return (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest(".select-box")) {
      picking.onPick([id], !picking.selected.has(id));
    }
  };
}

function classes(...names: (string | false)[]): string {
  return names.filter(Boolean).join(" ");
}

// Groups

function Groups({
  contacts,
  groups,
  shown,
  names,
  search,
  onSearch,
  selecting,
  selected,
  onPick,
  reload,
}: {
  contacts: Contact[];
  groups: Group[];
  /** The groups the search finds, best first. */
  shown: Group[];
  /** Contact names by ID. */
  names: Map<string, string>;
  search: string;
  onSearch: (search: string) => void;
  reload: () => Promise<void>;
} & Picking) {
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a group's ID
  const [adding, setAdding] = useState(false);
  const ticked = shown.filter((group) => selected.has(group.id)).length;

  // Select mode has no forms: an open one is dropped, not hidden and brought back.
  useEffect(() => {
    if (selecting) {
      setEditing(undefined);
      setAdding(false);
    }
  }, [selecting]);

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
      <div className="row heading-search">
        <h2>{t("contacts.groups.title")}</h2>
        {selecting && shown.length > 0 && (
          <SelectBox
            label={t("contacts.selection.allGroups")}
            checked={ticked === shown.length}
            indeterminate={ticked > 0 && ticked < shown.length}
            onChange={(on) =>
              onPick(
                shown.map((group) => group.id),
                on,
              )
            }
          />
        )}
        {groups.length > 0 && (
          <SearchField
            label={t("contacts.groups.searchList")}
            value={search}
            onChange={onSearch}
          />
        )}
        {!adding && !selecting && (
          <IconButton
            icon="groupAdd"
            label={t("contacts.groups.new")}
            accent
            onClick={() => setAdding(true)}
          />
        )}
      </div>
      {action.error && <p className="error">{action.error}</p>}
      {groups.length === 0 && !adding && <p className="muted">{t("contacts.groups.empty")}</p>}
      {groups.length > 0 && shown.length === 0 && (
        <p className="muted">{t("contacts.groups.noMatch", { query: search.trim() })}</p>
      )}
      <ul className="cards">
        {shown.map((group) =>
          editing === group.id && !selecting ? (
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
            <li
              key={group.id}
              className={classes(
                "card",
                selecting && "pickable",
                selecting && selected.has(group.id) && "selected",
              )}
              onClick={tickOnClick({ selecting, selected, onPick }, group.id)}
            >
              <div className="row">
                <span>
                  <strong>{group.name}</strong>
                  <InviteModeIcon
                    mode={group.invite_mode}
                    label={t(`contacts.inviteModes.${group.invite_mode}`)}
                  />
                </span>
                <span className="card-actions">
                  {selecting ? (
                    <SelectBox
                      label={t("contacts.selection.select", { name: group.name })}
                      checked={selected.has(group.id)}
                      onChange={(on) => onPick([group.id], on)}
                    />
                  ) : (
                    <>
                      <IconButton
                        icon="edit"
                        label={t("common.edit")}
                        onClick={() => setEditing(group.id)}
                      />
                      <IconButton
                        icon="delete"
                        label={t("common.delete")}
                        danger
                        onClick={() => remove(group)}
                      />
                    </>
                  )}
                </span>
              </div>
              <p className="muted">
                {group.member_ids.length === 0
                  ? t("contacts.groups.noMembers")
                  : group.member_ids.map((id, i) => {
                      const member = names.get(id) ?? "";
                      // Found only through a member: that member stands out in the list.
                      const hit =
                        search.trim() !== "" &&
                        rank(search, group.name) === null &&
                        rank(search, member) !== null;
                      return (
                        <Fragment key={id}>
                          {i > 0 && ", "}
                          <span className={hit ? "hit" : undefined}>{member}</span>
                        </Fragment>
                      );
                    })}
              </p>
            </li>
          ),
        )}
      </ul>
      {adding && !selecting && (
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
  shown,
  names: groupNames,
  search,
  onSearch,
  selecting,
  selected,
  onPick,
  reload,
}: {
  contacts: Contact[];
  groups: Group[];
  /** The contacts the search finds, best first. */
  shown: Contact[];
  /** Group names by ID. */
  names: Map<string, string>;
  search: string;
  onSearch: (search: string) => void;
  reload: () => Promise<void>;
} & Picking) {
  const { t } = useTranslation();
  const action = useSave();
  const [editing, setEditing] = useState<string>(); // a contact's ID
  const [adding, setAdding] = useState(false);
  const ticked = shown.filter((contact) => selected.has(contact.id)).length;

  useEffect(() => {
    if (selecting) {
      setEditing(undefined);
      setAdding(false);
    }
  }, [selecting]);

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
      <div className="row heading-search">
        <h2>{t("contacts.list", { count: contacts.length })}</h2>
        {selecting && shown.length > 0 && (
          <SelectBox
            label={t("contacts.selection.allContacts")}
            checked={ticked === shown.length}
            indeterminate={ticked > 0 && ticked < shown.length}
            onChange={(on) =>
              onPick(
                shown.map((contact) => contact.id),
                on,
              )
            }
          />
        )}
        {contacts.length > 0 && (
          <SearchField label={t("contacts.searchHint")} value={search} onChange={onSearch} />
        )}
        {!adding && !selecting && (
          <IconButton
            icon="personAdd"
            label={t("contacts.new")}
            accent
            onClick={() => setAdding(true)}
          />
        )}
      </div>
      {action.error && <p className="error">{action.error}</p>}
      {contacts.length === 0 && !adding && <p className="muted">{t("contacts.empty")}</p>}
      {contacts.length > 0 && shown.length === 0 && (
        <p className="muted">{t("contacts.noMatch", { query: search.trim() })}</p>
      )}
      {shown.length > 0 && (
        <ul className="card rows">
          {shown.map((contact) =>
            editing === contact.id && !selecting ? (
              <li key={contact.id}>
                <ContactForm
                  contact={contact}
                  contacts={contacts}
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
              <li
                key={contact.id}
                className={classes(
                  "item-row",
                  selecting && "pickable",
                  selecting && selected.has(contact.id) && "selected",
                )}
                onClick={tickOnClick({ selecting, selected, onPick }, contact.id)}
              >
                <span>
                  <strong>{contact.name}</strong>
                  {contact.birth_year && <span className="muted">{contact.birth_year}</span>}
                  {contact.group_ids.map((id) => (
                    <span
                      key={id}
                      className={
                        // Found only through this group: it stands out.
                        search.trim() !== "" &&
                        rank(search, contact.name) === null &&
                        rank(search, groupNames.get(id) ?? "") !== null
                          ? "badge hit"
                          : "badge"
                      }
                    >
                      {groupNames.get(id)}
                    </span>
                  ))}
                </span>
                <span className="card-actions">
                  {selecting ? (
                    <SelectBox
                      label={t("contacts.selection.select", { name: contact.name })}
                      checked={selected.has(contact.id)}
                      onChange={(on) => onPick([contact.id], on)}
                    />
                  ) : (
                    <>
                      <IconButton
                        icon="edit"
                        label={t("common.edit")}
                        onClick={() => setEditing(contact.id)}
                      />
                      <IconButton
                        icon="delete"
                        label={t("common.delete")}
                        danger
                        onClick={() => remove(contact)}
                      />
                    </>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {adding && !selecting && (
        <div className="card">
          <ContactForm
            contacts={contacts}
            groups={groups}
            onSubmit={async (body) => {
              await unwrap(api.POST("/api/admin/contacts", { body }));
              await reload();
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </>
  );
}

function ContactForm({
  contact,
  contacts,
  groups,
  onSubmit,
  onCancel,
}: {
  contact?: Contact;
  /** All contacts: no two share a name. */
  contacts: Contact[];
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
  const key = name.trim().toLocaleLowerCase();
  const taken =
    key !== "" &&
    contacts.some((other) => other.id !== contact?.id && other.name.toLocaleLowerCase() === key);

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
          {taken && <span className="hint missing">{t("contacts.nameTaken")}</span>}
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
      <SaveBar save={save} onCancel={onCancel} disabled={taken} />
    </form>
  );
}

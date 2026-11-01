import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, api, type Schemas, unwrap } from "../../api/client";
import { EventWhenWhere } from "../../components/EventWhenWhere";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { formatDateTime } from "../../i18n/text";
import { SaveBar, useSave } from "../admin/forms";

type Signup = Schemas["GuestSignupOut"];
type Row = { key: number; name: string };

/** Who signed up with this open link on this device, so a second visit leads back to their own
 * link instead of signing up twice. Storage can be blocked; then there's nothing to lead back to. */
const stored = (token: string) => `signup:${token}`;

function signedUp(token: string): { token: string; name: string } | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(stored(token)) ?? "null");
    return typeof value?.token === "string" && typeof value?.name === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The event's open link: everyone with it signs up themselves and whoever comes with them, then
 * answers on their own personal page (D36). */
export function SignupPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const params = { header: { "X-Signup-Token": token } };
  const signup = useLoad(() => unwrap(api.GET("/api/guest/signup", { params })), [token]);

  async function signUp(names: string[]) {
    const created = await unwrap(
      api.POST("/api/guest/signup", { params, body: { persons: names.map((name) => ({ name })) } }),
    );
    try {
      localStorage.setItem(stored(token), JSON.stringify({ token: created.token, name: names[0] }));
    } catch {
      // Not remembered then; the personal page itself says to keep its link.
    }
    window.location.assign(`/i/${created.token}`);
  }

  return (
    <Layout>
      {signup.error instanceof ApiError && signup.error.status === 404 ? (
        <p className="error">{t("guest.signup.gone")}</p>
      ) : (
        <Loaded {...signup}>
          {(data) => <SignupForm signup={data} earlier={signedUp(token)} onSignUp={signUp} />}
        </Loaded>
      )}
    </Layout>
  );
}

function SignupForm({
  signup,
  earlier,
  onSignUp,
}: {
  signup: Signup;
  earlier?: { token: string; name: string };
  onSignUp: (names: string[]) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { event } = signup;
  const save = useSave();
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: "" }]);
  const [focus, setFocus] = useState<number>();
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const names = rows.map((row) => row.name.trim()).filter(Boolean);

  useEffect(() => {
    if (focus !== undefined) inputs.current.get(focus)?.focus();
  }, [focus]);

  /** There's always one empty row at the end: typing into it adds the next one. */
  function withFreeRow(all: Row[]): Row[] {
    return all.at(-1)?.name ? [...all, { key: nextKey.current++, name: "" }] : all;
  }

  function change(key: number, name: string) {
    setRows((all) => withFreeRow(all.map((row) => (row.key === key ? { key, name } : row))));
  }

  function remove(key: number, byKeyboard: boolean) {
    const index = rows.findIndex((row) => row.key === key);
    const neighbour = rows[index - 1] ?? rows[index + 1];
    setRows((all) => withFreeRow(all.filter((row) => row.key !== key)));
    if (neighbour && byKeyboard) setFocus(neighbour.key);
  }

  /** Enter signs up, as in any one-field form: most people only type their own name. */
  function keyDown(row: Row, index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !row.name && index < rows.length - 1) {
      e.preventDefault();
      remove(row.key, true);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save.run(() => onSignUp(names));
  }

  return (
    <>
      <h1>{event.title}</h1>
      <EventWhenWhere event={event} />
      {event.description && <p className="prose">{event.description}</p>}

      <h2>{t("guest.signup.title")}</h2>
      {earlier && (
        <p className="notice">
          {t("guest.signup.earlier", { name: earlier.name })}{" "}
          <a href={`/i/${earlier.token}`}>{t("guest.signup.toEarlier")}</a>
        </p>
      )}
      <p className="muted">
        {event.answers_open
          ? t("guest.signup.until", { date: formatDateTime(event.answers_close_at, i18n.language) })
          : t("guest.signup.closed")}
      </p>

      {event.answers_open && (
        <form onSubmit={submit} onChange={save.reset} className="card">
          <fieldset className="field plain" disabled={save.status === "saving"}>
            <legend>{t("guest.signup.persons")}</legend>
            <ul className="name-rows">
              {rows.map((row, i) => (
                <li key={row.key}>
                  <span className="name-input">
                    <input
                      type="text"
                      ref={(el) => {
                        if (el) inputs.current.set(row.key, el);
                        else inputs.current.delete(row.key);
                      }}
                      aria-label={t("guest.signup.personNumber", { number: i + 1 })}
                      placeholder={t(i === 0 ? "guest.signup.yourName" : "guest.signup.another")}
                      autoComplete={i === 0 ? "name" : "off"}
                      maxLength={200}
                      value={row.name}
                      required={i === 0 && names.length === 0}
                      onChange={(e) => change(row.key, e.target.value)}
                      onKeyDown={(e) => keyDown(row, i, e)}
                    />
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
            <span className="hint">{t("guest.signup.personsHint")}</span>
            {names.length > 10 && <span className="error">{t("guest.signup.tooMany")}</span>}
          </fieldset>
          <SaveBar
            save={save}
            label={t("guest.signup.submit")}
            disabled={names.length === 0 || names.length > 10}
          />
        </form>
      )}
    </>
  );
}

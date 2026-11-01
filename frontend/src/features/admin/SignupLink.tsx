import { useTranslation } from "react-i18next";

import { api, type Schemas, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { CopyFailed, LinkButtons, useCopyLink } from "../../components/LinkButtons";
import { IconButton, useSave } from "./forms";

type Event = Schemas["EventOut"];

/** The event's open link, once the host turned it on: one link for a group chat, everyone
 * signs up themselves (D36). Above the invites, where the sign-ups appear. */
export function SignupLink({
  event,
  token,
  onChange,
}: {
  event: Event;
  /** The event's `signup_token`. */
  token: string;
  onChange: (event: Event) => void;
}) {
  const { t } = useTranslation();
  const copy = useCopyLink(`${window.location.origin}/r/${token}`);
  const action = useSave();
  const params = { path: { event_id: event.id } };

  function change(confirmText: string, method: "PUT" | "DELETE") {
    if (!window.confirm(confirmText)) return;
    void action.run(async () => {
      const url = "/api/admin/events/{event_id}/signup";
      const request = method === "PUT" ? api.PUT(url, { params }) : api.DELETE(url, { params });
      onChange(await unwrap(request));
    });
  }

  return (
    <div className="card">
      <div className="row">
        <span className="invite-title">
          <span className="signup-mark">
            <Icon name="link" />
          </span>
          <strong>{t("admin.event.signup.title")}</strong>
        </span>
        <span className="card-actions">
          <LinkButtons copy={copy} />
          <IconButton
            icon="replace"
            label={t("admin.event.signup.replace")}
            disabled={action.status === "saving"}
            onClick={() => change(t("admin.event.signup.confirmReplace"), "PUT")}
          />
          <IconButton
            icon="delete"
            label={t("admin.event.signup.close")}
            danger
            disabled={action.status === "saving"}
            onClick={() => change(t("admin.event.signup.confirmClose"), "DELETE")}
          />
        </span>
      </div>
      <p className="muted">{t("admin.event.signup.hint")}</p>
      <CopyFailed copy={copy} />
      {action.error && <p className="error">{action.error}</p>}
    </div>
  );
}

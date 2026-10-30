import { useTranslation } from "react-i18next";

import { api, unwrap } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Layout, Loaded } from "../../components/Layout";
import { useLoad } from "../../components/useLoad";
import { Invitation } from "../guest/GuestPage";

/** The invitation as guests see it, for one made-up guest without answers. Everything can be
 * tried out; nothing is saved. */
export function EventPreview({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const params = { path: { event_id: eventId } };
  const preview = useLoad(
    () => unwrap(api.GET("/api/admin/events/{event_id}/preview", { params })),
    [eventId],
  );

  return (
    <Layout admin>
      <div className="row-start">
        <a
          className="icon back"
          href={`/admin/events/${eventId}`}
          aria-label={t("admin.setup.back")}
          title={t("admin.setup.back")}
        >
          <Icon name="back" />
        </a>
        <span className="muted">{t("admin.preview.title")}</span>
      </div>
      <Loaded {...preview}>
        {(data) => (
          <Invitation
            invite={{
              name: t("admin.preview.guest"),
              comment: null,
              event: data.event,
              guest_list: data.guest_list,
              persons: [
                {
                  id: "preview",
                  name: t("admin.preview.guest"),
                  attendance: "pending",
                  attendance_public: false,
                  attendance_changed_at: null,
                  answers: [],
                },
              ],
            }}
            onSave={async () => {}}
            preview
          />
        )}
      </Loaded>
    </Layout>
  );
}

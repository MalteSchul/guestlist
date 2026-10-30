import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "../../components/Icon";
import { Layout } from "../../components/Layout";
import { chooseLanguage, type Language, LANGUAGES, useLanguageChoice } from "../../i18n";
import { chooseTheme, type ThemeChoice, useThemeChoice } from "../../theme";

const THEME_CHOICES: ThemeChoice[] = ["light", "dark", "system"];

/** Each language in its own words, so it can be found whatever the page is in. */
const LANGUAGE_NAMES: Record<Language, string> = { de: "Deutsch", en: "English" };

/** For hosts and guests alike, so it asks for no login: theme, language and which build runs.
 * Behind the host's gear (`admin`) it has the host's header, with the way back to the events. */
export function Settings({ admin = false }: { admin?: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useThemeChoice();
  const language = useLanguageChoice();
  const built = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(__BUILT_AT__));

  // Back to wherever the gear was, a guest's page too; the overview if the page was opened on
  // its own.
  function back(e: MouseEvent) {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  }

  return (
    <Layout admin={admin} settings={false}>
      <div className="row title-row">
        <h1>{t("settings.title")}</h1>
        <span className="heading-actions">
          <a
            className="icon"
            href="/"
            onClick={back}
            aria-label={t("settings.back")}
            title={t("settings.back")}
          >
            <Icon name="back" />
          </a>
        </span>
      </div>

      <section className="card">
        <fieldset className="field plain">
          <legend>{t("settings.theme")}</legend>
          <div className="choices">
            {THEME_CHOICES.map((choice) => (
              <label key={choice} className="choice">
                <input
                  type="radio"
                  name="theme"
                  checked={theme === choice}
                  onChange={() => chooseTheme(choice)}
                />
                <Icon name={choice} />
                {t(`settings.themes.${choice}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field plain">
          <legend>{t("settings.language")}</legend>
          <div className="choices">
            {LANGUAGES.map((choice) => (
              <label key={choice} className="choice" lang={choice}>
                <input
                  type="radio"
                  name="language"
                  checked={language === choice}
                  onChange={() => chooseLanguage(choice)}
                />
                {LANGUAGE_NAMES[choice]}
              </label>
            ))}
            <label className="choice">
              <input
                type="radio"
                name="language"
                checked={language === "system"}
                onChange={() => chooseLanguage("system")}
              />
              {t("settings.languageSystem")}
            </label>
          </div>
        </fieldset>
      </section>

      <section className="card">
        <dl className="facts">
          <dt>{t("settings.version")}</dt>
          <dd>
            {__GIT_SHA__ ? (
              <code title={__GIT_SHA__}>{__GIT_SHA__.slice(0, 7)}</code>
            ) : (
              <span className="muted">{t("settings.unknown")}</span>
            )}
            {import.meta.env.DEV && <span className="muted"> · {t("settings.dev")}</span>}
          </dd>
          <dt>{t("settings.built")}</dt>
          <dd>{built}</dd>
        </dl>
      </section>
    </Layout>
  );
}

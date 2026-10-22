import { useMemo, useState } from "react";
import { CharacterSlot } from "./components/CharacterSlot";
import { Timeline } from "./components/Timeline";
import { generateConfig } from "./config";
import { LANGS, useI18n, type Lang } from "./i18n";
import { useAppState, type CharConfig } from "./state";

export function App() {
  const { t, lang, setLang } = useI18n();
  const [state, dispatch] = useAppState();
  const [copied, setCopied] = useState(false);
  const config = useMemo(() => generateConfig(state), [state]);
  const team = state.team.filter((c): c is CharConfig => !!c);
  const taken = team.map((c) => c.key);

  const copy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([config], { type: "text/plain" }));
    a.download = "config.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="app">
      <header>
        <h1>{t("title")}</h1>
        <div className="header-actions">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={() => confirm(t("resetConfirm")) && dispatch({ type: "reset" })}>
            {t("reset")}
          </button>
        </div>
      </header>

      <main>
        <section>
          <h2>{t("team")}</h2>
          <div className="team">
            {state.team.map((c, i) => (
              <CharacterSlot key={i} slot={i} char={c} taken={taken} dispatch={dispatch} />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>{t("rotation")}</h2>
            <span className="muted">{t("dragHint")}</span>
            <label className="check">
              <input
                type="checkbox"
                checked={state.settings.loop}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { loop: e.target.checked } })}
              />
              {t("loop")}
            </label>
          </div>
          <Timeline team={team} rotation={state.rotation} dispatch={dispatch} />
        </section>

        <section>
          <div className="section-head">
            <h2>{t("config")}</h2>
            <label className="check">
              {t("iterations")}
              <input
                type="number"
                min={1}
                value={state.settings.iterations}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { iterations: Math.max(1, +e.target.value) } })}
              />
            </label>
            <label className="check">
              {t("duration")}
              <input
                type="number"
                min={1}
                value={state.settings.duration}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { duration: Math.max(1, +e.target.value) } })}
              />
            </label>
            <div className="spacer" />
            <button onClick={copy}>{copied ? t("copied") : t("copy")}</button>
            <button onClick={download}>{t("download")}</button>
          </div>
          <pre className="output">{config}</pre>
        </section>
      </main>
    </div>
  );
}

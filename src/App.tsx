import { useMemo, useState } from "react";
import { CharacterSlot } from "./components/CharacterSlot";
import { Timeline } from "./components/Timeline";
import { generateConfig } from "./config";
import { useAppState, type CharConfig } from "./state";

export function App() {
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
        <h1>gcsim config editor</h1>
        <button
          className="ghost"
          onClick={() => confirm("Clear team and rotation?") && dispatch({ type: "reset" })}
        >
          Reset
        </button>
      </header>

      <main>
        <section>
          <h2>Team</h2>
          <div className="team">
            {state.team.map((c, i) => (
              <CharacterSlot key={i} slot={i} char={c} taken={taken} dispatch={dispatch} />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Rotation</h2>
            <span className="muted">Drag cards to reorder</span>
            <label className="check">
              <input
                type="checkbox"
                checked={state.settings.loop}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { loop: e.target.checked } })}
              />
              Loop (while 1)
            </label>
          </div>
          <Timeline team={team} rotation={state.rotation} dispatch={dispatch} />
        </section>

        <section>
          <div className="section-head">
            <h2>Config</h2>
            <label className="check">
              Iterations
              <input
                type="number"
                min={1}
                value={state.settings.iterations}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { iterations: Math.max(1, +e.target.value) } })}
              />
            </label>
            <label className="check">
              Duration, s
              <input
                type="number"
                min={1}
                value={state.settings.duration}
                onChange={(e) => dispatch({ type: "updateSettings", patch: { duration: Math.max(1, +e.target.value) } })}
              />
            </label>
            <div className="spacer" />
            <button onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
            <button onClick={download}>Download</button>
          </div>
          <pre className="output">{config}</pre>
        </section>
      </main>
    </div>
  );
}

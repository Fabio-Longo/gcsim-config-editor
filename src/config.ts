import { MAIN_VALUES, statByKey } from "./data";
import type { CharConfig, State } from "./state";

const fmt = (key: string, uiValue: number) => {
  const v = statByKey.get(key)?.pct ? uiValue / 100 : uiValue;
  return `${key}=${+v.toFixed(4)}`;
};

function charBlock(c: CharConfig): string[] {
  const k = c.key;
  const lines = [
    `${k} char lvl=${c.level}/${c.maxLevel} cons=${c.cons} talent=${c.talents.join(",")};`,
    `${k} add weapon="${c.weapon.key}" refine=${c.weapon.refine} lvl=${c.weapon.level}/${c.weapon.maxLevel};`,
  ];
  for (const s of c.sets) if (s.key) lines.push(`${k} add set="${s.key}" count=${s.count};`);

  const main: [string, number][] = [
    ["hp", MAIN_VALUES.hp],
    ["atk", MAIN_VALUES.atk],
  ];
  // Two pieces with the same main stat (e.g. atk% sands + atk% goblet) must be summed.
  for (const stat of [c.main.sands, c.main.goblet, c.main.circlet]) {
    const existing = main.find(([k2]) => k2 === stat);
    if (existing) existing[1] += MAIN_VALUES[stat];
    else main.push([stat, MAIN_VALUES[stat]]);
  }
  lines.push(`${k} add stats ${main.map(([s, v]) => fmt(s, v)).join(" ")}; #main`);

  const subs = Object.entries(c.subs).filter(([, v]) => v);
  if (subs.length) lines.push(`${k} add stats ${subs.map(([s, v]) => fmt(s, v)).join(" ")}; #subs`);
  return lines;
}

export function generateConfig(state: State): string {
  const team = state.team.filter((c): c is CharConfig => !!c);
  const out: string[] = [];
  for (const c of team) out.push(...charBlock(c), "");

  out.push(
    `options iteration=${state.settings.iterations} duration=${state.settings.duration} swap_delay=12;`,
    "target lvl=100 resist=0.1;",
    "energy every interval=480,720 amount=1;",
    "",
  );

  const rot = state.rotation;
  const active = rot.find((r) => r.char)?.char ?? team[0]?.key;
  if (active) out.push(`active ${active};`, "");

  const actionLines = rot.map((r) =>
    r.action === "wait"
      ? `wait(${Math.round((r.seconds ?? 1) * 60)}); # ${r.seconds ?? 1}s` // gcsim waits in frames (60/s)
      : `${r.char} ${r.action}${r.count > 1 ? `:${r.count}` : ""};`,
  );
  if (state.settings.loop && actionLines.length) {
    out.push("while 1 {", ...actionLines.map((l) => `  ${l}`), "}");
  } else {
    out.push(...actionLines);
  }
  return out.join("\n") + "\n";
}

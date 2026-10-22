import { CAN_SKIP, STATS, statByKey } from "./data";
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

  const stats = STATS.filter((s) => c.stats[s.key]).map((s) => fmt(s.key, c.stats[s.key]));
  if (stats.length) lines.push(`${k} add stats ${stats.join(" ")};`);
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
      : r.skipOnCooldown && CAN_SKIP.has(r.action)
        ? `if .${r.char}.${r.action}.ready { ${r.char} ${r.action}; }`
        : `${r.char} ${r.action}${r.count > 1 ? `:${r.count}` : ""};`,
  );
  if (state.settings.loop && actionLines.length) {
    out.push("while 1 {", ...actionLines.map((l) => `  ${l}`), "}");
  } else {
    out.push(...actionLines);
  }
  return out.join("\n") + "\n";
}

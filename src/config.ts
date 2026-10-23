import { CAN_SKIP, STATS, statByKey } from "./data";
import { containersOf, FPS, secondsToFrames, type ActionNode, type RNode } from "./rotation";
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

  const active = firstChar(state.rotation) ?? team[0]?.key;
  if (active) out.push(`active ${active};`, "");

  const body = nodeLines(state.rotation);
  if (state.settings.loop && body.length) out.push("while 1 {", ...indent(body), "}");
  else out.push(...body);
  return out.join("\n") + "\n";
}

const indent = (lines: string[]) => lines.map((l) => `  ${l}`);

// Opening line of a while/if/else-if. An empty condition would be a syntax error;
// "0" keeps the config valid and the block inert.
const head = (keyword: string, cond: string) =>
  cond.trim() ? `${keyword} ${cond.trim()} {` : `${keyword} 0 { # TODO: condition`;

function actionLine(r: ActionNode): string {
  if (r.action === "wait") {
    const frames = secondsToFrames(r.seconds);
    return `wait(${frames}); # ${+(frames / FPS).toFixed(3)}s`;
  }
  if (r.skipOnCooldown && CAN_SKIP.has(r.action)) return `if .${r.char}.${r.action}.ready { ${r.char} ${r.action}; }`;
  return `${r.char} ${r.action}${r.count > 1 ? `:${r.count}` : ""};`;
}

function nodeLines(nodes: RNode[]): string[] {
  return nodes.flatMap((n): string[] => {
    switch (n.kind) {
      case "action":
        return [actionLine(n)];
      case "group":
        // gcsim has no plain blocks; a group only groups cards in the editor.
        return nodeLines(n.children);
      case "while":
        return [head("while", n.cond), ...indent(nodeLines(n.children)), "}"];
      case "if": {
        const lines = n.branches.flatMap((b, i) => [
          head(i ? "} else if" : "if", b.cond),
          ...indent(nodeLines(b.children)),
        ]);
        if (n.elseBranch) lines.push("} else {", ...indent(nodeLines(n.elseBranch.children)));
        return [...lines, "}"];
      }
    }
  });
}

/** First character used by an action, depth-first: gcsim needs it as the active character. */
function firstChar(nodes: RNode[]): string | undefined {
  for (const n of nodes) {
    if (n.kind === "action" && n.char) return n.char;
    for (const [, list] of containersOf(n)) {
      const c = firstChar(list);
      if (c) return c;
    }
  }
}

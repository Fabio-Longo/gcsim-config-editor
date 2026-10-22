import { useEffect, useReducer } from "react";
import { charByKey, MAIN_VALUES, weapons, type CharInfo } from "./data";
import {
  duplicateNode, findContainer, insertNode, mapIf, migrateRotation, moveNode, removeChar, removeNode, uid, updateNode,
  type IfNode, type RNode,
} from "./rotation";

export interface SetChoice {
  key: string;
  count: 2 | 4;
}

export interface CharConfig {
  key: string;
  cons: number;
  level: number;
  maxLevel: number;
  talents: [number, number, number];
  weapon: { key: string; refine: number; level: number; maxLevel: number };
  sets: SetChoice[];
  /** Total bonuses from all 5 artifacts (main + sub stats), in UI units (percent for pct stats). */
  stats: Record<string, number>;
}

export interface Settings {
  iterations: number;
  duration: number;
  loop: boolean;
}

export interface State {
  team: (CharConfig | null)[];
  rotation: RNode[];
  settings: Settings;
}

export type Action =
  | { type: "setChar"; slot: number; key: string | null }
  | { type: "updateChar"; slot: number; patch: Partial<CharConfig> }
  | { type: "addNode"; containerId: string; node: RNode }
  | { type: "updateNode"; id: string; patch: Partial<RNode> }
  | { type: "removeNode"; id: string }
  | { type: "duplicateNode"; id: string }
  | { type: "moveNode"; id: string; containerId: string; index: number }
  | { type: "addBranch"; ifId: string; branch: "elif" | "else" }
  | { type: "removeBranch"; ifId: string; branchId: string }
  | { type: "setBranchCond"; ifId: string; branchId: string; cond: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "reset" };

const initial: State = {
  team: [null, null, null, null],
  rotation: [],
  settings: { iterations: 1000, duration: 90, loop: true },
};

const defaultSubs = { cr: 31.1, cd: 62.2, "atk%": 19.8, er: 11.0, em: 39.6 };

/** Sums flower/plume + three main stats + substats into one stat map. */
function totalStats(mains: string[], subs: Record<string, number>): Record<string, number> {
  const stats: Record<string, number> = { ...subs };
  for (const s of ["hp", "atk", ...mains]) stats[s] = Math.round(((stats[s] ?? 0) + MAIN_VALUES[s]) * 10) / 10;
  return stats;
}

export function newCharConfig(info: CharInfo): CharConfig {
  const weapon = weapons.find((w) => w.type === info.weapon)!;
  return {
    key: info.key,
    cons: 0,
    level: 90,
    maxLevel: 90,
    talents: [9, 9, 9],
    weapon: { key: weapon.key, refine: 1, level: 90, maxLevel: 90 },
    sets: [],
    // Typical starting point: ATK% sands, elemental goblet, crit circlet.
    stats: totalStats(["atk%", info.element === "none" ? "phys%" : `${info.element}%`, "cr"], defaultSubs),
  };
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "setChar": {
      const old = state.team[a.slot];
      const team = [...state.team];
      const info = a.key ? charByKey.get(a.key) : undefined;
      team[a.slot] = info ? newCharConfig(info) : null;
      // Drop rotation entries of the character that left the team.
      const rotation = old ? removeChar(state.rotation, old.key) : state.rotation;
      return { ...state, team, rotation };
    }
    case "updateChar": {
      const team = [...state.team];
      team[a.slot] = { ...team[a.slot]!, ...a.patch };
      return { ...state, team };
    }
    case "addNode": {
      // New nodes go to the end of their container.
      const end = findContainer(state.rotation, a.containerId)?.length ?? 0;
      return { ...state, rotation: insertNode(state.rotation, a.containerId, end, a.node) };
    }
    case "updateNode":
      return { ...state, rotation: updateNode(state.rotation, a.id, a.patch) };
    case "removeNode":
      return { ...state, rotation: removeNode(state.rotation, a.id) };
    case "duplicateNode":
      return { ...state, rotation: duplicateNode(state.rotation, a.id) };
    case "moveNode":
      return { ...state, rotation: moveNode(state.rotation, a.id, a.containerId, a.index) };
    case "addBranch":
      return {
        ...state,
        rotation: mapIf(state.rotation, a.ifId, (n) =>
          a.branch === "else"
            ? { ...n, elseBranch: n.elseBranch ?? { id: uid(), cond: "", children: [] } }
            : { ...n, branches: [...n.branches, { id: uid(), cond: "", children: [] }] },
        ),
      };
    case "removeBranch":
      return {
        ...state,
        rotation: mapIf(state.rotation, a.ifId, (n): IfNode =>
          n.elseBranch?.id === a.branchId
            ? { ...n, elseBranch: undefined }
            : { ...n, branches: n.branches.filter((b) => b.id !== a.branchId) },
        ),
      };
    case "setBranchCond":
      return {
        ...state,
        rotation: mapIf(state.rotation, a.ifId, (n) => ({
          ...n,
          branches: n.branches.map((b) => (b.id === a.branchId ? { ...b, cond: a.cond } : b)),
        })),
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case "reset":
      return initial;
  }
}

const STORAGE_KEY = "gcsim-editor-state";

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Older saves kept main stats per piece and substats separately; fold them into one total.
      saved.team = saved.team?.map((c: (CharConfig & { main?: Record<string, string>; subs?: Record<string, number> }) | null) =>
        c && !c.stats && c.main ? { ...c, stats: totalStats(Object.values(c.main), c.subs ?? {}) } : c,
      );
      return { ...initial, ...saved, rotation: migrateRotation(saved.rotation) };
    }
  } catch {}
  return initial;
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);
  return [state, dispatch] as const;
}


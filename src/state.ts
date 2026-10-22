import { useEffect, useReducer } from "react";
import { charByKey, weapons, type CharInfo } from "./data";

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
  main: { sands: string; goblet: string; circlet: string };
  /** Substat totals in UI units (percent for pct stats). */
  subs: Record<string, number>;
}

export interface RotationAction {
  id: string;
  /** Empty for "wait", which belongs to no character. */
  char: string;
  action: string;
  count: number;
  /** Duration of a "wait" step. */
  seconds?: number;
}

export interface Settings {
  iterations: number;
  duration: number;
  loop: boolean;
}

export interface State {
  team: (CharConfig | null)[];
  rotation: RotationAction[];
  settings: Settings;
}

export type Action =
  | { type: "setChar"; slot: number; key: string | null }
  | { type: "updateChar"; slot: number; patch: Partial<CharConfig> }
  | { type: "addAction"; char: string; action: string; count: number; seconds?: number }
  | { type: "updateAction"; id: string; patch: Partial<RotationAction> }
  | { type: "removeAction"; id: string }
  | { type: "setRotation"; rotation: RotationAction[] }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "reset" };

const initial: State = {
  team: [null, null, null, null],
  rotation: [],
  settings: { iterations: 1000, duration: 90, loop: true },
};

const defaultSubs = { cr: 31.1, cd: 62.2, "atk%": 19.8, er: 11.0, em: 39.6 };

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
    main: {
      sands: "atk%",
      goblet: info.element === "none" ? "atk%" : `${info.element}%`,
      circlet: "cr",
    },
    subs: { ...defaultSubs },
  };
}

let nextId = Date.now();
const uid = () => (nextId++).toString(36);

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "setChar": {
      const old = state.team[a.slot];
      const team = [...state.team];
      const info = a.key ? charByKey.get(a.key) : undefined;
      team[a.slot] = info ? newCharConfig(info) : null;
      // Drop rotation entries of the character that left the team.
      const rotation = old ? state.rotation.filter((r) => r.char !== old.key) : state.rotation;
      return { ...state, team, rotation };
    }
    case "updateChar": {
      const team = [...state.team];
      team[a.slot] = { ...team[a.slot]!, ...a.patch };
      return { ...state, team };
    }
    case "addAction":
      return {
        ...state,
        rotation: [...state.rotation, { id: uid(), char: a.char, action: a.action, count: a.count, seconds: a.seconds }],
      };
    case "updateAction":
      return { ...state, rotation: state.rotation.map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) };
    case "removeAction":
      return { ...state, rotation: state.rotation.filter((r) => r.id !== a.id) };
    case "setRotation":
      return { ...state, rotation: a.rotation };
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
    if (raw) return { ...initial, ...JSON.parse(raw) };
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


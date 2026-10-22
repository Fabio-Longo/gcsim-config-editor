import gamedata from "./data/gamedata.json";

export type Element = "anemo" | "cryo" | "pyro" | "hydro" | "electro" | "geo" | "dendro" | "none";
export type WeaponType = "sword" | "claymore" | "polearm" | "bow" | "catalyst";

export interface CharInfo {
  key: string;
  name: string;
  rarity: number;
  element: Element;
  weapon: WeaponType;
  actions: string[];
  /** gcsim caveats per action, e.g. "Need to use attack right before charge." */
  notes: Record<string, string>;
}
export interface WeaponInfo {
  key: string;
  name: string;
  type: WeaponType;
}
export interface SetInfo {
  key: string;
  name: string;
}

export const characters = gamedata.characters as CharInfo[];
export const weapons = gamedata.weapons as WeaponInfo[];
export const sets = gamedata.sets as SetInfo[];

export const charByKey = new Map(characters.map((c) => [c.key, c]));
export const weaponByKey = new Map(weapons.map((w) => [w.key, w]));
export const setByKey = new Map(sets.map((s) => [s.key, s]));

export const img = {
  char: (key: string) => `/img/char/${key}.png`,
  weapon: (key: string) => `/img/weapon/${key}.png`,
  set: (key: string) => `/img/artifact/${key}.png`,
};

// gcsim stat keys. `pct` stats are entered in percent in the UI and written as fractions.
export const STATS: { key: string; label: string; pct: boolean }[] = [
  { key: "hp", label: "HP", pct: false },
  { key: "hp%", label: "HP%", pct: true },
  { key: "atk", label: "ATK", pct: false },
  { key: "atk%", label: "ATK%", pct: true },
  { key: "def", label: "DEF", pct: false },
  { key: "def%", label: "DEF%", pct: true },
  { key: "em", label: "Elemental Mastery", pct: false },
  { key: "er", label: "Energy Recharge", pct: true },
  { key: "cr", label: "Crit Rate", pct: true },
  { key: "cd", label: "Crit DMG", pct: true },
  { key: "heal", label: "Healing Bonus", pct: true },
  { key: "pyro%", label: "Pyro DMG", pct: true },
  { key: "hydro%", label: "Hydro DMG", pct: true },
  { key: "cryo%", label: "Cryo DMG", pct: true },
  { key: "electro%", label: "Electro DMG", pct: true },
  { key: "anemo%", label: "Anemo DMG", pct: true },
  { key: "geo%", label: "Geo DMG", pct: true },
  { key: "dendro%", label: "Dendro DMG", pct: true },
  { key: "phys%", label: "Physical DMG", pct: true },
];
export const statByKey = new Map(STATS.map((s) => [s.key, s]));

export const SUBSTATS = ["hp", "hp%", "atk", "atk%", "def", "def%", "em", "er", "cr", "cd"];

// 5* +20 main stat values (in UI units: percent for pct stats).
export const MAIN_VALUES: Record<string, number> = {
  hp: 4780, atk: 311, "hp%": 46.6, "atk%": 46.6, "def%": 58.3, em: 186.5, er: 51.8,
  cr: 31.1, cd: 62.2, heal: 35.9, "phys%": 58.3,
  "pyro%": 46.6, "hydro%": 46.6, "cryo%": 46.6, "electro%": 46.6, "anemo%": 46.6, "geo%": 46.6, "dendro%": 46.6,
};
const ELEM_DMG = ["pyro%", "hydro%", "cryo%", "electro%", "anemo%", "geo%", "dendro%", "phys%"];
export const MAIN_OPTIONS = {
  sands: ["atk%", "hp%", "def%", "em", "er"],
  goblet: ["atk%", "hp%", "def%", "em", ...ELEM_DMG],
  circlet: ["atk%", "hp%", "def%", "em", "cr", "cd", "heal"],
};

export const ACTION_LABELS: Record<string, string> = {
  attack: "Attack",
  charge: "Charged",
  aim: "Aim",
  high_plunge: "High Plunge",
  low_plunge: "Low Plunge",
  skill: "Skill (E)",
  burst: "Burst (Q)",
  dash: "Dash",
  jump: "Jump",
  walk: "Walk",
};
// Actions that can be repeated with gcsim's `action:N` syntax.
export const COUNTABLE = new Set(["attack", "charge", "aim"]);

export const MAX_LEVELS = [20, 40, 50, 60, 70, 80, 90, 100];

export const ELEMENT_COLORS: Record<Element, string> = {
  anemo: "#5fd3b0", cryo: "#9fd6e3", pyro: "#ef7a35", hydro: "#4cc2f1",
  electro: "#b08fe8", geo: "#f0b232", dendro: "#a5c83b", none: "#999",
};

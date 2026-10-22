import gamedata from "./data/gamedata.json";

export type Element = "anemo" | "cryo" | "pyro" | "hydro" | "electro" | "geo" | "dendro" | "none";
export type WeaponType = "sword" | "claymore" | "polearm" | "bow" | "catalyst";

/** English name in `name`; `names` holds it in every gcsim language (en, ru, zh, ja, ko, de, es). */
interface Named {
  key: string;
  name: string;
  names: Record<string, string>;
}

export interface CharInfo extends Named {
  rarity: number;
  element: Element;
  weapon: WeaponType;
  actions: string[];
  /** gcsim caveats per action, e.g. "Need to use attack right before charge." */
  notes: Record<string, string>;
}
export interface WeaponInfo extends Named {
  type: WeaponType;
}
export type SetInfo = Named;

/** Case-insensitive match against the key and the name in every language. */
export function matchesQuery(item: Named, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Ignore spaces/punctuation so "hutao" finds "Hu Tao" and "amos" finds "Amos' Bow".
  const compact = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");
  const cq = compact(q);
  if (!cq) return true;
  return (
    item.key.includes(cq) ||
    Object.values(item.names).some((n) => {
      const lower = n.toLowerCase();
      return lower.includes(q) || compact(lower).includes(cq);
    })
  );
}

export const characters = gamedata.characters as unknown as CharInfo[];
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
export const STATS: { key: string; pct: boolean }[] = [
  { key: "hp", pct: false },
  { key: "hp%", pct: true },
  { key: "atk", pct: false },
  { key: "atk%", pct: true },
  { key: "def", pct: false },
  { key: "def%", pct: true },
  { key: "em", pct: false },
  { key: "er", pct: true },
  { key: "cr", pct: true },
  { key: "cd", pct: true },
  { key: "heal", pct: true },
  { key: "pyro%", pct: true },
  { key: "hydro%", pct: true },
  { key: "cryo%", pct: true },
  { key: "electro%", pct: true },
  { key: "anemo%", pct: true },
  { key: "geo%", pct: true },
  { key: "dendro%", pct: true },
  { key: "phys%", pct: true },
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

// Actions that can be repeated with gcsim's `action:N` syntax.
export const COUNTABLE = new Set(["attack", "charge", "aim"]);

export const MAX_LEVELS = [20, 40, 50, 60, 70, 80, 90, 100];

export const ELEMENT_COLORS: Record<Element, string> = {
  anemo: "#5fd3b0", cryo: "#9fd6e3", pyro: "#ef7a35", hydro: "#4cc2f1",
  electro: "#b08fe8", geo: "#f0b232", dendro: "#a5c83b", none: "#999",
};

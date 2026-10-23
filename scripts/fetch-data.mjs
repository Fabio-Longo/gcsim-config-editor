// Pulls character/weapon/artifact data from the gcsim repo, names in every game language from
// Project Amber (gi.yatta.moe) and icons from Enka; writes src/data/gamedata.json and
// public/img/** (icons converted to WebP). Re-run to update after a game patch.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAW = "https://raw.githubusercontent.com/genshinsim/gcsim/main/ui/packages";
const ICON = (name) => `https://enka.network/ui/${name}.png`;
const ROOT = path.resolve(import.meta.dirname, "..");

const get = async (p) => {
  const r = await fetch(`${RAW}/${p}`);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
};

const [charDb, actions, names, charIcons, weaponIcons, artifactIcons] = await Promise.all([
  get("db/src/Data/character.dm.json"),
  get("docs/src/components/Actions/character.dm.json"),
  get("localization/src/locales/names.dm.json"),
  get("workers/src/assets/character.dm.json"),
  get("workers/src/assets/weapon.dm.json"),
  get("workers/src/assets/artifact.dm.json"),
]);
const en = names.English;

// Every text language of the game: our code → [Project Amber code, gcsim locale or null].
const LANGS = {
  en: ["en", "English"], ru: ["ru", "Russian"], "zh-CN": ["chs", "Chinese"], "zh-TW": ["cht", null],
  ja: ["jp", "Japanese"], ko: ["kr", "Korean"], de: ["de", "German"], es: ["es", "Spanish"],
  fr: ["fr", null], pt: ["pt", null], it: ["it", null], tr: ["tr", null], id: ["id", null], th: ["th", null], vi: ["vi", null],
};

// Amber lists keyed by icon name (characters, weapons) or set id (artifacts), per language.
const AMBER = "https://gi.yatta.moe/api/v2";
const amber = {};
await Promise.all(
  Object.entries(LANGS).map(async ([code, [amberCode]]) => {
    const list = async (kind) => {
      const r = await fetch(`${AMBER}/${amberCode}/${kind}`);
      if (!r.ok) throw new Error(`amber ${amberCode}/${kind}: ${r.status}`);
      return Object.values((await r.json()).data.items);
    };
    const [avatars, weaponList, relics] = await Promise.all([list("avatar"), list("weapon"), list("reliquary")]);
    amber[code] = {
      character: new Map(avatars.filter((a) => !/Player/.test(a.icon)).map((a) => [a.icon, a.name])),
      weapon: new Map(weaponList.map((w) => [w.icon, w.name])),
      artifact: new Map(relics.map((r) => [String(r.id), r.name])),
    };
  }),
);

// The Traveler is just "Traveler" in Amber; build "Aether (Anemo)" from parts instead.
const TRAVELER = { "zh-TW": { aether: "空", lumine: "熒" } };
const ELEMENT_NAMES = {
  "zh-TW": { anemo: "風", cryo: "冰", pyro: "火", hydro: "水", electro: "雷", geo: "岩", dendro: "草" },
  fr: { anemo: "Anémo", electro: "Électro", geo: "Géo" },
  it: { hydro: "Idro", electro: "Elettro" },
  tr: { cryo: "Kriyo", pyro: "Piro", hydro: "Hidro", electro: "Elektro" },
  vi: { anemo: "Phong", cryo: "Băng", pyro: "Hỏa", hydro: "Thủy", electro: "Lôi", geo: "Nham", dendro: "Thảo" },
};
const capital = (s) => s[0].toUpperCase() + s.slice(1);
function travelerName(code, key) {
  const [, who, element] = key.match(/^(aether|lumine)(\w+)$/);
  const gcsim = LANGS[code][1];
  if (gcsim) return names[gcsim]?.character_names?.[key];
  const person = TRAVELER[code]?.[who] ?? capital(who);
  return `${person} (${ELEMENT_NAMES[code]?.[element] ?? capital(element)})`;
}

/** Name in every game language: Amber's official name, else gcsim's, else English. */
const allNames = (group, key, amberKey) =>
  Object.fromEntries(
    Object.entries(LANGS).map(([code, [, gcsim]]) => {
      const fromAmber = amberKey && amber[code][group.replace("_names", "")].get(amberKey);
      const fromGcsim = gcsim && names[gcsim]?.[group]?.[key];
      const traveler = group === "character_names" && /^(aether|lumine)/.test(key) ? travelerName(code, key) : null;
      return [code, traveler ?? fromAmber ?? fromGcsim ?? en[group][key]];
    }),
  );
const missing = { character: 0, weapon: 0, artifact: 0 };
const amberHas = (group, amberKey) => amber.en[group].has(amberKey) || (missing[group]++, false);

const ELEMENTS = { Wind: "anemo", Ice: "cryo", Fire: "pyro", Water: "hydro", Electric: "electro", Rock: "geo", Grass: "dendro" };
const WEAPON_CLASS = {
  WEAPON_SWORD_ONE_HAND: "sword",
  WEAPON_CLAYMORE: "claymore",
  WEAPON_POLE: "polearm",
  WEAPON_BOW: "bow",
  WEAPON_CATALYST: "catalyst",
};
const ICON_WEAPON_CLASS = { Sword: "sword", Claymore: "claymore", Pole: "polearm", Bow: "bow", Catalyst: "catalyst" };

const downloads = []; // [url, file]

const characters = [];
for (const [key, c] of Object.entries(charDb.data)) {
  const icon = charIcons[key] ?? c.icon_name;
  if (!icon || !en.character_names[key]) continue;
  const valid = (actions[key] ?? []).filter((a) => !a.invalid && a.ability !== "swap");
  const acts = valid.map((a) => a.ability);
  const notes = Object.fromEntries(valid.filter((a) => a.note).map((a) => [a.ability, a.note]));
  characters.push({
    key,
    name: en.character_names[key],
    names: allNames("character_names", key, /^(aether|lumine)/.test(key) || amberHas("character", icon) ? icon : null),
    rarity: c.rarity === "QUALITY_ORANGE" ? 5 : 4,
    element: ELEMENTS[c.element] ?? "none",
    weapon: WEAPON_CLASS[c.weapon_class] ?? "sword",
    actions: acts.length ? acts : ["attack", "charge", "skill", "burst", "dash", "jump", "walk"],
    notes,
  });
  downloads.push([ICON(icon), `char/${key}.webp`]);
}

const weapons = [];
for (const [key, icon] of Object.entries(weaponIcons)) {
  if (!en.weapon_names[key]) continue;
  const cls = ICON_WEAPON_CLASS[icon.split("_")[2]];
  if (!cls) continue;
  // gcsim uses the ascended ("_Awaken") icon; Amber lists the base one.
  const base = icon.replace(/_Awaken$/, "");
  weapons.push({ key, name: en.weapon_names[key], names: allNames("weapon_names", key, amberHas("weapon", base) ? base : null), type: cls });
  downloads.push([ICON(icon), `weapon/${key}.webp`]);
}

const sets = [];
for (const key of Object.keys(en.artifact_names)) {
  const icon = ["flower", "plume", "sands", "goblet", "circlet"].map((s) => artifactIcons[`${key}_${s}`]).find(Boolean);
  if (!icon) continue;
  const setId = icon.match(/^UI_RelicIcon_(\d+)_/)?.[1];
  sets.push({ key, name: en.artifact_names[key], names: allNames("artifact_names", key, setId && amberHas("artifact", setId) ? setId : null) });
  downloads.push([ICON(icon), `artifact/${key}.webp`]);
}

const byName = (a, b) => a.name.localeCompare(b.name);
await fs.mkdir(path.join(ROOT, "src/data"), { recursive: true });
await fs.writeFile(
  path.join(ROOT, "src/data/gamedata.json"),
  JSON.stringify({ characters: characters.sort(byName), weapons: weapons.sort(byName), sets: sets.sort(byName) }),
);
console.log(`data: ${characters.length} characters, ${weapons.length} weapons, ${sets.length} sets`);
console.log(`not on Amber (gcsim/English names used):`, missing);

// Icons: skip ones already on disk, 8 parallel downloads.
let done = 0, failed = 0;
const queue = [...downloads];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let job; (job = queue.shift()); ) {
      const [url, rel] = job;
      const file = path.join(ROOT, "public/img", rel);
      try {
        await fs.access(file);
        continue;
      } catch {}
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(r.status);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await sharp(Buffer.from(await r.arrayBuffer())).webp({ quality: 85 }).toFile(file);
        done++;
      } catch (e) {
        failed++;
        console.warn(`icon failed: ${rel} (${url}): ${e.message}`);
      }
    }
  }),
);
console.log(`icons: ${done} downloaded, ${failed} failed`);

// Pulls character/weapon/artifact data from the gcsim repo and icons from Enka,
// writes src/data/gamedata.json and public/img/**. Re-run to update after a game patch.
import fs from "node:fs/promises";
import path from "node:path";

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
const LANGS = { en: "English", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean", de: "German", es: "Spanish" };
// Names in every language gcsim ships: UI shows en/ru, search matches all of them.
const allNames = (group, key) =>
  Object.fromEntries(Object.entries(LANGS).map(([code, lang]) => [code, names[lang]?.[group]?.[key] ?? en[group][key]]));

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
    names: allNames("character_names", key),
    rarity: c.rarity === "QUALITY_ORANGE" ? 5 : 4,
    element: ELEMENTS[c.element] ?? "none",
    weapon: WEAPON_CLASS[c.weapon_class] ?? "sword",
    actions: acts.length ? acts : ["attack", "charge", "skill", "burst", "dash", "jump", "walk"],
    notes,
  });
  downloads.push([ICON(icon), `char/${key}.png`]);
}

const weapons = [];
for (const [key, icon] of Object.entries(weaponIcons)) {
  if (!en.weapon_names[key]) continue;
  const cls = ICON_WEAPON_CLASS[icon.split("_")[2]];
  if (!cls) continue;
  weapons.push({ key, name: en.weapon_names[key], names: allNames("weapon_names", key), type: cls });
  downloads.push([ICON(icon), `weapon/${key}.png`]);
}

const sets = [];
for (const key of Object.keys(en.artifact_names)) {
  const icon = ["flower", "plume", "sands", "goblet", "circlet"].map((s) => artifactIcons[`${key}_${s}`]).find(Boolean);
  if (!icon) continue;
  sets.push({ key, name: en.artifact_names[key], names: allNames("artifact_names", key) });
  downloads.push([ICON(icon), `artifact/${key}.png`]);
}

const byName = (a, b) => a.name.localeCompare(b.name);
await fs.mkdir(path.join(ROOT, "src/data"), { recursive: true });
await fs.writeFile(
  path.join(ROOT, "src/data/gamedata.json"),
  JSON.stringify({ characters: characters.sort(byName), weapons: weapons.sort(byName), sets: sets.sort(byName) }),
);
console.log(`data: ${characters.length} characters, ${weapons.length} weapons, ${sets.length} sets`);

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
        await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
        done++;
      } catch (e) {
        failed++;
        console.warn(`icon failed: ${rel} (${url}): ${e.message}`);
      }
    }
  }),
);
console.log(`icons: ${done} downloaded, ${failed} failed`);

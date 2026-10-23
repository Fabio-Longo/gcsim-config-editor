import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

const dict = {
  title: { en: "gcsim config editor", ru: "Редактор конфигов gcsim" },
  reset: { en: "Reset", ru: "Сбросить" },
  resetConfirm: { en: "Clear team and rotation?", ru: "Очистить команду и ротацию?" },
  team: { en: "Team", ru: "Команда" },
  rotation: { en: "Rotation", ru: "Ротация" },
  dragHint: {
    en: "Drag cards and blocks (by ⠿) to reorder or move them into other blocks",
    ru: "Перетаскивайте карточки и блоки (за ⠿), в том числе внутрь других блоков",
  },
  loop: { en: "Loop (while 1)", ru: "Повторять (while 1)" },
  config: { en: "Config", ru: "Конфиг" },
  iterations: { en: "Iterations", ru: "Итерации" },
  duration: { en: "Duration, s", ru: "Длительность, с" },
  copy: { en: "Copy", ru: "Копировать" },
  copied: { en: "Copied!", ru: "Скопировано!" },
  download: { en: "Download", ru: "Скачать" },

  addCharacter: { en: "Add character", ru: "Добавить героя" },
  chooseCharacter: { en: "Choose character", ru: "Выберите героя" },
  chooseWeapon: { en: "Choose weapon", ru: "Выберите оружие" },
  chooseSet: { en: "Choose artifact set", ru: "Выберите набор артефактов" },
  chooseSetShort: { en: "Choose set", ru: "Выбрать набор" },
  changeCharacter: { en: "Change character", ru: "Сменить героя" },
  remove: { en: "Remove", ru: "Удалить" },
  clear: { en: "Clear", ru: "Очистить" },
  close: { en: "Close", ru: "Закрыть" },
  constellation: { en: "Constellation", ru: "Созвездие" },
  level: { en: "Level", ru: "Уровень" },
  talents: { en: "Talents (NA/E/Q)", ru: "Таланты (АА/E/Q)" },
  weapon: { en: "Weapon", ru: "Оружие" },
  refine: { en: "Refine", ru: "Пробуждение" },
  artifacts: { en: "Artifacts", ru: "Артефакты" },
  artifactStats: { en: "Artifact stats (total)", ru: "Статы артефактов (сумма)" },
  artifactStatsHint: {
    en: "All bonuses from the 5 artifacts combined: main stats (incl. flower HP and plume ATK) plus substats.",
    ru: "Все бонусы со всех 5 артефактов вместе: основные статы (включая HP цветка и атаку пера) и доп. статы.",
  },
  searchPlaceholder: { en: "Search by name…", ru: "Поиск по имени…" },
  nothingFound: { en: "Nothing found", ru: "Ничего не найдено" },

  addAction: { en: "Add action", ru: "Добавить действие" },
  addCharFirst: { en: "Add a character to the team first", ru: "Сначала добавьте героя в команду" },
  addStep: { en: "Add to timeline", ru: "Добавить в таймлайн" },
  chooseAction: { en: "{name}: choose action", ru: "{name}: выберите действие" },
  repeatCount: { en: "Repeat count (attack / charged / aim)", ru: "Количество повторов (атака / заряженная / прицельная)" },
  otherCharacter: { en: "← other character", ru: "← другой герой" },
  orWait: { en: "…or wait", ru: "…или подождать" },
  seconds: { en: "s", ru: "с" },
  add: { en: "Add", ru: "Добавить" },
  duplicate: { en: "Duplicate", ru: "Дублировать" },
  orBlock: { en: "…or a block", ru: "…или блок" },
  "block.group": { en: "Action block", ru: "Блок действий" },
  condPlaceholder: { en: "condition", ru: "условие" },
  condExample: { en: "Condition, e.g. .xiangling.burst.ready", ru: "Условие, напр. .xiangling.burst.ready" },
  skipOnCooldown: { en: "Skip if not ready", ru: "Пропустить, если не готово" },
  notesFromGcsim: { en: "gcsim notes:", ru: "Примечания gcsim:" },

  "action.attack": { en: "Attack", ru: "Атака" },
  "action.charge": { en: "Charged", ru: "Заряженная" },
  "action.aim": { en: "Aim", ru: "Прицельный" },
  "action.high_plunge": { en: "High Plunge", ru: "Падение (высокое)" },
  "action.low_plunge": { en: "Low Plunge", ru: "Падение (низкое)" },
  "action.skill": { en: "Skill (E)", ru: "Навык (E)" },
  "action.burst": { en: "Burst (Q)", ru: "Взрыв (Q)" },
  "action.dash": { en: "Dash", ru: "Рывок" },
  "action.jump": { en: "Jump", ru: "Прыжок" },
  "action.walk": { en: "Walk", ru: "Ходьба" },
  "action.wait": { en: "Wait", ru: "Ждать" },

  "stat.hp": { en: "HP", ru: "HP" },
  "stat.hp%": { en: "HP%", ru: "HP%" },
  "stat.atk": { en: "ATK", ru: "Сила атаки" },
  "stat.atk%": { en: "ATK%", ru: "Сила атаки%" },
  "stat.def": { en: "DEF", ru: "Защита" },
  "stat.def%": { en: "DEF%", ru: "Защита%" },
  "stat.em": { en: "Elemental Mastery", ru: "Мастерство стихий" },
  "stat.er": { en: "Energy Recharge", ru: "Восст. энергии" },
  "stat.cr": { en: "Crit Rate", ru: "Шанс крит. попадания" },
  "stat.cd": { en: "Crit DMG", ru: "Крит. урон" },
  "stat.heal": { en: "Healing Bonus", ru: "Бонус лечения" },
  "stat.pyro%": { en: "Pyro DMG", ru: "Бонус Пиро урона" },
  "stat.hydro%": { en: "Hydro DMG", ru: "Бонус Гидро урона" },
  "stat.cryo%": { en: "Cryo DMG", ru: "Бонус Крио урона" },
  "stat.electro%": { en: "Electro DMG", ru: "Бонус Электро урона" },
  "stat.anemo%": { en: "Anemo DMG", ru: "Бонус Анемо урона" },
  "stat.geo%": { en: "Geo DMG", ru: "Бонус Гео урона" },
  "stat.dendro%": { en: "Dendro DMG", ru: "Бонус Дендро урона" },
  "stat.phys%": { en: "Physical DMG", ru: "Бонус физ. урона" },
  // Short forms for the artifact stat grid.
  "short.hp": { en: "HP", ru: "HP" },
  "short.hp%": { en: "HP%", ru: "HP%" },
  "short.atk": { en: "ATK", ru: "Атака" },
  "short.atk%": { en: "ATK%", ru: "Атака%" },
  "short.def": { en: "DEF", ru: "Защита" },
  "short.def%": { en: "DEF%", ru: "Защита%" },
  "short.em": { en: "EM", ru: "МС" },
  "short.er": { en: "ER", ru: "ВЭ" },
  "short.cr": { en: "Crit Rate", ru: "Крит.шанс" },
  "short.cd": { en: "Crit DMG", ru: "Крит.урон" },
  "short.heal": { en: "Healing", ru: "Лечение" },
  "short.pyro%": { en: "Pyro %", ru: "Пиро %" },
  "short.hydro%": { en: "Hydro %", ru: "Гидро %" },
  "short.cryo%": { en: "Cryo %", ru: "Крио %" },
  "short.electro%": { en: "Electro %", ru: "Электро %" },
  "short.anemo%": { en: "Anemo %", ru: "Анемо %" },
  "short.geo%": { en: "Geo %", ru: "Гео %" },
  "short.dendro%": { en: "Dendro %", ru: "Дендро %" },
  "short.phys%": { en: "Phys. %", ru: "Физ. %" },

  "elem.anemo": { en: "Anemo", ru: "Анемо" },
  "elem.cryo": { en: "Cryo", ru: "Крио" },
  "elem.pyro": { en: "Pyro", ru: "Пиро" },
  "elem.hydro": { en: "Hydro", ru: "Гидро" },
  "elem.electro": { en: "Electro", ru: "Электро" },
  "elem.geo": { en: "Geo", ru: "Гео" },
  "elem.dendro": { en: "Dendro", ru: "Дендро" },
  "elem.none": { en: "None", ru: "Нет" },
  "weapon.sword": { en: "Sword", ru: "Одноручный меч" },
  "weapon.claymore": { en: "Claymore", ru: "Двуручный меч" },
  "weapon.polearm": { en: "Polearm", ru: "Древковое" },
  "weapon.bow": { en: "Bow", ru: "Лук" },
  "weapon.catalyst": { en: "Catalyst", ru: "Катализатор" },
} satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof dict;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey | string, vars?: Record<string, string | number>) => string;
  /** Localized name of a character/weapon/set. */
  name: (item: { name: string; names: Record<string, string> }) => string;
}

const Ctx = createContext<I18n | null>(null);
const STORAGE_KEY = "gcsim-editor-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {}
  return navigator.language.startsWith("ru") ? "ru" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, [lang]);

  const t: I18n["t"] = (key, vars) => {
    let s = (dict as Record<string, Record<Lang, string>>)[key]?.[lang] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const name: I18n["name"] = (item) => item.names[lang] ?? item.name;

  return <Ctx.Provider value={{ lang, setLang, t, name }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx)!;
}

import { de } from "./de";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { id } from "./id";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";
import { ru } from "./ru";
import { th } from "./th";
import { tr } from "./tr";
import { vi } from "./vi";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

/** Every text language of Genshin Impact, labelled in its own language. */
export const LANGS = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

export const MESSAGES: Record<Lang, Messages> = {
  en, ru, "zh-CN": zhCN, "zh-TW": zhTW, ja, ko, de, es, fr, pt, it, tr, id, th, vi,
};

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

/**
 * Picks the first supported language from the browser's preferences ("pt-BR" → pt,
 * "zh-HK" / "zh-Hant" → zh-TW, other "zh" → zh-CN), falling back to English.
 */
export function detectLang(prefs: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const raw of prefs) {
    const tag = raw.toLowerCase();
    if (tag.startsWith("zh")) return /hant|tw|hk|mo/.test(tag) ? "zh-TW" : "zh-CN";
    const base = tag.split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

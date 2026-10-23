import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Messages } from "./locales/en";
import { detectLang, isLang, MESSAGES, type Lang } from "./locales";

export { LANGS, type Lang } from "./locales";
export type TKey = keyof Messages;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey | string, vars?: Record<string, string | number>) => string;
  /** Localized name of a character/weapon/set. */
  name: (item: { name: string; names: Record<string, string> }) => string;
}

const Ctx = createContext<I18n | null>(null);
const STORAGE_KEY = "gcsim-editor-lang";

/** An explicit choice from the language menu wins; otherwise follow the browser. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {}
  return detectLang();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Only a choice made in the menu is remembered, so auto-detection keeps following the browser.
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const t: I18n["t"] = (key, vars) => {
    const messages = MESSAGES[lang] as Record<string, string>;
    let s = messages[key] ?? (MESSAGES.en as Record<string, string>)[key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const name: I18n["name"] = (item) => item.names[lang] ?? item.name;

  return <Ctx.Provider value={{ lang, setLang, t, name }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx)!;
}

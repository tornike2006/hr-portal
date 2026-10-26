import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ka, type Dict } from "./ka";
import { en } from "./en";

export type Lang = "ka" | "en";
export type Key = keyof Dict;
const dicts: Record<Lang, Dict> = { ka, en };

export type DateStyle = "full" | "dm" | "dmy" | "my" | "wdm" | "short" | "time";

const KA_MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const KA_DAYS = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const EN_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  dm: { day: "numeric", month: "long" },
  dmy: { day: "numeric", month: "long", year: "numeric" },
  my: { month: "long", year: "numeric" },
  wdm: { weekday: "long", day: "numeric", month: "long" },
  short: { weekday: "short", day: "numeric", month: "short" },
  time: { hour: "2-digit", minute: "2-digit" },
};

// Georgian is formatted by hand: not every browser ships Georgian locale data.
function formatDate(d: Date, style: DateStyle, lang: Lang): string {
  if (lang === "en") return d.toLocaleString("en-GB", EN_OPTS[style]);
  const day = d.getDate(), mon = KA_MONTHS[d.getMonth()], y = d.getFullYear(), wd = KA_DAYS[d.getDay()];
  switch (style) {
    case "full": return `${wd}, ${day} ${mon}, ${y}`;
    case "dm": return `${day} ${mon}`;
    case "dmy": return `${day} ${mon}, ${y}`;
    case "my": return `${mon} ${y}`;
    case "wdm": return `${wd}, ${day} ${mon}`;
    case "short": return `${day} ${mon.slice(0, 3)}, ${wd.slice(0, 3)}`;
    case "time": return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

interface Ctx {
  df: (d: Date | string, style: DateStyle) => string;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
  locale: string;
}

const I18nCtx = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const s = localStorage.getItem("lang");
    if (s === "ka" || s === "en") return s;
  } catch {
    /* storage unavailable */
  }
  return "ka";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<Ctx>(() => {
    const d = dicts[lang];
    return {
      lang,
      setLang,
      locale: lang === "ka" ? "ka-GE" : "en-GB",
      df: (d, style) => formatDate(typeof d === "string" ? (d.length === 10 ? new Date(d + "T00:00") : new Date(d)) : d, style, lang),
      t: (k, vars) => {
        let s: string = d[k] ?? ka[k] ?? k;
        if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
        return s;
      },
    };
  }, [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useT outside provider");
  return c;
}

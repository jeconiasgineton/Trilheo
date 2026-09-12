"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { translate, type MessageKey } from "./translate";

const LocaleContext = createContext<Locale>("pt-BR");

/** Recebe o locale já resolvido no servidor (cookie) — sem flash de idioma errado no primeiro render. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useTranslations() {
  const locale = useLocale();
  return useMemo(() => (key: MessageKey) => translate(locale, key), [locale]);
}

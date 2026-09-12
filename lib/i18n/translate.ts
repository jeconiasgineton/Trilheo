import type { Locale } from "./config";
import { MESSAGES } from "./messages";

type Path<T, Prefix extends string = ""> = T extends string
  ? Prefix extends "" ? never : Prefix
  : {
      [K in keyof T & string]: Path<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type MessageKey = Path<(typeof MESSAGES)["pt-BR"]>;

function lookup(obj: unknown, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

/** Tradução pura: chave ausente no locale cai para pt-BR, depois para a própria chave — nunca lança/quebra a tela. */
export function translate(locale: Locale, key: MessageKey): string {
  return lookup(MESSAGES[locale], key) ?? lookup(MESSAGES["pt-BR"], key) ?? key;
}

export function getTranslator(locale: Locale) {
  return (key: MessageKey) => translate(locale, key);
}

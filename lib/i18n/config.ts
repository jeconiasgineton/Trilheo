/**
 * Configuração de i18n (Fase 7). Decisão: idioma por cookie
 * (`NEXT_LOCALE`), sem prefixo de URL (`/en/...`) — a árvore de rotas
 * já é organizada por `/[orgSlug]/...` para multi-tenant; adicionar
 * `/[locale]/[orgSlug]/...` por cima exigiria mover todas as páginas
 * existentes para dentro de mais um segmento dinâmico, um refactor
 * estrutural grande e arriscado só para ganhar URLs por idioma — algo
 * que ninguém pediu. Cookie é suficiente para "o usuário escolhe o
 * idioma da interface" sem tocar em nenhuma rota existente.
 */
export const LOCALES = ["pt-BR", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

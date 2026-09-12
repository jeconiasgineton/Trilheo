import type { Locale } from "../config";

/**
 * Formato das mensagens, definido explicitamente (não inferido de
 * `pt-BR.ts` via `as const`) — inferir do objeto pt-BR faria o
 * TypeScript fixar os *valores literais* em português como o tipo de
 * cada chave, impedindo `en-US.ts` de ter qualquer string diferente.
 * A interface aqui exige apenas que a forma (quais chaves existem)
 * seja igual entre os locales, não o conteúdo.
 */
export interface Messages {
  nav: {
    workspace: string;
    innovation: string;
    forms: string;
    members: string;
    signOut: string;
  };
  locale: {
    label: string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    invalidCredentials: string;
    demoHint: string;
  };
  signup: {
    title: string;
    subtitle: string;
    organizationName: string;
    yourName: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    alreadyHaveAccount: string;
    signIn: string;
  };
}

import ptBR from "./pt-BR";
import enUS from "./en-US";

export const MESSAGES: Record<Locale, Messages> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

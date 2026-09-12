"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false as const, error: "Idioma inválido." };
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true as const };
}

"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

export function Providers({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </SessionProvider>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale } from "@/lib/i18n/get-locale";

export const metadata: Metadata = {
  title: "Trilheo",
  description: "Plataforma de gerenciamento de projetos e fluxos de inovação.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}

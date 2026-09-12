import type { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getTranslator } from "@/lib/i18n/translate";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { can } from "@/lib/modules/permissions";
import { SignOutButton } from "./sign-out-button";

/**
 * `middleware.ts` já bloqueia requisições sem sessão para tudo fora
 * de /login, /signup e /api/auth, mas repetimos a checagem aqui
 * (defesa em profundidade, mesmo padrão usado nas server actions) e
 * é o único lugar com acesso direto à sessão para montar o header
 * com a navegação principal.
 *
 * Os links usam `session.user.organizationSlug` (nunca um slug vindo
 * da URL) — consistente com o isolamento multi-tenant da camada de
 * UI (ver [orgSlug]/layout.tsx).
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const orgSlug = session.user.organizationSlug;
  const t = getTranslator(getLocale());

  return (
    <div className="min-h-screen bg-muted">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold">Trilheo</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/${orgSlug}/workspace`} className="hover:text-foreground">
              {t("nav.workspace")}
            </Link>
            <Link href={`/${orgSlug}/innovation`} className="hover:text-foreground">
              {t("nav.innovation")}
            </Link>
            <Link href={`/${orgSlug}/forms`} className="hover:text-foreground">
              {t("nav.forms")}
            </Link>
            <Link href={`/${orgSlug}/settings/members`} className="hover:text-foreground">
              {t("nav.members")}
            </Link>
            {can(session.user.role, "billing:manage") && (
              <Link href={`/${orgSlug}/settings/billing`} className="hover:text-foreground">
                Billing
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <LocaleSwitcher />
          <span>{session.user.name ?? session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
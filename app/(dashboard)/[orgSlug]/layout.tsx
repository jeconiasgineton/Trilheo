import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";

/**
 * Isolamento multi-tenant na camada de URL: confere que o `orgSlug`
 * da rota bate com a organização da sessão. Devolve 404 (não
 * redirect) quando não bate — não revela se o slug pertence a outra
 * organização ou simplesmente não existe (mesma lógica de
 * enumeração usada nos services: NOT_FOUND também para "existe, mas
 * é de outra org").
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { orgSlug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.organizationSlug !== params.orgSlug) notFound();
  return <>{children}</>;
}

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyCredentials } from "./service";
import { checkRateLimit, getClientIp, logSecurityEvent } from "@/lib/rate-limit";

export * from "./schemas";
export * from "./service";
// "./actions" não é re-exportado daqui de propósito: actions.ts importa
// `authOptions` deste index — re-exportar criaria um ciclo. Server
// components/actions importam de "@/lib/modules/auth/actions" direto.

/**
 * Configuração NextAuth (JWT strategy). O login é por email/senha —
 * a checagem em si fica em `verifyCredentials` (service.ts), fora do
 * provider, para ser testável sem subir o Next. No callback jwt
 * buscamos o primeiro membership do usuário para popular
 * role + organizationId/Slug na sessão — toda query do app filtra
 * por organizationId da sessão (isolamento multi-tenant).
 *
 * (Fase 3: trocar "primeiro membership" por seleção de organização
 * ativa quando um usuário pertence a mais de uma org — ver
 * CONTEXTO.MD, pendência sinalizada pela auditoria da Fase 1.)
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        // Rate limiting (Fase 7 — pendência apontada pela auditoria da
        // Fase 1). Duas janelas: por IP+email (força bruta numa conta
        // específica) e por IP puro (varredura de várias contas a
        // partir do mesmo IP). Em caso de limite estourado, devolve o
        // mesmo `null` de credencial inválida — não revela ao cliente
        // que a causa foi rate limit, só loga no servidor para quem
        // opera o sistema conseguir ver o padrão de abuso.
        const ip = getClientIp(req?.headers ?? {});
        const emailKey = `login:${ip}:${email.toLowerCase()}`;
        const ipKey = `login-ip:${ip}`;
        const perAccount = checkRateLimit(emailKey, 5, 15 * 60_000);
        const perIp = checkRateLimit(ipKey, 30, 15 * 60_000);
        if (!perAccount.allowed || !perIp.allowed) {
          logSecurityEvent("login_rate_limited", { ip, email, scope: !perAccount.allowed ? "account" : "ip" });
          return null;
        }

        const user = await verifyCredentials(email, password);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if (token.id) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: token.id },
          include: { organization: { select: { slug: true } } },
        });
        if (membership) {
          token.role = membership.role;
          token.organizationId = membership.organizationId;
          token.organizationSlug = membership.organization.slug;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = token.role as any;
        session.user.organizationId = (token.organizationId as string) ?? "";
        session.user.organizationSlug = (token.organizationSlug as string) ?? "";
      }
      return session;
    },
  },
};

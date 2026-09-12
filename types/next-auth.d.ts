import type { DefaultSession } from "next-auth";
import type { MemberRole } from "@prisma/client";

/** Extende a sessão com dados do membership (org + papel). */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: MemberRole;
      organizationId: string;
      organizationSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: MemberRole;
    organizationId?: string;
    organizationSlug?: string;
  }
}

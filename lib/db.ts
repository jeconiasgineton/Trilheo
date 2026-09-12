import { PrismaClient } from "@prisma/client";

/**
 * Singleton do PrismaClient. Reaproveita a instância em dev (HMR)
 * para não esgotar conexões do Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

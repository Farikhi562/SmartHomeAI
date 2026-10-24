import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton (dev hot-reload safe). DATABASE_URL/DIRECT_URL come from
 * the environment (see src/lib/config/env.ts; .env.local in development).
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

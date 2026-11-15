import { PrismaClient } from '@prisma/client';

// One PrismaClient per server instance (dev hot-reloads AND each warm Vercel function),
// so connections to the Supabase pooler are reused instead of piling up.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;

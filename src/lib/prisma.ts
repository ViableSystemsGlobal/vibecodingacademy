import { PrismaClient } from "@prisma/client";

type GlobalPrisma = {
  prisma?: PrismaClient;
};

const globalForPrisma = globalThis as typeof globalThis & GlobalPrisma;

const prismaClientSingleton = () => new PrismaClient();

if (!globalForPrisma.prisma || !(globalForPrisma.prisma as any).storefrontContent) {
  globalForPrisma.prisma = prismaClientSingleton();
}

export const prisma = globalForPrisma.prisma!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

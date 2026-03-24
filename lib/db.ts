import { PrismaClient } from "@prisma/client";

declare global {
  var prismaClient: PrismaClient | undefined;
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  if (!global.prismaClient) {
    global.prismaClient = new PrismaClient();
  }

  return global.prismaClient;
}

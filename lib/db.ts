import { PrismaClient } from "@prisma/client";

declare global {
  var prismaClient: PrismaClient | undefined;
}

function clientHasAdminRole(client: PrismaClient): boolean {
  return typeof (client as unknown as { adminRole?: { create: unknown } }).adminRole?.create === "function";
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  if (!global.prismaClient) {
    global.prismaClient = new PrismaClient();
  } else if (!clientHasAdminRole(global.prismaClient)) {
    // Dev / deploy: singleton was created before `AdminRole` existed in schema; `prisma generate` updated
    // node_modules but this process still holds the old PrismaClient instance (no `adminRole` delegate).
    void global.prismaClient.$disconnect().catch(() => undefined);
    global.prismaClient = new PrismaClient();
  }

  if (!clientHasAdminRole(global.prismaClient)) {
    throw new Error(
      "Prisma client has no AdminRole model. Run: npx prisma generate — then restart npm run dev.",
    );
  }

  return global.prismaClient;
}

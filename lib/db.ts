import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrlForPrisma } from "@/lib/database-url";

declare global {
  var prismaClient: PrismaClient | undefined;
}

function clientHasAdminRole(client: PrismaClient): boolean {
  return typeof (client as unknown as { adminRole?: { create: unknown } }).adminRole?.create === "function";
}

function warnIfVercelUsesLocalDatabaseUrl(url: string) {
  if (process.env.VERCEL !== "1") return;
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    console.error(
      "[db] DATABASE_URL uses localhost on Vercel — the build cannot reach your PC. Use a hosted Postgres URL (Neon, Supabase, etc.).",
    );
  }
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  warnIfVercelUsesLocalDatabaseUrl(url);

  const datasourceUrl = resolveDatabaseUrlForPrisma(url);

  return new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  if (!global.prismaClient) {
    global.prismaClient = createPrismaClient();
  } else if (!clientHasAdminRole(global.prismaClient)) {
    // Dev / deploy: singleton was created before `AdminRole` existed in schema; `prisma generate` updated
    // node_modules but this process still holds the old PrismaClient instance (no `adminRole` delegate).
    void global.prismaClient.$disconnect().catch(() => undefined);
    global.prismaClient = createPrismaClient();
  }

  if (!clientHasAdminRole(global.prismaClient)) {
    throw new Error(
      "Prisma client has no AdminRole model. Run: npx prisma generate — then restart npm run dev.",
    );
  }

  return global.prismaClient;
}

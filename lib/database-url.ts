/**
 * Vercel serverless + Neon: ensure SSL and pooler params Prisma expects.
 * Localhost / local DB unchanged.
 *
 * Neon dashboard: use the **pooled** connection string for DATABASE_URL on Vercel
 * (host contains `pooler` — e.g. `ep-xxx-pooler.region.aws.neon.tech`).
 */
export function resolveDatabaseUrlForPrisma(raw?: string | null): string {
  const url = (raw ?? process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  if (process.env.VERCEL !== "1") {
    return url;
  }

  let out = url;

  const hasParam = (key: string) => new RegExp(`[?&]${key}=`, "i").test(out);
  const addParam = (key: string, value: string) => {
    if (hasParam(key)) return;
    out += (out.includes("?") ? "&" : "?") + `${key}=${encodeURIComponent(value)}`;
  };

  if (/postgres(ql)?:\/\//i.test(out) && !hasParam("sslmode")) {
    addParam("sslmode", "require");
  }

  if (/neon\.tech/i.test(out)) {
    if (/pooler/i.test(out)) {
      addParam("pgbouncer", "true");
    }
    addParam("connect_timeout", "15");
    addParam("connection_limit", "1");
  }

  return out;
}

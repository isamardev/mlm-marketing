/**
 * Use `DATABASE_URL` exactly as Neon / your host provides it in Vercel env.
 * Auto-appending `connection_limit`, `connect_timeout`, etc. caused
 * `Can't reach database server` with Neon pooler + Prisma in production.
 *
 * If you need extra params, add them in the Neon dashboard connection string
 * (or Vercel → Environment Variables) — do not patch here unless you know the driver accepts them.
 */
export function resolveDatabaseUrlForPrisma(raw?: string | null): string {
  const url = (raw ?? process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  return url;
}

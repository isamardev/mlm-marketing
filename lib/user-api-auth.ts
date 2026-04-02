import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { verifyImpersonationToken } from "@/lib/impersonation-token";

/**
 * Resolves which user a /api/user/* call is for: normal session, or Bearer impersonation token (admin opened user in new tab).
 * Impersonation does not change cookies, so the admin tab stays logged in.
 */
export async function getUserApiContext(req: Request): Promise<
  | { ok: true; userId: string; effectiveStatus: string; impersonation: boolean }
  | { ok: false; status: number; error: string }
> {
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const raw = authz.slice(7).trim();
    const uid = verifyImpersonationToken(raw);
    if (uid) {
      const db = getDb();
      const u = await db.user.findUnique({ where: { id: uid }, select: { status: true } });
      if (!u) return { ok: false, status: 401, error: "Invalid impersonation" };
      return { ok: true, userId: uid, effectiveStatus: u.status, impersonation: true };
    }
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return {
    ok: true,
    userId: session.user.id,
    effectiveStatus: session.user.status ?? "active",
    impersonation: false,
  };
}

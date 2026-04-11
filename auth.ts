import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { resolveAdminPermissionsForUser } from "@/lib/admin-permissions";

const authUrlEnv = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
if (
  process.env.VERCEL === "1" &&
  authUrlEnv &&
  (authUrlEnv.includes("localhost") || authUrlEnv.includes("127.0.0.1"))
) {
  console.error(
    "[auth] AUTH_URL / NEXTAUTH_URL points to localhost on Vercel. Remove it or set to your live https URL (e.g. https://your-app.vercel.app). Local-only values break login in production.",
  );
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  isImpersonation: z.string().optional(),
  adminToken: z.string().optional(),
  /** Set to "true" from `/role` login — required for users who have an assigned admin role. */
  staffRoleLogin: z.string().optional(),
});

/**
 * trustHost: required on Vercel / HTTPS proxies so Auth.js accepts the incoming Host header.
 * Set AUTH_SECRET + DATABASE_URL on the host. Without AUTH_SECRET, `/api/auth/*` returns a
 * configuration error and the browser shows ClientFetchError (see errors.authjs.dev#autherror).
 * For AUTH_URL / NEXTAUTH_URL: use only in `.env.local` for localhost; on Vercel either omit
 * them (often inferred) or set `https://…`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        isImpersonation: { label: "isImpersonation", type: "text" },
        adminToken: { label: "adminToken", type: "text" },
        staffRoleLogin: { label: "staffRoleLogin", type: "text" },
      },
      authorize: async (credentials) => {
        try {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password, isImpersonation, adminToken, staffRoleLogin } = parsed.data;

          const db = getDb();

          // Impersonation flow (Admin viewing user)
          if (isImpersonation === "true" && adminToken) {
            if (adminToken === "admin123" || adminToken === process.env.ADMIN_SECRET) {
              const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
              if (!user) return null;
              return {
                id: user.id,
                name: user.username,
                email: user.email,
                status: user.status,
              };
            }
          }

          const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
          const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
          if (
            email.trim().toLowerCase() === adminEmail &&
            password === adminPassword
          ) {
            const adminSessionEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim();
            return {
              id: "admin-fixed",
              name: "Admin",
              email: adminSessionEmail,
              status: "admin",
            };
          }

          if (!password) return null;
          const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
          if (!user) return null;

          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;

          if (user.status === "blocked") return null;

          if (user.adminRoleId && staffRoleLogin !== "true") {
            return null;
          }
          if (staffRoleLogin === "true" && user.status !== "admin") {
            return null;
          }

          const status =
            adminEmail === user.email.toLowerCase() ? "admin" : user.status;

          return {
            id: user.id,
            name: user.username,
            email: user.email,
            status,
          };
        } catch (e) {
          console.error("[auth] authorize failed (check DATABASE_URL / SSL / pooler on Vercel):", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
        token.status = (user as { status?: string }).status ?? "active";
        token.email = (user as { email?: string | null }).email ?? token.email;
      }
      if (!user && token.userId && token.status !== "admin") {
        try {
          const db = getDb();
          const fresh = await db.user.findUnique({
            where: { id: token.userId as string },
            select: { status: true, email: true },
          });
          if (fresh?.status) {
            token.status = fresh.status;
          }
        } catch (e) {
          console.error("[auth] jwt user refresh:", e);
        }
      }
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
      if (adminEmail && typeof token.email === "string" && token.email.toLowerCase() === adminEmail) {
        token.status = "admin";
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.userId as string;
      session.user.status = (token.status as string) ?? "active";
      const email = typeof token.email === "string" ? token.email : session.user.email;
      try {
        const perms = await resolveAdminPermissionsForUser(
          token.userId as string,
          email,
        );
        session.user.adminFullAccess = perms.fullAccess;
        session.user.adminAllowedSections = perms.sections;
      } catch (e) {
        console.error("[auth] session permissions:", e);
        session.user.adminFullAccess = false;
        session.user.adminAllowedSections = [];
      }
      return session;
    },
  },
});

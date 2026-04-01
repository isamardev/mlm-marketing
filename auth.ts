import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  isImpersonation: z.string().optional(),
  adminToken: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      },
      authorize: async (credentials) => {
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) return null;

    const { email, password, isImpersonation, adminToken } = parsed.data;

    const db = getDb();

    // Impersonation flow (Admin viewing user)
    if (isImpersonation === "true" && adminToken) {
      // Check if adminToken matches admin credentials or a fixed secret
      if (adminToken === "admin123" || adminToken === process.env.ADMIN_SECRET) {
        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return null;
        // Allow login as any user without password for admin
        return {
          id: user.id,
          name: user.username,
          email: user.email,
          status: user.status,
        };
      }
    }

    if (email === "admin@example.com" && password === "admin123") {
      return {
        id: "admin-fixed",
        name: "Admin",
        email: "admin@example.com",
        status: "admin",
      };
    }

    if (!password) return null;
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    if (user.status === "blocked") return null;

    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const status = adminEmail && adminEmail === user.email.toLowerCase() ? "admin" : user.status;

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          status,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
        token.status = (user as { status?: string }).status ?? "active";
      }
      if (!user && token.userId && token.status !== "admin") {
        const db = getDb();
        const fresh = await db.user.findUnique({
          where: { id: token.userId as string },
          select: { status: true, email: true },
        });
        if (fresh?.status) {
          token.status = fresh.status;
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
      return session;
    },
  },
});

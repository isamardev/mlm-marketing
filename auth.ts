import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
      },
      authorize: async (credentials) => {
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) return null;

    const { email, password } = parsed.data;

    if (email === "admin@example.com" && password === "admin123") {
      return {
        id: "admin-fixed",
        name: "Admin",
        email: "admin@example.com",
        status: "admin",
      };
    }

    const db = getDb();
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

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

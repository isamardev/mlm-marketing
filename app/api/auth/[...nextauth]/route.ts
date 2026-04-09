import { handlers } from "@/auth";

/** Prisma + bcrypt need the Node.js runtime (not Edge). */
export const runtime = "nodejs";

export const { GET, POST } = handlers;


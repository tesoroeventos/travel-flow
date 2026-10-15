import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Ctx } from "../context";
import { getDb } from "../db";
import { users } from "../db/schema";
import { signSession, verifySession } from "./token";

const COOKIE = "tf_session";
const TTL_SECONDS = 30 * 24 * 60 * 60;

const secret = () => process.env.AUTH_SECRET ?? "";

export async function createSession(ctx: Ctx): Promise<void> {
  const token = await signSession(ctx, secret(), TTL_SECONDS);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Contexto de la sesión actual, o null si no hay sesión válida. */
export async function getCtx(): Promise<Ctx | null> {
  return verifySession((await cookies()).get(COOKIE)?.value, secret());
}

/** Contexto obligatorio: redirige a /login si no hay sesión. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function currentUser(): Promise<{ id: string; name: string; email: string } | null> {
  const ctx = await getCtx();
  if (!ctx) return null;
  const db = await getDb();
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, ctx.userId));
  return u ?? null;
}

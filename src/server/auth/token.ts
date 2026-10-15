import { SignJWT, jwtVerify } from "jose";
import type { Ctx } from "../context";

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(secret);
}

export async function signSession(ctx: Ctx, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ uid: ctx.userId, wid: ctx.workspaceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<Ctx | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.wid !== "string") return null;
    return { userId: payload.uid, workspaceId: payload.wid };
  } catch {
    return null;
  }
}

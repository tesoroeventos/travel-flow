import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { err, ok, type Result } from "@/domain/result";
import type { Db } from "../db/client";
import { inviteCodes, users, workspaceMembers, workspaces } from "../db/schema";
import type { Ctx } from "../context";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function createInvite(db: Db, opts: { uses: number; days: number }): Promise<string> {
  const code = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  await db.insert(inviteCodes).values({
    code,
    maxUses: opts.uses,
    expiresAt: new Date(Date.now() + opts.days * 86_400_000),
  });
  return code;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}

class RegisterError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function register(db: Db, input: RegisterInput): Promise<Result<Ctx>> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hash(input.password);
  try {
    const ctx = await db.transaction(async (tx) => {
      const [invite] = await tx.select().from(inviteCodes).where(eq(inviteCodes.code, input.inviteCode.trim().toUpperCase()));
      if (!invite) throw new RegisterError("invalid_invite", "Código de invitación inválido");
      if (invite.expiresAt && invite.expiresAt < new Date()) throw new RegisterError("expired_invite", "El código de invitación venció");
      if (invite.usedCount >= invite.maxUses) throw new RegisterError("used_invite", "El código de invitación ya se usó");

      const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (existing.length > 0) throw new RegisterError("email_taken", "Ya existe una cuenta con ese email");

      const [user] = await tx.insert(users).values({ email, name: input.name.trim(), passwordHash }).returning();
      const [ws] = await tx.insert(workspaces).values({ name: "Mi espacio" }).returning();
      await tx.insert(workspaceMembers).values({ workspaceId: ws!.id, userId: user!.id, role: "owner" });
      const updated = await tx
        .update(inviteCodes)
        .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
        .where(and(eq(inviteCodes.code, invite.code), sql`${inviteCodes.usedCount} < ${inviteCodes.maxUses}`))
        .returning();
      if (updated.length === 0) throw new RegisterError("used_invite", "El código de invitación ya se usó");
      return { userId: user!.id, workspaceId: ws!.id };
    });
    return ok(ctx);
  } catch (e) {
    if (e instanceof RegisterError) return err(e.code, e.message);
    throw e;
  }
}

/** Valida email y contraseña; devuelve el contexto (primer workspace del usuario). */
export async function verifyLogin(db: Db, emailInput: string, password: string): Promise<Result<Ctx>> {
  const bad = err("bad_credentials", "Email o contraseña incorrectos");
  const email = emailInput.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return bad;
  if (!(await verify(user.passwordHash, password))) return bad;
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(workspaceMembers.createdAt);
  if (!member) return bad;
  return ok({ userId: user.id, workspaceId: member.workspaceId });
}

const BOOTSTRAP_DAYS = 14;

/**
 * Asegura un código de invitación inicial (BOOTSTRAP_INVITE_CODE): hasta 1000 usos y vence a los
 * 14 días de creado. No se renueva en cada arranque, así que deja de servir aunque quede configurado.
 */
export async function ensureBootstrapInvite(db: Db, rawCode: string, now = new Date()): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return;
  await db
    .insert(inviteCodes)
    .values({ code, maxUses: 1000, expiresAt: new Date(now.getTime() + BOOTSTRAP_DAYS * 86_400_000) })
    .onConflictDoNothing();
}

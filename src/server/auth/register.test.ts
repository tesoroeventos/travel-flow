import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { inviteCodes, users, workspaceMembers } from "../db/schema";
import { createInvite, register, verifyLogin } from "./register";

const input = { name: "Ana", email: "ana@x.com", password: "secreta123", inviteCode: "" };

describe("register", () => {
  let db: Db;
  let code: string;
  beforeEach(async () => {
    db = await createTestDb();
    code = await createInvite(db, { uses: 1, days: 30 });
  });

  it("crea usuario, espacio personal y membresía", async () => {
    const r = await register(db, { ...input, inviteCode: code });
    expect(r.ok).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.email, "ana@x.com"));
    expect(u!.passwordHash).not.toBe("secreta123");
    expect(u!.passwordHash.startsWith("$argon2")).toBe(true);
    const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, u!.id));
    expect(members[0]).toMatchObject({ role: "owner" });
    const [inv] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
    expect(inv!.usedCount).toBe(1);
  });

  it("código inexistente", async () => {
    expect(await register(db, { ...input, inviteCode: "NOPE" })).toEqual({
      ok: false,
      error: { code: "invalid_invite", message: "Código de invitación inválido" },
    });
  });

  it("código vencido", async () => {
    const old = await createInvite(db, { uses: 1, days: -1 });
    expect(await register(db, { ...input, inviteCode: old })).toEqual({
      ok: false,
      error: { code: "expired_invite", message: "El código de invitación venció" },
    });
  });

  it("código agotado", async () => {
    await register(db, { ...input, inviteCode: code });
    expect(await register(db, { ...input, email: "otro@x.com", inviteCode: code })).toEqual({
      ok: false,
      error: { code: "used_invite", message: "El código de invitación ya se usó" },
    });
  });

  it("email repetido no consume el código", async () => {
    const multi = await createInvite(db, { uses: 5, days: 30 });
    await register(db, { ...input, inviteCode: multi });
    expect(await register(db, { ...input, inviteCode: multi })).toEqual({
      ok: false,
      error: { code: "email_taken", message: "Ya existe una cuenta con ese email" },
    });
    const [inv] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, multi));
    expect(inv!.usedCount).toBe(1);
  });

  it("los códigos tienen 10 caracteres sin ambigüedades", async () => {
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });
});

describe("verifyLogin", () => {
  it("valida la contraseña y devuelve el contexto", async () => {
    const db = await createTestDb();
    const code = await createInvite(db, { uses: 1, days: 30 });
    const reg = await register(db, { ...input, inviteCode: code });
    const ok = await verifyLogin(db, "ANA@x.com", "secreta123");
    expect(ok).toEqual({ ok: true, data: reg.ok && reg.data });
    expect(await verifyLogin(db, "ana@x.com", "mala")).toEqual({
      ok: false,
      error: { code: "bad_credentials", message: "Email o contraseña incorrectos" },
    });
  });
});

describe("ensureBootstrapInvite", () => {
  it("crea el código con vencimiento a 14 días y no lo renueva", async () => {
    const { ensureBootstrapInvite } = await import("./register");
    const db = await createTestDb();
    const now = new Date("2027-01-01T00:00:00Z");
    await ensureBootstrapInvite(db, "inicio2027", now);
    await ensureBootstrapInvite(db, "INICIO2027", new Date("2027-03-01T00:00:00Z"));
    const rows = await db.select().from(inviteCodes).where(eq(inviteCodes.code, "INICIO2027"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ maxUses: 1000, expiresAt: new Date("2027-01-15T00:00:00Z") });
  });
});

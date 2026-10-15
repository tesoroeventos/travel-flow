import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./token";

const secret = "x".repeat(32);

describe("token de sesión", () => {
  it("firma y verifica el contexto", async () => {
    const token = await signSession({ userId: "u1", workspaceId: "w1" }, secret, 60);
    expect(await verifySession(token, secret)).toEqual({ userId: "u1", workspaceId: "w1" });
  });

  it("rechaza tokens con otro secreto", async () => {
    const token = await signSession({ userId: "u1", workspaceId: "w1" }, secret, 60);
    expect(await verifySession(token, "y".repeat(32))).toBeNull();
  });

  it("rechaza tokens vencidos", async () => {
    const token = await signSession({ userId: "u1", workspaceId: "w1" }, secret, -10);
    expect(await verifySession(token, secret)).toBeNull();
  });

  it("rechaza basura y vacío", async () => {
    expect(await verifySession("abc", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });

  it("exige un secreto de al menos 32 caracteres", async () => {
    await expect(signSession({ userId: "u", workspaceId: "w" }, "corto", 60)).rejects.toThrow("AUTH_SECRET");
  });
});

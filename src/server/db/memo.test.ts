import { describe, expect, it } from "vitest";
import { memoizeWithRetry } from "./memo";

describe("memoizeWithRetry", () => {
  it("reutiliza el resultado exitoso", async () => {
    let calls = 0;
    const get = memoizeWithRetry(async () => ++calls);
    expect(await get()).toBe(1);
    expect(await get()).toBe(1);
  });

  it("si falla, el próximo llamado vuelve a intentar", async () => {
    let calls = 0;
    const get = memoizeWithRetry(async () => {
      calls++;
      if (calls === 1) throw new Error("sin conexión");
      return "ok";
    });
    await expect(get()).rejects.toThrow("sin conexión");
    expect(await get()).toBe("ok");
    expect(calls).toBe(2);
  });
});

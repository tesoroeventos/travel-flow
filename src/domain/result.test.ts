import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("Result", () => {
  it("ok envuelve el dato", () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 });
  });

  it("err envuelve código y mensaje", () => {
    expect(err("x", "y")).toEqual({ ok: false, error: { code: "x", message: "y" } });
  });
});

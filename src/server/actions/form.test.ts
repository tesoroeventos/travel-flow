import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formObject, formValues, zodErrors } from "./form";

describe("helpers de formularios", () => {
  it("formObject agrupa campos repetidos solo si se pide y omite campos internos de React", () => {
    const fd = new FormData();
    fd.append("name", "Ana");
    fd.append("amenities", "wifi");
    fd.append("amenities", "pool");
    fd.append("$ACTION_ID_123", "x");
    expect(formObject(fd, ["amenities", "interests"])).toEqual({ name: "Ana", amenities: ["wifi", "pool"], interests: [] });
  });

  it("formValues conserva el primer valor de cada campo", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("a", "2");
    expect(formValues(fd)).toEqual({ a: "1" });
  });

  it("zodErrors devuelve el primer mensaje por campo", () => {
    const r = z.object({ a: z.string().min(2, "corto"), b: z.object({ c: z.number({ message: "num" }) }) }).safeParse({ a: "", b: { c: "x" } });
    expect(zodErrors(r.error!)).toEqual({ a: "corto", "b.c": "num" });
  });
});

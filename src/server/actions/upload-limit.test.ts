import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("límite de subida de capturas", () => {
  it("las acciones aceptan capturas de hasta 8 MB (más margen del formulario)", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("9mb");
  });
});

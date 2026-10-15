import { describe, expect, it, vi } from "vitest";
import { fetchPage, isBlockedAddress } from "./fetch-page";

const publicLookup = async (h: string) => (h === "localhost" ? ["127.0.0.1"] : ["93.184.216.34"]);
const html = (body: string) =>
  new Response(`<html><head><title>Hotel</title></head><body>${body}</body></html>`, {
    status: 200,
    headers: { "content-type": "text/html" },
  });

describe("fetchPage", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.0.5",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
  ])("bloquea %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "2606:2800:220:1::1", "8.8.8.8"])("permite %s", (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );

  it("bloquea una redirección hacia localhost", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://localhost/admin" },
      }),
    );
    const r = await fetchPage("https://ok.example/x", {
      lookup: publicLookup,
      fetchImpl,
    });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "blocked",
        message: "Este sitio no deja leer el link. Subí una captura de la página.",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rechaza ftp: y credenciales en la URL", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchPage("ftp://x.example/a", { lookup: publicLookup, fetchImpl })).toMatchObject({
      ok: false,
      error: { code: "blocked" },
    });
    expect(
      await fetchPage("https://u:p@x.example/a", {
        lookup: publicLookup,
        fetchImpl,
      }),
    ).toMatchObject({ ok: false, error: { code: "blocked" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("corta después de 3 redirecciones", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      async () =>
        new Response(null, {
          status: 301,
          headers: { location: "https://ok.example/otra" },
        }),
    );
    expect(
      await fetchPage("https://ok.example/x", {
        lookup: publicLookup,
        fetchImpl,
      }),
    ).toMatchObject({ ok: false });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("un 403 cuenta como bloqueado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 403 }));
    expect(
      await fetchPage("https://ok.example/x", {
        lookup: publicLookup,
        fetchImpl,
      }),
    ).toMatchObject({ ok: false, error: { code: "blocked" } });
  });

  it("devuelve el html y la url final", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(html("<p>Hola</p>"));
    expect(
      await fetchPage("https://ok.example/x", {
        lookup: publicLookup,
        fetchImpl,
      }),
    ).toMatchObject({ ok: true, data: { finalUrl: "https://ok.example/x" } });
  });

  it("corta respuestas de más de 2 MB", async () => {
    const big = "a".repeat(2 * 1024 * 1024 + 10);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(big, { status: 200 }));
    expect(
      await fetchPage("https://ok.example/x", {
        lookup: publicLookup,
        fetchImpl,
      }),
    ).toMatchObject({ ok: false, error: { code: "blocked" } });
  });
});

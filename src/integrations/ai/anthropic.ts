import Anthropic from "@anthropic-ai/sdk";
import { err, ok, type Result } from "@/domain/result";
import { carPrompt, extractJson, imagePrompt, pagePrompt, tripPrompt } from "./prompts";
import { offersNotice, parseCarEstimate, parseOffers, parseTripDraft } from "./schemas";
import { AI_MESSAGES, type TravelAI } from "./types";

type Content = Anthropic.Messages.ContentBlockParam[];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** IA real: API de Claude. Un reintento ante 429/5xx o caída de red. */
export function anthropicAI(apiKey: string, opts: { model?: string; fastModel?: string } = {}): TravelAI {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 90_000 });
  const model = opts.model ?? "claude-sonnet-5-5";
  const fast = opts.fastModel ?? "claude-haiku-5-5";

  async function ask(m: string, content: Content): Promise<Result<unknown>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await client.messages.create({
          model: m,
          max_tokens: 2000,
          messages: [{ role: "user", content }],
        });
        const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        const json = extractJson(text);
        return json === undefined ? err("bad_response", AI_MESSAGES.bad_response) : ok(json);
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        const retriable = status === undefined || status === 429 || status >= 500;
        if (attempt === 0 && retriable) {
          await sleep(1500);
          continue;
        }
        return err("upstream", AI_MESSAGES.upstream);
      }
    }
    return err("upstream", AI_MESSAGES.upstream);
  }

  return {
    async parseTrip(text, today) {
      const r = await ask(fast, [{ type: "text", text: tripPrompt(text, today) }]);
      return r.ok ? ok(parseTripDraft(r.data)) : r;
    },
    async readImage(image, mime, ctx) {
      const media = mime.split(";")[0] as ImageType;
      if (!IMAGE_TYPES.includes(media)) return err("bad_input", "Subí una imagen JPG, PNG, WebP o GIF.");
      const r = await ask(model, [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: media,
            data: image.toString("base64"),
          },
        },
        { type: "text", text: imagePrompt(ctx) },
      ]);
      if (!r.ok) return r;
      const offers = parseOffers(r.data);
      return offers.length ? ok(offers) : err("no_offers", offersNotice(r.data) ?? AI_MESSAGES.no_offers);
    },
    async readPage(text, url, ctx) {
      const r = await ask(model, [{ type: "text", text: pagePrompt(text, url, ctx) }]);
      if (!r.ok) return r;
      const offers = parseOffers(r.data);
      return offers.length
        ? ok(offers)
        : err("no_offers", "No encontré una opción de viaje en esa página. Subí una captura.");
    },
    async estimateCar(a) {
      const r = await ask(model, [{ type: "text", text: carPrompt(a) }]);
      if (!r.ok) return r;
      const est = parseCarEstimate(r.data, a.consumptionLPer100);
      return est ? ok(est) : err("bad_response", "No pude estimar el viaje. Probá de nuevo o cargalo a mano.");
    },
  };
}

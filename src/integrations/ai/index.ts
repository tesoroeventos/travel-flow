import { err } from "@/domain/result";
import { anthropicAI } from "./anthropic";
import { fakeAI } from "./fake";
import { AI_MESSAGES, type TravelAI } from "./types";

export * from "./types";
export { assertAiConfigSafe } from "./guard";

const notConfigured = async () => err("not_configured", AI_MESSAGES.not_configured);
const unconfiguredAI: TravelAI = {
  parseTrip: notConfigured,
  readImage: notConfigured,
  readPage: notConfigured,
  estimateCar: notConfigured,
};

/** La IA según el entorno: simulada (AI_FAKE=1), real (ANTHROPIC_API_KEY) o no configurada. */
export function getAI(): TravelAI {
  if (process.env.AI_FAKE === "1") return fakeAI;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return unconfiguredAI;
  return anthropicAI(key, {
    model: process.env.AI_MODEL || undefined,
    fastModel: process.env.AI_MODEL_FAST || undefined,
  });
}

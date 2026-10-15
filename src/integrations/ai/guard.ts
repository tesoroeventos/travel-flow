/** La IA simulada nunca debe correr en producción. Sin imports: lo usa también scripts/migrate.ts. */
export function assertAiConfigSafe(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production" && env.AI_FAKE === "1") {
    throw new Error("AI_FAKE=1 no está permitido en producción");
  }
}

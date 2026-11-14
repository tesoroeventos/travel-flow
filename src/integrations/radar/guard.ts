/** El radar simulado nunca debe correr en producción. Sin imports: lo usa también scripts/migrate.ts. */
export function assertRadarConfigSafe(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production" && env.RADAR_FAKE === "1") {
    throw new Error("RADAR_FAKE=1 no está permitido en producción");
  }
}

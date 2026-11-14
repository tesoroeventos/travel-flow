/** La búsqueda simulada nunca debe correr en producción. Sin imports: lo usa también scripts/migrate.ts. */
export function assertSearchConfigSafe(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production" && env.SEARCH_FAKE === "1") {
    throw new Error("SEARCH_FAKE=1 no está permitido en producción");
  }
}

/** Memoriza una inicialización asíncrona; si falla, la próxima llamada vuelve a intentar. */
export function memoizeWithRetry<T>(init: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | null = null;
  return () => {
    current ??= init().catch((e) => {
      current = null;
      throw e;
    });
    return current;
  };
}

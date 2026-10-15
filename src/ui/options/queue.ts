/** Limitador: corre como máximo `max` trabajos a la vez; el resto espera su turno. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const go = waiting.shift();
    if (go) {
      active++;
      go();
    }
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

/** Procesa todos los elementos con hasta `concurrency` a la vez. Un error no corta a los demás. */
export async function runQueue<T>(
  items: T[],
  worker: (t: T) => Promise<void>,
  concurrency = 2,
): Promise<void> {
  const run = createLimiter(concurrency);
  await Promise.all(
    items.map((it) => run(() => worker(it)).catch(() => undefined)),
  );
}

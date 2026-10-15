import { describe, expect, it } from "vitest";
import { createLimiter, runQueue } from "./queue";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("cola de lecturas", () => {
  it("nunca más de 2 a la vez y procesa todo", async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await runQueue([1, 2, 3, 4, 5], async (n) => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      done.push(n);
      running--;
    });
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("un limitador compartido respeta el máximo entre tandas", async () => {
    const run = createLimiter(2);
    let running = 0;
    let peak = 0;
    const job = async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
    };
    await Promise.all([run(job), run(job), run(job), run(job)]);
    expect(peak).toBe(2);
  });

  it("si un trabajo falla, los demás siguen", async () => {
    const done: number[] = [];
    await runQueue([1, 2, 3], async (n) => {
      if (n === 2) throw new Error("x");
      done.push(n);
    });
    expect(done.sort()).toEqual([1, 3]);
  });
});

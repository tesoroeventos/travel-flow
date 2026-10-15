"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ProposalTag } from "@/domain/decision/proposals";
import { swapHref } from "./swaps";

const select =
  "min-h-12 w-full rounded-xl border-[1.5px] border-line bg-surface-2 px-3";
const label =
  "mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase";

/** "Cambiar algo": elige otro transporte u otro alojamiento para una tarjeta. El ajuste vive en la URL. */
export function SwapPanel({
  tag,
  plans,
  lodgings,
  plan,
  lodging,
  adjusted,
}: {
  tag: ProposalTag;
  plans: string[];
  lodgings: string[];
  plan: number;
  lodging: number;
  adjusted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const go = (v: { plan: number; lodging: number }) =>
    router.replace(swapHref(path, new URLSearchParams(sp.toString()), tag, v), {
      scroll: false,
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2">
        <button
          type="button"
          className="min-h-11 font-bold text-route underline underline-offset-4"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Listo" : "Cambiar algo"}
        </button>
        {adjusted ? (
          <>
            <span aria-hidden className="text-ink-soft">
              ·
            </span>
            <Link
              href={swapHref(
                path,
                new URLSearchParams(sp.toString()),
                tag,
                null,
              )}
              scroll={false}
              replace
              className="min-h-11 content-center font-bold text-route underline underline-offset-4"
            >
              Volver a la propuesta
            </Link>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`sw-p-${tag}`} className={label}>
              Transporte
            </label>
            <select
              id={`sw-p-${tag}`}
              className={select}
              value={plan}
              onChange={(e) => go({ plan: Number(e.target.value), lodging })}
            >
              {plans.map((p, i) => (
                <option key={i} value={i}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={`sw-l-${tag}`} className={label}>
              Alojamiento
            </label>
            <select
              id={`sw-l-${tag}`}
              className={select}
              value={lodging}
              onChange={(e) => go({ plan, lodging: Number(e.target.value) })}
            >
              {lodgings.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

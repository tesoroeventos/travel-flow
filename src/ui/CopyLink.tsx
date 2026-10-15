"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}${path}`;
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={url} aria-label="Enlace para compartir" className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm" />
      <button
        type="button"
        className="min-h-11 rounded-md border border-line-strong px-3 font-semibold"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

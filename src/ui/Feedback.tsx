import type { ReactNode } from "react";

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-alert/40 bg-alert-soft px-3 py-2 text-ink">
      {children}
    </div>
  );
}

export function NoticeBanner({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-signal/50 bg-signal-soft px-3 py-2 text-ink">{children}</div>;
}

export function DemoBanner() {
  return (
    <div className="border-b border-signal/50 bg-signal-soft px-4 py-2 text-center text-sm font-semibold text-ink" role="status">
      Precios ficticios
      <span className="font-normal text-ink-soft"> — viaje de demostración, los importes no son reales.</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-prose text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

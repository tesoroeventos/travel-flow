import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/** Opción como pasaje: ícono o miniatura, datos y talón troquelado con el precio. */
export function Ticket({
  icon,
  thumb,
  kind,
  title,
  meta,
  when,
  detail,
  flag,
  price,
  priceNote,
  actions,
  footer,
  children,
  id,
  label,
}: {
  icon: IconName;
  thumb?: string | null;
  kind: string;
  title: string;
  meta?: string;
  when?: string;
  detail?: string;
  flag?: ReactNode;
  price: ReactNode;
  priceNote?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  id?: string;
  label?: string;
}) {
  return (
    <article className="ticket" id={id} aria-label={label ?? title}>
      <div className="py-3.5 pl-3.5">
        <div className="grid size-13 place-items-center overflow-hidden rounded-xl bg-route-soft text-route">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="size-full object-cover object-top"
            />
          ) : (
            <Icon name={icon} className="size-6" />
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-3.5">
        <p className="text-xs font-bold tracking-wider text-route uppercase">
          {kind}
        </p>
        <h3 className="font-display text-lg leading-tight font-bold [overflow-wrap:anywhere]">
          {title}
        </h3>
        {meta ? (
          <p className="text-sm text-ink-soft [overflow-wrap:anywhere]">
            {meta}
          </p>
        ) : null}
        {when ? <p className="text-[0.95rem] font-semibold">{when}</p> : null}
        {detail ? (
          <p className="text-sm text-ink-soft [overflow-wrap:anywhere]">
            {detail}
          </p>
        ) : null}
        {flag}
        {children}
      </div>
      <div className="ticket-stub flex min-w-32 flex-row items-center justify-between gap-2 px-3.5 py-2.5 min-[520px]:flex-col min-[520px]:items-end min-[520px]:py-3.5 min-[520px]:pl-4.5">
        <div className="mr-auto min-[520px]:mr-0 min-[520px]:text-right">
          <div className="num font-display text-xl font-extrabold whitespace-nowrap">
            {price}
          </div>
          {priceNote ? (
            <p className="text-xs text-ink-soft">{priceNote}</p>
          ) : null}
        </div>
        {actions ? <div className="flex gap-0.5">{actions}</div> : null}
      </div>
      {footer ? (
        <div className="ticket-row perforated p-3.5">{footer}</div>
      ) : null}
    </article>
  );
}

/** Marca "Revisá: …" para datos que la IA supuso. */
export function DoubtFlag({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-signal-soft px-2.5 py-0.5 text-sm font-bold text-signal">
      <Icon name="alert" className="size-4" />
      Revisá: {items.join(", ")}
    </span>
  );
}

import { chooseProposalAction } from "@/server/actions/quick";
import type { ProposalView } from "@/server/services/proposals";
import type { ProposalTag } from "@/domain/decision/proposals";
import { SubmitButton } from "../Button";
import { fmtMoney } from "../format";
import { Icon, type IconName } from "../icons";
import { SwapPanel } from "./SwapPanel";

export const TAG_TITLE: Record<ProposalTag, string> = {
  barata: "La más barata",
  rapida: "La más rápida",
  comoda: "La más cómoda",
};

export function fmtTravel(min: number | null): string {
  if (min === null) return "Sin horarios";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export interface PieceIcon {
  id: string;
  icon: IconName;
}

export function ProposalCard({
  tripId,
  view,
  currency,
  icons,
  planLabels,
  lodgingLabels,
  planIndex,
  lodgingIndex,
  readOnly = false,
}: {
  tripId: string;
  view: ProposalView;
  currency: string;
  icons: Record<string, IconName>;
  planLabels: string[];
  lodgingLabels: string[];
  planIndex: number;
  lodgingIndex: number;
  readOnly?: boolean;
}) {
  const title = view.tags.map((t, i) => (i === 0 ? TAG_TITLE[t] : TAG_TITLE[t].toLowerCase())).join(" y ");
  const diff = view.budgetDiffCents;
  const choose = chooseProposalAction.bind(null, tripId, {
    legIds: view.combo.legIds,
    lodgingId: view.combo.lodgingId,
    name: view.adjusted ? `${TAG_TITLE[view.tags[0]!]} (ajustada)` : TAG_TITLE[view.tags[0]!],
  });
  return (
    <article aria-label={title} className="overflow-hidden rounded-3xl bg-surface shadow-card">
      <div className="flex flex-col gap-1.5 px-4.5 pt-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {view.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-ink px-2.5 py-1 text-xs font-extrabold tracking-wide text-paper uppercase"
            >
              {TAG_TITLE[t]}
            </span>
          ))}
          {view.adjusted ? (
            <span className="rounded-full bg-signal-soft px-2.5 py-1 text-xs font-extrabold tracking-wide text-signal uppercase">
              Ajustada
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="num font-display text-3xl font-extrabold">{fmtMoney(view.costCents, currency)}</span>
          <span className="text-ink-soft">{fmtMoney(view.perPersonCents, currency)} por persona</span>
        </div>
        <p className="text-ink-soft">{view.why}</p>
      </div>
      <dl className="perforated grid grid-cols-3">
        <div className="flex min-w-0 flex-col gap-0.5 px-3 py-3 sm:px-4.5">
          <dt className="text-[0.68rem] font-bold tracking-wider text-ink-soft uppercase sm:text-xs">Viaje total</dt>
          <dd className="num font-bold">{fmtTravel(view.combo.minutes)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 border-l border-line px-3 py-3 sm:px-4.5">
          <dt className="text-[0.68rem] font-bold tracking-wider text-ink-soft uppercase sm:text-xs">Confort</dt>
          <dd className="num font-bold">{(Math.round(view.combo.comfort * 10) / 10).toLocaleString("es-AR")} de 5</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 border-l border-line px-3 py-3 sm:px-4.5">
          <dt className="text-[0.68rem] font-bold tracking-wider text-ink-soft uppercase sm:text-xs">Presupuesto</dt>
          <dd
            className={`num font-bold [overflow-wrap:anywhere] ${diff === null ? "" : diff >= 0 ? "text-route" : "text-alert"}`}
          >
            {diff === null
              ? "Sin cargar"
              : diff >= 0
                ? `Sobran ${fmtMoney(diff, currency)}`
                : `Faltan ${fmtMoney(-diff, currency)}`}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col px-4.5 pt-1">
        {view.pieces.map((p) => (
          <li
            key={`${p.ownerType}:${p.id}`}
            className="flex min-w-0 items-center gap-2.5 border-t border-line py-2.5 first:border-t-0"
          >
            <Icon name={icons[p.id] ?? "ticket"} className="size-5 text-route" />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {p.label}
              {p.detail ? <small className="block text-sm text-ink-soft">{p.detail}</small> : null}
            </div>
            <div className="num font-bold whitespace-nowrap">
              {p.costCents === null ? "" : fmtMoney(p.costCents, currency)}
            </div>
          </li>
        ))}
      </ul>
      {readOnly ? (
        <div className="pb-2" />
      ) : (
        <div className="flex flex-col gap-3 px-4.5 pt-2 pb-4">
          <SwapPanel
            tag={view.tags[0]!}
            plans={planLabels}
            lodgings={lodgingLabels}
            plan={planIndex}
            lodging={lodgingIndex}
            adjusted={view.adjusted}
          />
          <form action={choose}>
            <SubmitButton className="w-full" pendingText="Eligiendo…">
              Elegir esta
              <Icon name="arrow" />
            </SubmitButton>
          </form>
        </div>
      )}
    </article>
  );
}

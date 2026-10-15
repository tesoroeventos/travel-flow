"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  carAction,
  deleteOfferAction,
  inProposalsAction,
  manualOfferAction,
  readImageAction,
  readLinkAction,
  updateOfferAction,
  usdRateAction,
} from "@/server/actions/quick";
import type { OfferCard, OfferEdit } from "@/server/services/offers";
import { Button } from "../Button";
import { Icon, type IconName } from "../icons";
import { Note } from "../Note";
import { DoubtFlag, Ticket } from "../Ticket";
import { OfferEditor } from "./OfferEditor";
import { createLimiter } from "./queue";
import { shrinkImage } from "./resize";

export interface BoardStatus {
  missing: string[];
  comboCount: number;
  needsUsdRate: boolean;
}

interface Job {
  id: string;
  file: File;
  name: string;
  thumb: string;
  status: "cola" | "leyendo" | "error";
  msg: string;
}

const GROUPS: [OfferCard["group"], string][] = [
  ["ida", "Ida"],
  ["vuelta", "Vuelta"],
  ["ida_y_vuelta", "Ida y vuelta"],
  ["alojamiento", "Alojamiento"],
  ["destino", "En destino"],
];
const ICON: Record<OfferCard["kind"], IconName> = {
  vuelo: "plane",
  micro: "bus",
  tren: "train",
  auto_propio: "car",
  auto_alquiler: "key",
  alojamiento: "bed",
  actividad: "ticket",
  otro: "ticket",
};
const KIND_LABEL: Record<OfferCard["kind"], string> = {
  vuelo: "Vuelo",
  micro: "Micro",
  tren: "Tren",
  auto_propio: "Tu auto",
  auto_alquiler: "Auto de alquiler",
  alojamiento: "Alojamiento",
  actividad: "Actividad",
  otro: "Otro gasto",
};
const DOUBT_LABEL: Record<string, string> = {
  price: "precio",
  depart: "horario de salida",
  arrive: "horario de llegada",
  direction: "ida o vuelta",
  basis: "cómo se cobra",
  durationMin: "duración",
  name: "nombre",
  kind: "tipo",
  currency: "moneda",
  stops: "escalas",
  fuelPrice: "precio de la nafta",
  tolls: "peajes",
};
const GROUP_SUFFIX: Partial<Record<OfferCard["group"], string>> = {
  ida: "Ida",
  vuelta: "Vuelta",
  ida_y_vuelta: "Ida y vuelta",
};
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const nf = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});
const money = (cents: number, currency: string) =>
  currency === "ARS"
    ? nf.format(cents / 100).replace(/\s/g, " ")
    : `${currency} ${(cents / 100).toLocaleString("es-AR")}`;
const limiter = createLimiter(2);
const uid = () => Math.random().toString(36).slice(2, 10);

export function OptionsBoard({
  tripId,
  cards,
  status,
  hasOrigin,
}: {
  tripId: string;
  cards: OfferCard[];
  status: BoardStatus;
  hasOrigin: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{
    tone: "info" | "warn";
    text: string;
  } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [carOpen, setCarOpen] = useState(false);
  const [carBusy, setCarBusy] = useState(false);
  const [carErr, setCarErr] = useState<string | null>(null);
  const [usdErr, setUsdErr] = useState<string | null>(null);
  const [manualKind, setManualKind] = useState("vuelo");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const patchJob = (id: string, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const readJob = useCallback(
    (job: Job) =>
      limiter(async () => {
        patchJob(job.id, { status: "leyendo", msg: "" });
        try {
          const blob = await shrinkImage(job.file);
          const fd = new FormData();
          fd.set(
            "image",
            new File([blob], job.name.replace(/\.\w+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""), {
              type: blob.type || job.file.type,
            }),
          );
          fd.set("name", job.name);
          const r = await readImageAction(tripId, fd);
          if (r.ok) {
            setJobs((js) => js.filter((j) => j.id !== job.id));
            URL.revokeObjectURL(job.thumb);
            refresh();
          } else patchJob(job.id, { status: "error", msg: r.error.message });
        } catch {
          patchJob(job.id, {
            status: "error",
            msg: "Se cortó la conexión. Tocá Reintentar.",
          });
        }
      }),
    [tripId, refresh],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const imgs = [...list].filter((f) => ACCEPT.split(",").includes(f.type));
      if (!imgs.length) {
        setLinkMsg({
          tone: "warn",
          text: "Subí imágenes: capturas en JPG o PNG.",
        });
        return;
      }
      const fresh = imgs.slice(0, 10).map<Job>((f) => ({
        id: uid(),
        file: f,
        name: f.name || "captura",
        thumb: URL.createObjectURL(f),
        status: "cola",
        msg: "",
      }));
      setJobs((js) => [...js, ...fresh]);
      for (const j of fresh) void readJob(j);
    },
    [readJob],
  );

  const readLink = useCallback(
    async (url: string) => {
      setLinkBusy(true);
      setLinkMsg({ tone: "info", text: "Leyendo el link…" });
      try {
        const r = await readLinkAction(tripId, url);
        if (r.ok) {
          setLinkMsg(null);
          refresh();
        } else setLinkMsg({ tone: "warn", text: r.error.message });
      } catch {
        setLinkMsg({
          tone: "warn",
          text: "No se pudo leer ahora. Probá de nuevo en un rato.",
        });
      } finally {
        setLinkBusy(false);
      }
    },
    [tripId, refresh],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      const target = e.target as HTMLElement | null;
      if (/^https?:\/\//i.test(text) && !target?.closest("input,textarea,select")) {
        e.preventDefault();
        void readLink(text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles, readLink]);

  async function saveEdit(card: OfferCard, edit: OfferEdit): Promise<string | null> {
    const r = await updateOfferAction(tripId, { ownerType: card.ownerType, id: card.id }, edit);
    if (!r.ok) return r.error.message;
    setEditing(null);
    refresh();
    return null;
  }

  async function addManual(fromJob?: Job) {
    const saved = await manualOfferAction(tripId, manualKind);
    if (fromJob) setJobs((js) => js.filter((j) => j.id !== fromJob.id));
    setEditing(saved.id);
    refresh();
  }

  async function runCar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setCarBusy(true);
    setCarErr(null);
    const r = await carAction(tripId, String(f.get("model") ?? ""), String(f.get("consumption") ?? ""));
    setCarBusy(false);
    if (!r.ok) setCarErr(r.error.message);
    else {
      setCarOpen(false);
      refresh();
    }
  }

  async function saveUsd(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const v = String(new FormData(ev.currentTarget).get("usd") ?? "");
    const r = await usdRateAction(tripId, v);
    if (!r.ok) setUsdErr(r.error.message);
    else {
      setUsdErr(null);
      refresh();
    }
  }

  const reading = jobs.filter((j) => j.status !== "error").length;
  const ready = status.missing.length === 0 && status.comboCount > 0;

  return (
    <div className="flex flex-col gap-5 pb-32">
      <label
        htmlFor="shots"
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-route ${
          over ? "border-route bg-route-soft" : "border-route/50 bg-route-soft/50 hover:bg-route-soft"
        }`}
      >
        <Icon name="upload" className="size-10 text-route" />
        <span className="font-display text-xl font-bold">Soltá acá tus capturas</span>
        <span className="text-ink-soft">
          o tocá para elegirlas. Vuelos, micros, hoteles, alquileres: podés subir varias juntas.
        </span>
        <span className="hidden text-sm text-ink-soft md:block">También podés pegarlas con Ctrl+V.</span>
        <input
          id="shots"
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          aria-label="Elegir capturas"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <form
          className="flex min-w-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("url") ?? "").trim();
            if (v) void readLink(v);
          }}
        >
          <input
            name="url"
            type="url"
            inputMode="url"
            aria-label="Link de una opción"
            placeholder="Pegá un link de Despegar, Booking…"
            className="min-h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-surface px-3"
          />
          <Button type="submit" variant="secondary" disabled={linkBusy} aria-label="Leer link">
            <Icon name="link" />
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setCarOpen((o) => !o)} className="flex-1">
            <Icon name="car" />
            Uso mi auto
          </Button>
          <div className="flex flex-1 gap-1">
            <label htmlFor="manual-kind" className="sr-only">
              Qué querés cargar
            </label>
            <select
              id="manual-kind"
              value={manualKind}
              onChange={(e) => setManualKind(e.target.value)}
              className="min-h-12 rounded-xl border-[1.5px] border-line bg-surface px-2"
            >
              <option value="vuelo">Vuelo</option>
              <option value="micro">Micro</option>
              <option value="tren">Tren</option>
              <option value="alojamiento">Alojamiento</option>
              <option value="actividad">Actividad</option>
              <option value="auto_alquiler">Auto de alquiler</option>
              <option value="otro">Otro gasto</option>
            </select>
            <Button type="button" variant="secondary" onClick={() => void addManual()}>
              <Icon name="plus" />A mano
            </Button>
          </div>
        </div>
      </div>
      {linkMsg ? <Note tone={linkMsg.tone}>{linkMsg.text}</Note> : null}

      {carOpen ? (
        <form
          onSubmit={runCar}
          className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card"
          aria-label="Tu auto"
        >
          <h2 className="font-display text-lg font-bold">Tu auto</h2>
          {hasOrigin ? (
            <p className="text-ink-soft">Calculo distancia, nafta, peajes y horas de manejo, ida y vuelta.</p>
          ) : (
            <Note tone="warn">
              Falta desde dónde salís.{" "}
              <Link href={`/viajes/${tripId}/editar`} className="font-bold underline">
                Completalo en los datos del viaje
              </Link>
              .
            </Note>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="car-model"
                className="mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase"
              >
                Modelo
              </label>
              <input
                id="car-model"
                name="model"
                autoComplete="off"
                placeholder="Ej.: Peugeot 208 1.6"
                className="min-h-12 w-full rounded-xl border-[1.5px] border-line bg-surface-2 px-3"
              />
            </div>
            <div>
              <label
                htmlFor="car-cons"
                className="mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase"
              >
                Consumo (opcional)
              </label>
              <input
                id="car-cons"
                name="consumption"
                inputMode="decimal"
                placeholder="Litros cada 100 km"
                className="min-h-12 w-full rounded-xl border-[1.5px] border-line bg-surface-2 px-3"
              />
            </div>
          </div>
          {carErr ? (
            <p className="font-semibold text-alert" role="alert">
              {carErr}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCarOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={carBusy || !hasOrigin}>
              {carBusy ? "Calculando…" : "Calcular"}
            </Button>
          </div>
        </form>
      ) : null}

      {status.needsUsdRate ? (
        <form onSubmit={saveUsd} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <h2 className="font-display text-lg font-bold">Hay precios en dólares</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="usd" className="mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase">
                ¿A cuánto tomás el dólar?
              </label>
              <input
                id="usd"
                name="usd"
                inputMode="decimal"
                aria-label="Pesos por dólar"
                placeholder="Pesos por dólar"
                className="min-h-12 w-full rounded-xl border-[1.5px] border-line bg-surface-2 px-3"
              />
            </div>
            <Button type="submit">Guardar dólar</Button>
          </div>
          <p className="text-sm text-ink-soft">Lo uso para pasar todo a pesos y poder comparar.</p>
          {usdErr ? (
            <p className="font-semibold text-alert" role="alert">
              {usdErr}
            </p>
          ) : null}
        </form>
      ) : null}

      {jobs.length ? (
        <section className="flex flex-col gap-2.5" aria-label="Capturas en lectura">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink-soft uppercase after:h-px after:flex-1 after:bg-line">
            Leyendo capturas
          </h2>
          {jobs.map((j) =>
            j.status === "error" ? (
              <Ticket
                key={j.id}
                icon="ticket"
                thumb={j.thumb}
                kind="No se pudo leer"
                title={j.name}
                detail={j.msg}
                price=""
                label={`Captura ${j.name}`}
              >
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-10 px-3 text-sm"
                    onClick={() => void readJob(j)}
                  >
                    Reintentar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-10 px-3 text-sm"
                    onClick={() => void addManual(j)}
                  >
                    Cargar a mano
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 px-3 text-sm"
                    onClick={() => setJobs((js) => js.filter((x) => x.id !== j.id))}
                  >
                    Quitar
                  </Button>
                </div>
              </Ticket>
            ) : (
              <Ticket
                key={j.id}
                icon="ticket"
                thumb={j.thumb}
                kind={j.status === "cola" ? "En espera" : "Leyendo…"}
                title={j.name}
                price=""
                label={`Captura ${j.name}`}
              >
                <div className="shimmer mt-1 w-3/4" aria-hidden />
              </Ticket>
            ),
          )}
        </section>
      ) : null}

      {GROUPS.map(([g, title]) => {
        const items = cards.filter((c) => c.group === g);
        if (!items.length) return null;
        return (
          <section key={g} className="flex flex-col gap-2.5">
            <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink-soft uppercase after:h-px after:flex-1 after:bg-line">
              {title}
            </h2>
            {items.map((c) => {
              const missingPrice = c.totalCents === null && c.edit.price == null && c.kind !== "auto_propio";
              const doubts = c.doubtful.map((d) => DOUBT_LABEL[d]).filter((x): x is string => Boolean(x));
              return (
                <Ticket
                  key={c.id}
                  id={`op-${c.id}`}
                  icon={ICON[c.kind]}
                  kind={`${KIND_LABEL[c.kind]}${GROUP_SUFFIX[c.group] && c.kind !== "auto_propio" ? ` · ${GROUP_SUFFIX[c.group]}` : c.kind === "auto_propio" ? " · Ida y vuelta" : ""}`}
                  title={c.name || "Sin nombre"}
                  meta={[c.company, c.route].filter(Boolean).join(" · ")}
                  when={c.when}
                  detail={[c.score, c.detail].filter(Boolean).join(" · ")}
                  flag={doubts.length ? <DoubtFlag items={doubts} /> : null}
                  price={
                    missingPrice ? (
                      <span className="text-base text-signal">Falta el precio</span>
                    ) : c.totalCents === null && c.edit.price != null ? (
                      <span className="text-base">{`US$ ${c.edit.price.toLocaleString("es-AR")}`}</span>
                    ) : c.totalCents !== null ? (
                      money(c.totalCents, c.currency)
                    ) : (
                      ""
                    )
                  }
                  priceNote={c.priceNote}
                  actions={
                    <>
                      <button
                        type="button"
                        className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-paper hover:text-ink"
                        aria-label="Editar"
                        onClick={() => setEditing((e) => (e === c.id ? null : c.id))}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-paper hover:text-alert"
                        aria-label="Quitar"
                        onClick={async () => {
                          await deleteOfferAction(tripId, {
                            ownerType: c.ownerType,
                            id: c.id,
                          });
                          refresh();
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </>
                  }
                  footer={
                    editing === c.id ? (
                      <OfferEditor card={c} onSave={(edit) => saveEdit(c, edit)} onCancel={() => setEditing(null)} />
                    ) : null
                  }
                >
                  {c.inProposals !== null && c.ownerType !== "lodging_option" ? (
                    <label className="mt-1 flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-soft">
                      <input
                        type="checkbox"
                        className="size-5 accent-route"
                        defaultChecked={c.inProposals}
                        onChange={async (e) => {
                          await inProposalsAction(
                            tripId,
                            {
                              ownerType: c.ownerType as "transport_option" | "activity",
                              id: c.id,
                            },
                            e.target.checked,
                          );
                          refresh();
                        }}
                      />
                      Sumar a las 3 opciones
                    </label>
                  ) : null}
                </Ticket>
              );
            })}
          </section>
        );
      })}

      {!cards.length && !jobs.length ? (
        <Note>
          Para comparar necesito <b>cómo vas y cómo volvés</b> y, si dormís allá, <b>dónde te alojás</b>. Subí capturas
          de 2 o 3 transportes y 2 alojamientos.
        </Note>
      ) : null}

      <div className="no-print fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface shadow-[0_-6px_20px_rgb(0_0_0/0.08)] md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-44 flex-1 text-[0.95rem]" role="status">
            {reading ? `Leyendo ${reading} captura${reading > 1 ? "s" : ""}… ` : ""}
            {ready ? (
              <>
                <b>Listo.</b> {status.comboCount}{" "}
                {status.comboCount === 1 ? "combinación posible." : "combinaciones posibles."}
              </>
            ) : (
              `Para comparar falta ${status.missing.join(", ")}.`
            )}
          </p>
          {ready ? (
            <Link
              href={`/viajes/${tripId}/propuestas`}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-route px-5 font-bold text-route-ink hover:brightness-110"
            >
              Ver mis 3 opciones
              <Icon name="arrow" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-12 cursor-not-allowed items-center gap-2 rounded-xl bg-route px-5 font-bold text-route-ink opacity-50"
            >
              Ver mis 3 opciones
              <Icon name="arrow" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

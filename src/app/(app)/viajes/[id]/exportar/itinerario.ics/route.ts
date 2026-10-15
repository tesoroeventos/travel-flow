import { getDb } from "@/server/db";
import { getCtx } from "@/server/auth/session";
import { NotFoundError } from "@/server/context";
import { exportItineraryIcs } from "@/server/services/exports";

export async function GET(_req: Request, { params }: RouteContext<"/viajes/[id]/exportar/itinerario.ics">) {
  const ctx = await getCtx();
  if (!ctx) return new Response(null, { status: 302, headers: { Location: "/login" } });
  const { id } = await params;
  try {
    const file = await exportItineraryIcs(await getDb(), ctx, id);
    if (!file) return new Response("Elegí un escenario para generar el itinerario.", { status: 404 });
    return new Response(file.body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response("No encontrado", { status: 404 });
    throw e;
  }
}

import { getDb } from "@/server/db";
import { getCtx } from "@/server/auth/session";
import { NotFoundError } from "@/server/context";
import { exportBudgetCsv } from "@/server/services/exports";

export async function GET(req: Request, { params }: RouteContext<"/viajes/[id]/exportar/presupuesto.csv">) {
  const ctx = await getCtx();
  if (!ctx) return new Response(null, { status: 302, headers: { Location: "/login" } });
  const { id } = await params;
  try {
    const file = await exportBudgetCsv(await getDb(), ctx, id, new URL(req.url).searchParams.get("escenario"));
    if (!file) return new Response("Este viaje no tiene escenarios para exportar.", { status: 404 });
    return new Response(file.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response("No encontrado", { status: 404 });
    throw e;
  }
}

import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { getDb } from "@/server/db";
import { getDemoShareToken } from "@/server/services/demo";

export const metadata = { title: "Ingresar · TravelFlow" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const demo = await getDemoShareToken(await getDb());
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Ingresar</h1>
      <LoginForm next={typeof next === "string" ? next : "/"} />
      <p className="mt-6 text-ink-soft">
        ¿Tenés un código de invitación?{" "}
        <Link href={`/registro${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-route underline">
          Creá tu cuenta
        </Link>
      </p>
      {demo ? (
        <p className="mt-3 text-ink-soft">
          <Link href={`/share/${demo}`} className="font-semibold text-route underline">
            Ver un viaje de ejemplo
          </Link>{" "}
          sin crear cuenta.
        </p>
      ) : null}
    </>
  );
}

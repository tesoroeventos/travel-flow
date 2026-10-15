import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar · TravelFlow" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
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
    </>
  );
}

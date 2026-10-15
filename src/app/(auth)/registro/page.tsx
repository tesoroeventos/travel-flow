import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Crear cuenta · TravelFlow" };

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const { next, code } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 text-ink-soft">TravelFlow está en beta cerrada. Necesitás un código de invitación.</p>
      <RegisterForm next={typeof next === "string" ? next : "/"} code={typeof code === "string" ? code : ""} />
      <p className="mt-6 text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-route underline">
          Ingresá
        </Link>
      </p>
    </>
  );
}

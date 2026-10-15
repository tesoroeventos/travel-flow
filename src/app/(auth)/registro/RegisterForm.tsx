"use client";

import { useActionState } from "react";
import { registerAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form";
import { Field } from "@/ui/Field";
import { SubmitButton } from "@/ui/Button";
import { ErrorBanner } from "@/ui/Feedback";

export function RegisterForm({ next, code }: { next: string; code: string }) {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <Field label="Código de invitación" name="inviteCode" required autoCapitalize="characters" defaultValue={v.inviteCode ?? code} error={e.inviteCode} />
      <Field label="Nombre" name="name" autoComplete="name" required defaultValue={v.name} error={e.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <Field label="Contraseña" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Al menos 8 caracteres" error={e.password} />
      <SubmitButton className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}

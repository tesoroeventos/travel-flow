"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form";
import { Field } from "@/ui/Field";
import { SubmitButton } from "@/ui/Button";
import { ErrorBanner } from "@/ui/Feedback";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <SubmitButton className="w-full" pendingText="Ingresando…">
        Ingresar
      </SubmitButton>
    </form>
  );
}

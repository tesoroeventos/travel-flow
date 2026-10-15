"use client";

import { useActionState, useEffect } from "react";
import { createScenarioAction } from "@/server/actions/scenarios";
import type { FormState } from "@/server/actions/form";
import { Field } from "../Field";
import { Button, SubmitButton } from "../Button";
import { useCloseDisclosure } from "../Disclosure";

export function NewScenario({ tripId, suggested }: { tripId: string; suggested: string }) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(createScenarioAction.bind(null, tripId), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  return (
    <form action={action} aria-label="Nuevo escenario" className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface shadow-card p-4">
      <Field className="min-w-48 flex-1" label="Nombre del escenario" name="name" defaultValue={suggested} placeholder="Avión + hotel céntrico" />
      <SubmitButton>Crear escenario</SubmitButton>
      <Button type="button" variant="ghost" onClick={close}>
        Cancelar
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { saveBookingAction } from "@/server/actions/bookings";
import type { FormState } from "@/server/actions/form";
import { Field, SelectField } from "./Field";
import { SubmitButton } from "./Button";

export const BOOKING_LABELS = { selected: "Alternativa seleccionada", booking_pending: "Reserva pendiente", booking_confirmed: "Reserva confirmada" } as const;
export const PAYMENT_LABELS = { payment_pending: "Pago pendiente", paid: "Pago realizado" } as const;

export function BookingRow({
  tripId,
  booking,
}: {
  tripId: string;
  booking: { id: string; bookingStatus: keyof typeof BOOKING_LABELS; paymentStatus: keyof typeof PAYMENT_LABELS; confirmationCode: string | null };
}) {
  const [state, action] = useActionState<FormState, FormData>(saveBookingAction.bind(null, tripId, booking.id), {});
  return (
    <form action={action} className="mt-2 grid grid-cols-2 gap-2">
      <SelectField label="Estado de reserva" name="bookingStatus" options={Object.entries(BOOKING_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={booking.bookingStatus} />
      <SelectField label="Estado de pago" name="paymentStatus" options={Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={booking.paymentStatus} />
      <Field className="col-span-2" label="Código de confirmación" name="confirmationCode" defaultValue={booking.confirmationCode ?? ""} />
      <div className="col-span-2 flex items-center gap-3">
        <SubmitButton variant="secondary">Guardar estado</SubmitButton>
        {state.ok ? <span className="text-sm text-ok" role="status">Guardado</span> : null}
      </div>
    </form>
  );
}

"use server";

import { redirect } from "next/navigation";
import { getDb } from "../db";
import { register, verifyLogin } from "../auth/register";
import { createSession, deleteSession } from "../auth/session";
import { loginSchema, registerSchema } from "../validation/auth";
import { formObject, formValues, invalid, type FormState } from "./form";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  const r = await register(await getDb(), parsed.data);
  if (!r.ok) {
    const field = r.error.code === "email_taken" ? "email" : "inviteCode";
    return { ok: false, message: r.error.message, fieldErrors: { [field]: r.error.message }, values: formValues(fd) };
  }
  await createSession(r.data);
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  const r = await verifyLogin(await getDb(), parsed.data.email, parsed.data.password);
  if (!r.ok) return { ok: false, message: r.error.message, values: { email: parsed.data.email } };
  await createSession(r.data);
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

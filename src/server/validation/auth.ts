import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Ingresá tu nombre"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Email inválido")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Ingresá tu código de invitación"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

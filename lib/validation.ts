import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
export const petSchema = z.object({
  name: text(80).min(1, 'Escribe el nombre de tu mascota.'),
  species: z.enum(['Perro', 'Gato', 'Conejo', 'Ave', 'Otro']),
  breed: text(100),
  sex: z.enum(['Macho', 'Hembra', 'No especificado']),
  color: text(100),
  ownerName: text(120).min(2, 'Escribe el nombre del dueño.'),
  phone: text(25).regex(/^\+[1-9][0-9]{7,14}$/, 'Usa el código de país, por ejemplo +51987654321.'),
  address: text(250),
  district: text(150).min(2, 'Escribe el distrito o ciudad.'),
  notes: text(600),
});
export const authSchema = z.object({
  email: z
    .email('Escribe un correo válido.')
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres.').max(128),
});
export const forgotPasswordSchema = z.object({
  email: z
    .email('Escribe un correo válido.')
    .max(254)
    .transform((v) => v.toLowerCase()),
});
export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(32, 'El enlace no es válido.')
      .max(128, 'El enlace no es válido.')
      .regex(/^[A-Za-z0-9_-]+$/, 'El enlace no es válido.'),
    password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres.').max(128),
    confirmation: z.string().max(128),
  })
  .refine((value) => value.password === value.confirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmation'],
  });
export const idSchema = z.uuid();
export const yapePaymentSchema = z.object({
  operationNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, 'Escribe el número de operación de Yape (entre 6 y 20 dígitos).'),
});
export const yapePaymentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
export type PetInput = z.infer<typeof petSchema>;
export type Pet = PetInput & { id: string; hasPhoto: boolean; createdAt: string };

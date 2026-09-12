import { z } from "zod";

const emailSchema = z.string().email("Email inválido.").max(255);
const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(200);

export const signupSchema = z.object({
  organizationName: z
    .string()
    .min(2, "O nome da organização precisa ter pelo menos 2 caracteres.")
    .max(120),
  name: z.string().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(120).optional(),
  role: z.enum(["ADMIN", "GESTOR", "LIDER", "MEMBRO", "CONVIDADO"]),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "GESTOR", "LIDER", "MEMBRO", "CONVIDADO"]),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

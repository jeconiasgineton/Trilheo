import { z } from "zod";

const idSchema = z.string().min(1);
const titleSchema = z.string().min(2, "O título precisa ter pelo menos 2 caracteres.").max(200);
const money = z.number().min(0, "Não pode ser negativo.");

export const createBusinessCaseSchema = z.object({
  ideaId: idSchema,
  title: titleSchema,
  description: z.string().max(5000).optional(),
  capex: money,
  opexMonthly: money,
  benefitMonthly: money,
  horizonMonths: z.number().int().min(1).max(120),
});
export type CreateBusinessCaseInput = z.infer<typeof createBusinessCaseSchema>;

export const updateBusinessCaseSchema = z.object({
  id: idSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).nullable().optional(),
  capex: money.optional(),
  opexMonthly: money.optional(),
  benefitMonthly: money.optional(),
  horizonMonths: z.number().int().min(1).max(120).optional(),
});
export type UpdateBusinessCaseInput = z.infer<typeof updateBusinessCaseSchema>;

export const approveGestorSchema = z.object({
  id: idSchema,
  comment: z.string().max(2000).optional(),
});
export type ApproveGestorInput = z.infer<typeof approveGestorSchema>;

export const approveAdminSchema = z.object({
  id: idSchema,
  targetFolderId: idSchema,
  projectListName: z.string().min(2).max(120).optional(),
  comment: z.string().max(2000).optional(),
});
export type ApproveAdminInput = z.infer<typeof approveAdminSchema>;

export const rejectBusinessCaseSchema = z.object({
  id: idSchema,
  reason: z.string().min(2, "Informe o motivo da reprovação.").max(2000),
});
export type RejectBusinessCaseInput = z.infer<typeof rejectBusinessCaseSchema>;

export const recordBenefitSchema = z.object({
  businessCaseId: idSchema,
  period: z.string().datetime(),
  actualAmount: z.number(),
  notes: z.string().max(2000).optional(),
});
export type RecordBenefitInput = z.infer<typeof recordBenefitSchema>;

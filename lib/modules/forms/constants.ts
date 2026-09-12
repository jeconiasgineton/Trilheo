/**
 * Coleta mobile (Fase 7) — tipos de campo de um FormTemplate.
 * `PHOTO`/`SIGNATURE` guardam o valor como data URL (string base64)
 * dentro de `FormSubmission.answers` — ver comentário no
 * schema.prisma sobre por que (viabiliza a fila offline).
 */
export const FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "YES_NO",
  "DATE",
  "PHOTO",
  "SIGNATURE",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  SINGLE_CHOICE: "Escolha única",
  MULTI_CHOICE: "Múltipla escolha",
  YES_NO: "Sim/Não",
  DATE: "Data",
  PHOTO: "Foto",
  SIGNATURE: "Assinatura",
};

/** Tipos que exigem uma lista de opções (`FormField.options`). */
export const CHOICE_FIELD_TYPES: ReadonlySet<FieldType> = new Set(["SINGLE_CHOICE", "MULTI_CHOICE"]);

export function isValidFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

/** Origens de uma submissão. "IOT" reservado — não implementado (ver CONTEXTO.MD). */
export const SUBMISSION_SOURCES = ["MANUAL", "IOT"] as const;
export type SubmissionSource = (typeof SUBMISSION_SOURCES)[number];

/**
 * Limite de tamanho de uma data URL (foto/assinatura) dentro de
 * `answers` — protege contra um payload absurdo indo pro banco como
 * Json. ~2MB em base64 (base64 infla ~33% o tamanho original).
 */
export const MAX_DATA_URL_LENGTH = 2_800_000;

/**
 * Valida a estrutura de `answers` contra a lista de campos do
 * template — função pura, testável sem banco. Não valida o
 * CONTEÚDO de cada resposta a fundo (ex.: se a data URL é uma
 * imagem válida), só a forma (obrigatório preenchido, tipo
 * compatível, opção pertence à lista).
 */
export function validateAnswers(
  fields: { id: string; type: string; label: string; required: boolean; options: unknown }[],
  answers: Record<string, unknown>,
): string | null {
  for (const field of fields) {
    const value = answers[field.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      return `Campo obrigatório não preenchido: "${field.label}".`;
    }
    if (isEmpty) continue;

    switch (field.type) {
      case "NUMBER":
        if (typeof value !== "number") return `"${field.label}" precisa ser um número.`;
        break;
      case "YES_NO":
        if (typeof value !== "boolean") return `"${field.label}" precisa ser sim/não.`;
        break;
      case "SINGLE_CHOICE": {
        const options = Array.isArray(field.options) ? (field.options as string[]) : [];
        if (typeof value !== "string" || !options.includes(value)) {
          return `"${field.label}": opção inválida.`;
        }
        break;
      }
      case "MULTI_CHOICE": {
        const options = Array.isArray(field.options) ? (field.options as string[]) : [];
        if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && options.includes(v))) {
          return `"${field.label}": opção inválida.`;
        }
        break;
      }
      case "PHOTO":
      case "SIGNATURE":
        if (typeof value !== "string" || !value.startsWith("data:")) {
          return `"${field.label}" precisa ser uma imagem.`;
        }
        if (value.length > MAX_DATA_URL_LENGTH) {
          return `"${field.label}": imagem grande demais.`;
        }
        break;
      default:
        if (typeof value !== "string") return `"${field.label}" precisa ser texto.`;
    }
  }
  return null;
}

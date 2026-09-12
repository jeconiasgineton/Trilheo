import { Resend } from "resend";

/**
 * E-mail transacional (Fase 7), provedor Resend — escolhido pelo
 * usuário. Isolado num módulo próprio, **não reexportado por nenhum
 * barrel** que componente client possa importar (mesmo cuidado já
 * documentado para `copilot/service.ts` com o SDK do Gemini): a chave
 * de API e o SDK do Resend nunca podem chegar ao bundle do client.
 */
export class EmailError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "SEND_FAILED",
  ) {
    super(message);
    this.name = "EmailError";
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

let client: Resend | null = null;
function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailError("Serviço de e-mail não configurado (RESEND_API_KEY ausente).", "NOT_CONFIGURED");
  }
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const resend = getClient();
  const from = process.env.EMAIL_FROM || "Trilheo <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    throw new EmailError(error.message ?? "Falha ao enviar e-mail.", "SEND_FAILED");
  }
}

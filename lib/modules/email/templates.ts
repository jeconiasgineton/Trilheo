/**
 * Templates de e-mail — funções puras (sem SDK, sem I/O), seguras
 * para importar de qualquer lugar. A única string interpolada que não
 * vem de uma fonte já validada por Zod é `organizationName` (definido
 * livremente no signup) — por isso passa por `escapeHtml`.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function inviteEmailSubject(organizationName: string): string {
  return `Você foi convidado para ${organizationName} no Trilheo`;
}

export function inviteEmailContent(params: {
  organizationName: string;
  recipientEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}): { html: string; text: string } {
  const organizationName = escapeHtml(params.organizationName);
  const recipientEmail = escapeHtml(params.recipientEmail);
  const temporaryPassword = escapeHtml(params.temporaryPassword);
  const loginUrl = escapeHtml(params.loginUrl);

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h2 style="margin-bottom: 4px;">Você foi convidado para ${organizationName}</h2>
      <p style="color: #444;">Use as credenciais abaixo para acessar o Trilheo pela primeira vez:</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td><strong>${recipientEmail}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Senha temporária</td><td><strong>${temporaryPassword}</strong></td></tr>
      </table>
      <p><a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;">Entrar no Trilheo</a></p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">Recomendamos trocar a senha logo após o primeiro acesso.</p>
    </div>
  `.trim();

  const text = [
    `Você foi convidado para ${params.organizationName} no Trilheo.`,
    ``,
    `Email: ${params.recipientEmail}`,
    `Senha temporária: ${params.temporaryPassword}`,
    ``,
    `Acesse: ${params.loginUrl}`,
    ``,
    `Recomendamos trocar a senha logo após o primeiro acesso.`,
  ].join("\n");

  return { html, text };
}

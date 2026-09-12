import { NextResponse } from "next/server";
import { handleStripeWebhookEvent, BillingError } from "@/lib/modules/billing/service";

/**
 * Webhook do Stripe — SEM sessão de propósito, igual
 * `submitPublicIdeaAction` (ver innovation/actions.ts): quem chama
 * esta rota é o servidor do Stripe, não um usuário logado no app. A
 * autorização é a assinatura HMAC no header `stripe-signature`,
 * verificada dentro de `handleStripeWebhookEvent` contra
 * `STRIPE_WEBHOOK_SECRET` — sem essa verificação batendo, o corpo é
 * tratado como não confiável e o evento é rejeitado.
 *
 * Precisa do corpo bruto (não JSON parseado) para a verificação de
 * assinatura funcionar — por isso `req.text()`, nunca `req.json()`.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  const rawBody = await req.text();
  try {
    await handleStripeWebhookEvent(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (err) {
    if (err instanceof BillingError) {
      const status = err.code === "NOT_CONFIGURED" ? 503 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
}

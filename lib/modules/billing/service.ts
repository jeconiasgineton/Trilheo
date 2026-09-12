import Stripe from "stripe";
import { db } from "@/lib/db";
import { PLANS, isValidPlanId, type PlanId } from "./constants";

/**
 * Billing (Fase 7), Stripe — modo teste, escolhido pelo usuário.
 * Isolado num módulo próprio, **não reexportado por nenhum barrel**
 * client-facing (mesmo cuidado de `copilot/service.ts` e
 * `email/service.ts`): a chave secreta do Stripe e o SDK nunca podem
 * chegar ao bundle do client.
 */
export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "NOT_FOUND" | "INVALID_PLAN" | "STRIPE_ERROR",
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new BillingError("Billing não configurado (STRIPE_SECRET_KEY ausente).", "NOT_CONFIGURED");
  }
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

/** Dado um Price ID do Stripe, acha qual dos nossos planos ele representa (via a env var configurada em cada plano). Pura o suficiente para testar sem mockar o SDK. */
export function planIdFromPriceId(priceId: string): PlanId | null {
  for (const [id, plan] of Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]) {
    if (plan.stripePriceEnvVar && process.env[plan.stripePriceEnvVar] === priceId) return id;
  }
  return null;
}

export async function getBillingStatus(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      _count: { select: { members: true } },
    },
  });
  if (!org) throw new BillingError("Organização não encontrada.", "NOT_FOUND");

  const planId = isValidPlanId(org.plan) ? org.plan : "FREE";
  const plan = PLANS[planId];
  return {
    plan: planId,
    planLabel: plan.label,
    memberLimit: plan.memberLimit,
    memberCount: org._count.members,
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd,
    hasStripeCustomer: !!org.stripeCustomerId,
  };
}

async function getOrCreateStripeCustomer(organizationId: string): Promise<string> {
  const stripe = getStripe();
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      members: {
        where: { role: "OWNER" },
        take: 1,
        include: { user: { select: { email: true } } },
      },
    },
  });
  if (!org) throw new BillingError("Organização não encontrada.", "NOT_FOUND");
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const ownerEmail = org.members[0]?.user.email;
  const customer = await stripe.customers.create({
    name: org.name,
    email: ownerEmail,
    metadata: { organizationId: org.id },
  });
  await db.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Cria uma sessão de Checkout hospedada pelo Stripe; devolve a URL para redirecionar o navegador. */
export async function createCheckoutSession(
  organizationId: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const plan = PLANS[planId];
  if (!plan?.stripePriceEnvVar) {
    throw new BillingError(`O plano ${planId} não tem checkout automático.`, "INVALID_PLAN");
  }
  const priceId = process.env[plan.stripePriceEnvVar];
  if (!priceId) {
    throw new BillingError(
      `Price do Stripe não configurado para o plano ${planId} (defina ${plan.stripePriceEnvVar} no .env).`,
      "NOT_CONFIGURED",
    );
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(organizationId);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organizationId },
    subscription_data: { metadata: { organizationId } },
  });
  if (!session.url) throw new BillingError("Stripe não devolveu URL de checkout.", "STRIPE_ERROR");
  return session.url;
}

/** Sessão do Billing Portal do Stripe (cancelar, trocar cartão, ver faturas). */
export async function createBillingPortalSession(organizationId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(organizationId);
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

async function syncSubscriptionToOrganization(organizationId: string, subscription: Stripe.Subscription): Promise<void> {
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const resolvedPlan = (priceId && planIdFromPriceId(priceId)) || null;
  const isActive = subscription.status === "active" || subscription.status === "trialing";

  // A partir da API 2025 do Stripe, `current_period_end` deixou de
  // existir no nível da Subscription (que pode ter itens com ciclos
  // diferentes) e passou para cada SubscriptionItem.
  const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : null;

  await db.organization.update({
    where: { id: organizationId },
    data: {
      // Assinatura cancelada/inadimplente/etc. volta pro Free — nunca
      // deixa a organização "presa" num plano pago sem cobrança ativa.
      plan: isActive && resolvedPlan ? resolvedPlan : "FREE",
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd,
    },
  });
}

/**
 * Processa um evento de webhook do Stripe já com a assinatura
 * verificada (`stripe.webhooks.constructEvent` lança se a assinatura
 * não bater, então isso nunca aplica um payload forjado). Só reage
 * aos eventos relevantes para o nosso modelo de plano; qualquer outro
 * tipo é ignorado silenciosamente (comportamento padrão recomendado
 * pelo próprio Stripe — a conta pode ter dezenas de tipos de evento
 * habilitados que não dizem respeito a este app).
 */
export async function handleStripeWebhookEvent(rawBody: string | Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new BillingError("Webhook não configurado (STRIPE_WEBHOOK_SECRET ausente).", "NOT_CONFIGURED");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new BillingError(`Assinatura do webhook inválida: ${(err as Error).message}`, "STRIPE_ERROR");
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      if (!organizationId || !session.subscription) break;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscriptionToOrganization(organizationId, subscription);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;
      if (!organizationId) break;
      await syncSubscriptionToOrganization(organizationId, subscription);
      break;
    }
    default:
      break;
  }
}

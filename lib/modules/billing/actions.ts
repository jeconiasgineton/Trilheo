"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission } from "@/lib/modules/permissions";
import * as service from "./service";
import { BillingError } from "./service";
import type { PlanId } from "./constants";

type SessionInfo = { organizationId: string; organizationSlug: string };

async function withOwnerSession<T>(run: (session: SessionInfo) => Promise<T>) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false as const, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    requirePermission(session.user.role, "billing:manage");
    const data = await run({
      organizationId: session.user.organizationId,
      organizationSlug: session.user.organizationSlug,
    });
    return { ok: true as const, data };
  } catch (err) {
    if (err instanceof BillingError) {
      return { ok: false as const, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false as const, error: "Só o OWNER da organização pode gerenciar billing." };
    }
    throw err;
  }
}

export async function getBillingStatusAction() {
  return withOwnerSession(({ organizationId }) => service.getBillingStatus(organizationId));
}

export async function createCheckoutSessionAction(planId: PlanId) {
  return withOwnerSession(({ organizationId, organizationSlug }) => {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const returnBase = `${baseUrl}/${organizationSlug}/settings/billing`;
    return service.createCheckoutSession(
      organizationId,
      planId,
      `${returnBase}?checkout=success`,
      `${returnBase}?checkout=cancelled`,
    );
  });
}

export async function createBillingPortalSessionAction() {
  return withOwnerSession(({ organizationId, organizationSlug }) => {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return service.createBillingPortalSession(organizationId, `${baseUrl}/${organizationSlug}/settings/billing`);
  });
}

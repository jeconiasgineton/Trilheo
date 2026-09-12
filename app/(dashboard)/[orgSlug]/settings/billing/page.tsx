import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { can } from "@/lib/modules/permissions";
import { getBillingStatus, isBillingConfigured } from "@/lib/modules/billing/service";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "billing:manage")) notFound();

  const status = await getBillingStatus(session.user.organizationId);

  return <BillingClient status={status} configured={isBillingConfigured()} />;
}

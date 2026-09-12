import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getWorkloadSummary } from "@/lib/modules/task/service";
import { WorkloadClient } from "./workload-client";

export default async function WorkloadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const summary = await getWorkloadSummary(session.user.organizationId);

  return <WorkloadClient summary={summary} />;
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listPipelines } from "@/lib/modules/innovation";
import { PipelinesClient } from "./pipelines-client";

export default async function PipelinesPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const pipelines = await listPipelines(session.user.organizationId);

  return (
    <PipelinesClient
      orgSlug={params.orgSlug}
      role={session.user.role}
      pipelines={pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        boardCount: p._count.boards,
        stages: p.stages.map((s) => ({
          id: s.id,
          name: s.name,
          stageType: s.stageType,
          color: s.color,
          isFinal: s.isFinal,
          order: s.order,
        })),
      }))}
    />
  );
}
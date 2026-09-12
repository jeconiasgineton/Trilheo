import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listBoards, listPipelines } from "@/lib/modules/innovation";
import { InnovationListClient } from "./innovation-list-client";

export default async function InnovationPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  // OrgLayout já garante que params.orgSlug bate com a org da sessão;
  // aqui só usamos session.user.organizationId para as queries.
  const [boards, pipelines] = await Promise.all([
    listBoards(session.user.organizationId),
    listPipelines(session.user.organizationId),
  ]);

  return (
    <InnovationListClient
      orgSlug={params.orgSlug}
      boards={boards.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
        pipeline: { id: b.pipeline.id, name: b.pipeline.name },
        space: b.space ? { id: b.space.id, name: b.space.name } : null,
        ideaCount: b._count.ideas,
      }))}
      pipelines={pipelines.map((p) => ({ id: p.id, name: p.name }))}
      role={session.user.role}
    />
  );
}
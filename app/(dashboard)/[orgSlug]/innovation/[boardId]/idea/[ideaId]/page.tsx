import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getIdeaWithDetails, InnovationError } from "@/lib/modules/innovation";
import { listComments } from "@/lib/modules/comment/service";
import { listAttachments } from "@/lib/modules/attachment/service";
import { listTools } from "@/lib/modules/tools/service";
import { listBusinessCasesForIdea } from "@/lib/modules/business-case/service";
import { can } from "@/lib/modules/permissions";
import { IdeaDetailClient } from "./idea-detail-client";

export default async function IdeaDetailPage({
  params,
}: {
  params: { orgSlug: string; boardId: string; ideaId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const organizationId = session.user.organizationId;

  let idea;
  try {
    idea = await getIdeaWithDetails(organizationId, params.ideaId);
  } catch (err) {
    if (err instanceof InnovationError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const [comments, attachments, tools, businessCases] = await Promise.all([
    listComments(organizationId, "Idea", params.ideaId),
    listAttachments(organizationId, "Idea", params.ideaId),
    listTools(organizationId, "Idea", params.ideaId),
    listBusinessCasesForIdea(organizationId, params.ideaId),
  ]);

  return (
    <IdeaDetailClient
      orgSlug={params.orgSlug}
      idea={idea}
      initialComments={comments}
      initialAttachments={attachments}
      initialTools={tools}
      initialBusinessCases={businessCases}
      currentUserId={session.user.id}
      role={session.user.role}
      canUpdate={can(session.user.role, "idea:update")}
      canModerateComments={can(session.user.role, "comment:delete")}
      canModerateAttachments={can(session.user.role, "attachment:delete")}
      canCreateTool={can(session.user.role, "tool:create")}
      canModerateTools={can(session.user.role, "tool:delete")}
    />
  );
}

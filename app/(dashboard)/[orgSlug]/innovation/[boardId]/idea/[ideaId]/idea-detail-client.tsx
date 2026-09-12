"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommentSection, type CommentItem } from "@/components/shared/comment-section";
import { AttachmentSection, type AttachmentItem } from "@/components/shared/attachment-section";
import { IdeaDialog } from "../../idea-dialog";
import type { IdeaItem } from "../../idea-kanban";
import { ToolsSection, type ToolItem } from "./tools-section";
import { BusinessCaseSection, type BusinessCaseItem } from "./business-case-section";
import { CopilotWidget } from "@/components/shared/copilot-widget";
import type { Role } from "@/lib/modules/permissions";

type IdeaFull = {
  id: string;
  title: string;
  description: string | null;
  source: string;
  authorId: string | null;
  submitterName: string | null;
  author: { id: string; name: string | null; email: string } | null;
  gutGravity: number | null;
  gutUrgency: number | null;
  gutTrend: number | null;
  gutScore: number | null;
  pipelineStage: { id: string; name: string; color: string | null };
  board: { id: string; name: string; slug: string };
};

export function IdeaDetailClient({
  orgSlug,
  idea,
  initialComments,
  initialAttachments,
  initialTools,
  initialBusinessCases,
  currentUserId,
  role,
  canUpdate,
  canModerateComments,
  canModerateAttachments,
  canCreateTool,
  canModerateTools,
}: {
  orgSlug: string;
  idea: IdeaFull;
  initialComments: CommentItem[];
  initialAttachments: AttachmentItem[];
  initialTools: ToolItem[];
  initialBusinessCases: BusinessCaseItem[];
  currentUserId: string;
  role: Role;
  canUpdate: boolean;
  canModerateComments: boolean;
  canModerateAttachments: boolean;
  canCreateTool: boolean;
  canModerateTools: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const authorLabel = idea.author
    ? idea.author.name ?? idea.author.email
    : idea.submitterName?.trim() || "Anônimo (envio público)";

  const ideaForDialog: IdeaItem = {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    source: idea.source,
    authorId: idea.authorId,
    author: idea.author,
    submitterName: idea.submitterName,
    gutGravity: idea.gutGravity,
    gutUrgency: idea.gutUrgency,
    gutTrend: idea.gutTrend,
    gutScore: idea.gutScore,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/innovation`} className="hover:underline">
          Inovação
        </Link>
        {" / "}
        <Link href={`/${orgSlug}/innovation/${idea.board.id}`} className="hover:underline">
          {idea.board.name}
        </Link>
        {" / "}
        <span className="text-foreground">{idea.title}</span>
      </div>

      <div className="rounded-md border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{idea.title}</h1>
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Estágio: {idea.pipelineStage.name}</span>
          <span>Autor: {authorLabel}</span>
          {idea.gutScore != null && <span>Score GUT: {idea.gutScore} / 125</span>}
        </div>
        {idea.description && <p className="mt-4 whitespace-pre-wrap text-sm">{idea.description}</p>}
      </div>

      <AttachmentSection
        attachableType="Idea"
        attachableId={idea.id}
        attachments={initialAttachments}
        currentUserId={currentUserId}
        canModerate={canModerateAttachments}
      />

      <CommentSection
        commentableType="Idea"
        commentableId={idea.id}
        comments={initialComments}
        currentUserId={currentUserId}
        canModerate={canModerateComments}
      />

      <ToolsSection
        ideaId={idea.id}
        tools={initialTools}
        currentUserId={currentUserId}
        canCreate={canCreateTool}
        canModerate={canModerateTools}
      />

      <BusinessCaseSection
        orgSlug={orgSlug}
        ideaId={idea.id}
        businessCases={initialBusinessCases}
        role={role}
        currentUserId={currentUserId}
      />

      {editing && (
        <IdeaDialog
          boardId={idea.board.id}
          columns={[]}
          idea={ideaForDialog}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}

      <CopilotWidget contextType="Idea" contextId={idea.id} title={idea.title} />
    </div>
  );
}

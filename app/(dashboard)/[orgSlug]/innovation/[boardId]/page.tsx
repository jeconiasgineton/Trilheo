import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listIdeasByStage } from "@/lib/modules/innovation";
import { BoardClient } from "./board-client";

export default async function BoardPage({
  params,
}: {
  params: { orgSlug: string; boardId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  // listIdeasByStage filtra por organizationId da sessão; se o board
  // não existe (ou é de outra org), devolve NOT_FOUND — tratamos como
  // 404 sem revelar a diferença (mesma regra do restante do app).
  let data;
  try {
    data = await listIdeasByStage(session.user.organizationId, params.boardId);
  } catch {
    notFound();
  }

  const publicUrl = `${process.env.NEXTAUTH_URL ?? ""}/public/idea/${data.board.publicToken}`;

  return (
    <BoardClient
      orgSlug={params.orgSlug}
      board={{
        id: data.board.id,
        name: data.board.name,
        description: data.board.description,
        pipeline: { id: data.board.pipeline.id, name: data.board.pipeline.name },
        publicCaptureEnabled: data.board.publicCaptureEnabled,
        publicUrl,
      }}
      columns={data.columns.map((c) => ({
        stage: {
          id: c.stage.id,
          name: c.stage.name,
          color: c.stage.color,
          isFinal: c.stage.isFinal,
          stageType: c.stage.stageType,
        },
        ideas: c.ideas.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          source: i.source,
          authorId: i.authorId,
          author: i.author,
          submitterName: i.submitterName,
          gutGravity: i.gutGravity,
          gutUrgency: i.gutUrgency,
          gutTrend: i.gutTrend,
          gutScore: i.gutScore,
        })),
      }))}
      role={session.user.role}
      currentUserId={session.user.id}
    />
  );
}
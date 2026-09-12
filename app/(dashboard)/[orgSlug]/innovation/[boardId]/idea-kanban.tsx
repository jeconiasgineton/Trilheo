"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { IDEA_SOURCE_LABELS, type IdeaSource } from "@/lib/modules/innovation";

export type IdeaItem = {
  id: string;
  title: string;
  description: string | null;
  source: string;
  authorId: string | null;
  author: { id: string; name: string | null; email: string } | null;
  submitterName?: string | null;
  gutGravity?: number | null;
  gutUrgency?: number | null;
  gutTrend?: number | null;
  gutScore?: number | null;
};

export type StageColumn = {
  stage: {
    id: string;
    name: string;
    color: string | null;
    isFinal: boolean;
    stageType: string;
  };
  ideas: IdeaItem[];
};

/**
 * Badge de origem colorido por fonte. Classes literais (não dinâmicas)
 * para o purge do Tailwind encontrar. Mapa por chave de source.
 */
const SOURCE_STYLES: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  QR: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  FORM: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const SOURCE_DOT: Record<string, string> = {
  MANUAL: "bg-slate-400",
  QR: "bg-indigo-500",
  FORM: "bg-emerald-500",
};

function SourceBadge({ source }: { source: string }) {
  const label = IDEA_SOURCE_LABELS[source as IdeaSource] ?? source;
  const styles = SOURCE_STYLES[source] ?? "bg-muted text-muted-foreground";
  const dot = SOURCE_DOT[source] ?? "bg-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Iniciais do autor (ou de quem enviou pelo formulário público) para o avatar. */
function initialsOf(name: string | null | undefined) {
  const base = name?.trim() || "?";
  const parts = base.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Nome de exibição: autor logado > nome informado no formulário público > "Anônimo". */
function displayName(idea: IdeaItem): string {
  if (idea.author) return idea.author.name?.trim() || idea.author.email.split("@")[0];
  return idea.submitterName?.trim() || "Anônimo";
}

/** Badge do score GUT (Gravidade×Urgência×Tendência), só aparece se a ideia já foi pontuada. */
function GutBadge({ idea }: { idea: IdeaItem }) {
  if (idea.gutScore == null) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      title={`Gravidade ${idea.gutGravity} · Urgência ${idea.gutUrgency} · Tendência ${idea.gutTrend}`}
    >
      GUT {idea.gutScore}
    </span>
  );
}

function IdeaCardView({ idea }: { idea: IdeaItem }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <p className="text-sm font-medium leading-snug">{idea.title}</p>
      {idea.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {idea.description}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <SourceBadge source={idea.source} />
        <GutBadge idea={idea} />
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {initialsOf(displayName(idea))}
        </span>
        <span className="truncate text-xs text-muted-foreground">{displayName(idea)}</span>
      </div>
    </div>
  );
}

function DraggableIdeaCard({
  idea,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  isOwn,
  isFinalStage,
  stageColor,
}: {
  idea: IdeaItem;
  onEdit: (i: IdeaItem) => void;
  onDelete: (i: IdeaItem) => void;
  canEdit: boolean;
  canDelete: boolean;
  isOwn: boolean;
  isFinalStage: boolean;
  stageColor: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `idea:${idea.id}` });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-40" : ""}
    >
      <div
        className={`group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition active:cursor-grabbing hover:shadow-md ${isFinalStage ? "border-l-2" : "border-border"} hover:border-primary/30 ${isDragging ? "ring-2 ring-primary/40" : ""}`}
        style={isFinalStage ? { borderLeftColor: stageColor } : undefined}
        onClick={() => {
          // PointerSensor com distance 8px: clique sem arrastar chega aqui.
          if (canEdit) onEdit(idea);
        }}
      >
        <p className="text-sm font-medium leading-snug">{idea.title}</p>
        {idea.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {idea.description}
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          <SourceBadge source={idea.source} />
          <GutBadge idea={idea} />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {initialsOf(displayName(idea))}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {displayName(idea)}
              {isOwn && (
                <span className="ml-1 text-[10px] font-normal text-primary/70">
                  (você)
                </span>
              )}
            </span>
          </div>
          {(canDelete || isOwn) && (
            <button
              type="button"
              className="shrink-0 text-xs text-destructive opacity-0 transition group-hover:opacity-100 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(idea);
              }}
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IdeaColumn({
  column,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  currentUserId,
}: {
  column: StageColumn;
  onEdit: (i: IdeaItem) => void;
  onDelete: (i: IdeaItem) => void;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${column.stage.id}` });
  const accent = column.stage.color ?? "#94a3b8";
  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Barra de cor do estágio no topo da coluna */}
      <div
        className="mb-0 h-1 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="mb-2 flex items-center justify-between px-0.5 pt-1.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {column.stage.name}
          {column.stage.isFinal && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              final
            </span>
          )}
        </h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {column.ideas.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg border p-2 transition-colors ${isOver ? "border-primary bg-muted" : "border-border bg-muted/40"}`}
      >
        {column.ideas.map((idea) => (
          <DraggableIdeaCard
            key={idea.id}
            idea={idea}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
            isOwn={idea.authorId === currentUserId}
            isFinalStage={column.stage.isFinal}
            stageColor={accent}
          />
        ))}
        {column.ideas.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
            Solte ideias aqui
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Kanban de ideias por estágio do pipeline (dnd-kit). Arrastar uma
 * ideia entre colunas move seu `pipelineStageId` (moveIdeaAction).
 * A regra de estágio final (entrar/sair de final exige aprovação)
 * é validada no service; se faltar permissão, o board-client mostra
 * o erro retornado.
 */
export function IdeaKanban({
  columns,
  onMove,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  currentUserId,
}: {
  columns: StageColumn[];
  onMove: (ideaId: string, targetStageId: string) => void;
  onEdit: (idea: IdeaItem) => void;
  onDelete: (idea: IdeaItem) => void;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (!activeIdStr.startsWith("idea:")) return;
    const ideaId = activeIdStr.slice(5);

    let targetStageId: string | null = null;
    if (overIdStr.startsWith("stage:")) {
      targetStageId = overIdStr.slice(6);
    } else if (overIdStr.startsWith("idea:")) {
      const overIdeaId = overIdStr.slice(5);
      const col = columns.find((c) =>
        c.ideas.some((i) => i.id === overIdeaId),
      );
      targetStageId = col?.stage.id ?? null;
    }
    if (!targetStageId) return;

    const sourceCol = columns.find((c) =>
      c.ideas.some((i) => i.id === ideaId),
    );
    const sourceStageId = sourceCol?.stage.id ?? null;
    if (sourceStageId && sourceStageId !== targetStageId) {
      onMove(ideaId, targetStageId);
    }
  }

  const activeIdea = activeId
    ? columns.flatMap((c) => c.ideas).find((i) => `idea:${i.id}` === activeId) ??
      null
    : null;

  return (
    <DndContext
      sensors={[sensor]}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <IdeaColumn
            key={col.stage.id}
            column={col}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
            currentUserId={currentUserId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIdea ? <IdeaCardView idea={activeIdea} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

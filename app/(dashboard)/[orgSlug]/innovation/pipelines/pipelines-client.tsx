"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { can, type Role } from "@/lib/modules/permissions";
import {
  STAGE_TYPES,
  STAGE_TYPE_LABELS,
  type StageType,
} from "@/lib/modules/innovation";
import {
  createIdeaPipelineAction,
  createIdeaPipelineStageAction,
  deleteIdeaPipelineAction,
  deleteIdeaPipelineStageAction,
  reorderIdeaPipelineStagesAction,
  updateIdeaPipelineAction,
  updateIdeaPipelineStageAction,
} from "@/lib/modules/innovation/actions";

type StageSummary = {
  id: string;
  name: string;
  stageType: string;
  color: string | null;
  isFinal: boolean;
  order: number;
};

type PipelineSummary = {
  id: string;
  name: string;
  boardCount: number;
  stages: StageSummary[];
};

/**
 * Gerenciamento de pipelines e estágios (pipeline:manage, GESTOR+).
 * Reordenação de estágios por botões ↑/↓ (mesma decisão da hierarquia
 * de workspace na Fase 1 — drag & drop de verdade fica para quando
 * dnd-kit for reaproveitado aqui também). O action revalida a
 * permissão no servidor.
 */
export function PipelinesClient({
  orgSlug,
  role,
  pipelines,
}: {
  orgSlug: string;
  role: Role;
  pipelines: PipelineSummary[];
}) {
  const router = useRouter();
  const canManage = can(role, "pipeline:manage");
  const [error, setError] = useState<string | null>(null);

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  async function handleCreatePipeline(name: string) {
    report(await createIdeaPipelineAction({ name }));
  }
  async function handleRenamePipeline(id: string, name: string) {
    report(await updateIdeaPipelineAction({ id, name }));
  }
  async function handleDeletePipeline(id: string) {
    report(await deleteIdeaPipelineAction(id));
  }
  async function handleReorderStages(pipelineId: string, orderedIds: string[]) {
    report(await reorderIdeaPipelineStagesAction({ pipelineId, orderedIds }));
  }
  async function handleCreateStage(input: {
    pipelineId: string;
    name: string;
    stageType: string;
    color?: string;
    isFinal?: boolean;
  }) {
    report(await createIdeaPipelineStageAction(input));
  }
  async function handleUpdateStage(input: {
    id: string;
    name?: string;
    stageType?: string;
    color?: string | null;
    isFinal?: boolean;
  }) {
    report(await updateIdeaPipelineStageAction(input));
  }
  async function handleDeleteStage(id: string) {
    report(await deleteIdeaPipelineStageAction(id));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/innovation`} className="hover:underline">
          Inovação
        </Link>
        {" / "}
        <span className="text-foreground">Pipelines</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipelines</h1>
        {canManage && <NewPipeline onCreate={handleCreatePipeline} />}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="space-y-6">
        {pipelines.map((p) => (
          <PipelineCard
            key={p.id}
            pipeline={p}
            canManage={canManage}
            onRename={(name) => handleRenamePipeline(p.id, name)}
            onDelete={() => handleDeletePipeline(p.id)}
            onReorderStages={(orderedIds) => handleReorderStages(p.id, orderedIds)}
            onCreateStage={(input) => handleCreateStage({ ...input, pipelineId: p.id })}
            onUpdateStage={handleUpdateStage}
            onDeleteStage={handleDeleteStage}
          />
        ))}
        {pipelines.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum pipeline ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function NewPipeline({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim());
    setSaving(false);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Novo pipeline</Button>;
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        placeholder="Nome do pipeline"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Button type="submit" disabled={saving}>
        {saving ? "..." : "Criar"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}

function PipelineCard({
  pipeline,
  canManage,
  onRename,
  onDelete,
  onReorderStages,
  onCreateStage,
  onUpdateStage,
  onDeleteStage,
}: {
  pipeline: PipelineSummary;
  canManage: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onReorderStages: (orderedIds: string[]) => void;
  onCreateStage: (input: {
    name: string;
    stageType: string;
    color?: string;
    isFinal?: boolean;
  }) => void;
  onUpdateStage: (input: {
    id: string;
    name?: string;
    stageType?: string;
    color?: string | null;
    isFinal?: boolean;
  }) => void;
  onDeleteStage: (id: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(pipeline.name);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= pipeline.stages.length) return;
    const ids = pipeline.stages.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    onReorderStages(ids);
  }

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onRename(name.trim());
              setEditingName(false);
            }}
            className="flex items-center gap-2"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="sm">
              Salvar
            </Button>
          </form>
        ) : (
          <h2 className="font-semibold">
            {pipeline.name}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({pipeline.boardCount} board(s))
            </span>
          </h2>
        )}
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingName(true)}
            >
              Renomear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
              disabled={pipeline.boardCount > 0}
              title={
                pipeline.boardCount > 0
                  ? "Pipeline em uso por boards"
                  : "Excluir pipeline"
              }
            >
              Excluir
            </Button>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {pipeline.stages.map((s, index) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color ?? "#94a3b8" }}
            />
            <span className="flex-1 text-sm">{s.name}</span>
            <span className="text-xs text-muted-foreground">
              {STAGE_TYPE_LABELS[s.stageType as StageType] ?? s.stageType}
            </span>
            {s.isFinal && (
              <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                final
              </span>
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => move(index, 1)}
                  disabled={index === pipeline.stages.length - 1}
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <StageEdit
                  stage={s}
                  onUpdate={onUpdateStage}
                  onDelete={() => onDeleteStage(s.id)}
                />
              </>
            )}
          </li>
        ))}
        {pipeline.stages.length === 0 && (
          <li className="px-2 py-1 text-sm text-muted-foreground">
            Sem estágios.
          </li>
        )}
      </ul>

      {canManage && <NewStage onCreate={onCreateStage} />}
    </section>
  );
}

function NewStage({
  onCreate,
}: {
  onCreate: (input: {
    name: string;
    stageType: string;
    color?: string;
    isFinal?: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stageType, setStageType] = useState<string>(STAGE_TYPES[0]);
  const [isFinal, setIsFinal] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({ name: name.trim(), stageType, isFinal });
    setSaving(false);
    setName("");
    setIsFinal(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Adicionar estágio
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="stage-name">Nome</Label>
        <Input
          id="stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="stage-type">Tipo</Label>
        <Select
          id="stage-type"
          value={stageType}
          onChange={(e) => setStageType(e.target.value)}
        >
          {STAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {STAGE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={isFinal}
          onChange={(e) => setIsFinal(e.target.checked)}
        />
        Final
      </label>
      <Button type="submit" disabled={saving}>
        {saving ? "..." : "Adicionar"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}

function StageEdit({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: StageSummary;
  onUpdate: (input: {
    id: string;
    name?: string;
    stageType?: string;
    isFinal?: boolean;
  }) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(stage.name);
  const [stageType, setStageType] = useState(stage.stageType);
  const [isFinal, setIsFinal] = useState(stage.isFinal);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onUpdate({
      id: stage.id,
      name: name.trim(),
      stageType,
      isFinal,
    });
    setSaving(false);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="px-1 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Editar estágio"
      >
        ✎
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-semibold">Editar estágio</h3>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ed-name">Nome</Label>
                <Input
                  id="ed-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-type">Tipo</Label>
                <Select
                  id="ed-type"
                  value={stageType}
                  onChange={(e) => setStageType(e.target.value)}
                >
                  {STAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {STAGE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={isFinal}
                  onChange={(e) => setIsFinal(e.target.checked)}
                />
                Final
              </label>
              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                >
                  Excluir
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
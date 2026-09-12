"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TOOL_TYPE_DESCRIPTIONS,
  TOOL_TYPE_LABELS,
  TOOL_TYPES,
  type FiveWTwoHContent,
  type FiveWhysContent,
  type IshikawaContent,
  type ToolType,
} from "@/lib/modules/tools";
import { FiveWhysEditor } from "./five-whys-editor";
import { IshikawaEditor } from "./ishikawa-editor";
import { FiveWTwoHEditor } from "./five-w-two-h-editor";

export type ToolItem = {
  id: string;
  type: string;
  title: string;
  content: unknown;
  createdById: string | null;
  createdBy: { id: string; name: string | null; email: string } | null;
};

function summarize(tool: ToolItem): string {
  if (tool.type === "FIVE_WHYS") {
    const c = tool.content as FiveWhysContent;
    return c.problem || `${c.whys.length} porquê(s)`;
  }
  if (tool.type === "ISHIKAWA") {
    const c = tool.content as IshikawaContent;
    const total = c.categories.reduce((sum, cat) => sum + cat.causes.length, 0);
    return `${total} causa(s) em ${c.categories.length} categoria(s)`;
  }
  if (tool.type === "FIVE_W_TWO_H") {
    const c = tool.content as FiveWTwoHContent;
    return `${c.actions.length} ação(ões)`;
  }
  return "";
}

export function ToolsSection({
  ideaId,
  tools,
  currentUserId,
  canCreate,
  canModerate,
}: {
  ideaId: string;
  tools: ToolItem[];
  currentUserId: string;
  canCreate: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<{ type: ToolType; tool: ToolItem | null } | null>(null);

  function refresh() {
    router.refresh();
    setEditing(null);
  }

  function openNew(type: ToolType) {
    setPickerOpen(false);
    setEditing({ type, tool: null });
  }

  function openExisting(tool: ToolItem) {
    setEditing({ type: tool.type as ToolType, tool });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ferramentas de análise (Melhoria Contínua)</h2>
        {canCreate && (
          <div className="relative">
            <Button type="button" size="sm" onClick={() => setPickerOpen((v) => !v)}>
              Nova ferramenta
            </Button>
            {pickerOpen && (
              <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-border bg-background p-1 shadow-lg">
                {TOOL_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => openNew(t)}
                  >
                    <span className="font-medium">{TOOL_TYPE_LABELS[t]}</span>
                    <span className="block text-xs text-muted-foreground">{TOOL_TYPE_DESCRIPTIONS[t]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {tools.map((tool) => (
          <li
            key={tool.id}
            className="cursor-pointer rounded-md border border-border bg-background p-3 hover:border-primary/40"
            onClick={() => openExisting(tool)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {tool.title}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({TOOL_TYPE_LABELS[tool.type as ToolType] ?? tool.type})
                </span>
              </span>
              {tool.createdBy && (
                <span className="text-xs text-muted-foreground">{tool.createdBy.name ?? tool.createdBy.email}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summarize(tool)}</p>
          </li>
        ))}
        {tools.length === 0 && (
          <li className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma ferramenta de análise ainda.
          </li>
        )}
      </ul>

      {editing && (() => {
        const canDelete = !editing.tool || editing.tool.createdById === currentUserId || canModerate;
        return (
          <>
            {editing.type === "FIVE_WHYS" && (
              <FiveWhysEditor
                ideaId={ideaId}
                tool={editing.tool as { id: string; title: string; content: FiveWhysContent } | null}
                canDelete={canDelete}
                onClose={() => setEditing(null)}
                onSaved={refresh}
              />
            )}
            {editing.type === "ISHIKAWA" && (
              <IshikawaEditor
                ideaId={ideaId}
                tool={editing.tool as { id: string; title: string; content: IshikawaContent } | null}
                canDelete={canDelete}
                onClose={() => setEditing(null)}
                onSaved={refresh}
              />
            )}
            {editing.type === "FIVE_W_TWO_H" && (
              <FiveWTwoHEditor
                ideaId={ideaId}
                tool={editing.tool as { id: string; title: string; content: FiveWTwoHContent } | null}
                canDelete={canDelete}
                onClose={() => setEditing(null)}
                onSaved={refresh}
              />
            )}
          </>
        );
      })()}
    </section>
  );
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getIdeaWithDetails, InnovationError } from "@/lib/modules/innovation/service";
import { listComments } from "@/lib/modules/comment/service";
import { listTools } from "@/lib/modules/tools/service";
import type { FiveWTwoHContent, FiveWhysContent, IshikawaContent } from "@/lib/modules/tools/schemas";
import { listBusinessCasesForIdea } from "@/lib/modules/business-case/service";
import { computeFinancials, BUSINESS_CASE_STATUS_LABELS, type BusinessCaseStatus } from "@/lib/modules/business-case/constants";
import { getTaskWithDetails, TaskError } from "@/lib/modules/task/service";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, type TaskStatus, type TaskPriority } from "@/lib/modules/task/constants";
import { COPILOT_SYSTEM_PREAMBLE } from "./constants";
import type { AskCopilotInput } from "./schemas";

export class CopilotError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "NOT_CONFIGURED" | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "CopilotError";
  }
}

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Construção de contexto (dados reais, nunca resumo genérico) ─────

async function buildIdeaContext(organizationId: string, ideaId: string): Promise<string> {
  let idea;
  try {
    idea = await getIdeaWithDetails(organizationId, ideaId);
  } catch (err) {
    if (err instanceof InnovationError && err.code === "NOT_FOUND") {
      throw new CopilotError("Ideia não encontrada.", "NOT_FOUND");
    }
    throw err;
  }

  const [comments, tools, businessCases] = await Promise.all([
    listComments(organizationId, "Idea", ideaId),
    listTools(organizationId, "Idea", ideaId),
    listBusinessCasesForIdea(organizationId, ideaId),
  ]);

  const lines: string[] = [];
  lines.push("=== IDEIA ===");
  lines.push(`Título: ${idea.title}`);
  lines.push(`Descrição: ${idea.description ?? "(sem descrição)"}`);
  lines.push(`Estágio do pipeline: ${idea.pipelineStage.name}${idea.pipelineStage.isFinal ? " (final)" : ""}`);
  lines.push(`Origem: ${idea.source}`);
  lines.push(`Autor: ${idea.author ? idea.author.name ?? idea.author.email : idea.submitterName ?? "Anônimo (envio público)"}`);
  if (idea.gutScore != null) {
    lines.push(`Matriz GUT: Gravidade ${idea.gutGravity}, Urgência ${idea.gutUrgency}, Tendência ${idea.gutTrend} — Score ${idea.gutScore}/125`);
  } else {
    lines.push("Matriz GUT: ainda não pontuada.");
  }

  lines.push("");
  lines.push("=== FERRAMENTAS DE ANÁLISE (Melhoria Contínua) ===");
  if (tools.length === 0) {
    lines.push("Nenhuma ferramenta de análise registrada.");
  }
  for (const t of tools) {
    if (t.type === "FIVE_WHYS") {
      const c = t.content as FiveWhysContent;
      const rootCause = c.whys[c.whys.length - 1]?.answer;
      lines.push(`- [5 Porquês] "${t.title}" — problema: ${c.problem || "(não informado)"}; causa raiz: ${rootCause || "(não concluída)"}`);
    } else if (t.type === "ISHIKAWA") {
      const c = t.content as IshikawaContent;
      lines.push(`- [Ishikawa] "${t.title}" — problema: ${c.problem || "(não informado)"}`);
      for (const cat of c.categories) {
        if (cat.causes.length > 0) lines.push(`    ${cat.name}: ${cat.causes.filter(Boolean).join("; ")}`);
      }
    } else if (t.type === "FIVE_W_TWO_H") {
      const c = t.content as FiveWTwoHContent;
      lines.push(`- [5W2H] "${t.title}" — ${c.actions.length} ação(ões): ${c.actions.map((a) => a.what).filter(Boolean).join("; ")}`);
    }
  }

  lines.push("");
  lines.push("=== BUSINESS CASE ===");
  if (businessCases.length === 0) {
    lines.push("Nenhum Business Case criado para esta ideia ainda.");
  }
  for (const bc of businessCases) {
    const f = computeFinancials(bc.capex, bc.opexMonthly, bc.benefitMonthly, bc.horizonMonths);
    lines.push(
      `- "${bc.title}" — status: ${BUSINESS_CASE_STATUS_LABELS[bc.status as BusinessCaseStatus] ?? bc.status}; ` +
        `CAPEX ${money(bc.capex)}; OPEX/mês ${money(bc.opexMonthly)}; benefício/mês ${money(bc.benefitMonthly)}; ` +
        `horizonte ${bc.horizonMonths} meses; benefício líquido ${money(f.netBenefit)}; ` +
        `ROI ${f.roiPercent == null ? "—" : f.roiPercent.toFixed(1) + "%"}; ` +
        `payback ${f.paybackMonths == null ? "não se paga" : f.paybackMonths.toFixed(1) + " meses"}` +
        (bc.rejectionReason ? `; motivo da reprovação: ${bc.rejectionReason}` : ""),
    );
  }

  lines.push("");
  lines.push("=== COMENTÁRIOS (mais recentes primeiro, até 10) ===");
  if (comments.length === 0) {
    lines.push("Nenhum comentário ainda.");
  }
  for (const c of comments.slice(-10).reverse()) {
    lines.push(`- ${c.author.name ?? c.author.email}: "${c.body.slice(0, 400)}"`);
  }

  return lines.join("\n");
}

async function buildTaskContext(organizationId: string, taskId: string): Promise<string> {
  let task;
  try {
    task = await getTaskWithDetails(organizationId, taskId);
  } catch (err) {
    if (err instanceof TaskError && err.code === "NOT_FOUND") {
      throw new CopilotError("Task não encontrada.", "NOT_FOUND");
    }
    throw err;
  }
  const comments = await listComments(organizationId, "Task", taskId);

  const lines: string[] = [];
  lines.push("=== TASK ===");
  lines.push(`Título: ${task.title}`);
  lines.push(`Descrição: ${task.description ?? "(sem descrição)"}`);
  lines.push(`Status: ${TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}`);
  lines.push(`Prioridade: ${task.priority ? TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority : "sem prioridade"}`);
  lines.push(`Responsável: ${task.assignee ? task.assignee.name ?? task.assignee.email : "sem responsável"}`);
  lines.push(`Data início: ${task.startDate ? task.startDate.toLocaleDateString("pt-BR") : "não definida"}`);
  lines.push(`Data fim: ${task.dueDate ? task.dueDate.toLocaleDateString("pt-BR") : "não definida"}`);
  lines.push(`Marco: ${task.isMilestone ? "sim" : "não"}`);

  lines.push("");
  lines.push("=== SUBTAREFAS ===");
  if (task.subtasks.length === 0) {
    lines.push("Nenhuma subtarefa.");
  }
  for (const s of task.subtasks) {
    lines.push(`- ${s.title} (${TASK_STATUS_LABELS[s.status as TaskStatus] ?? s.status})`);
  }

  lines.push("");
  lines.push("=== COMENTÁRIOS (mais recentes primeiro, até 10) ===");
  if (comments.length === 0) {
    lines.push("Nenhum comentário ainda.");
  }
  for (const c of comments.slice(-10).reverse()) {
    lines.push(`- ${c.author.name ?? c.author.email}: "${c.body.slice(0, 400)}"`);
  }

  return lines.join("\n");
}

async function buildContext(organizationId: string, contextType: string, contextId: string): Promise<string> {
  if (contextType === "Idea") return buildIdeaContext(organizationId, contextId);
  if (contextType === "Task") return buildTaskContext(organizationId, contextId);
  throw new CopilotError("Tipo de contexto inválido.", "NOT_FOUND");
}

// ── Chamada ao Gemini ────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new CopilotError(
      "Innovation Copilot não está configurado nesta instalação (GEMINI_API_KEY ausente).",
      "NOT_CONFIGURED",
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function askCopilot(organizationId: string, input: AskCopilotInput): Promise<string> {
  const contextText = await buildContext(organizationId, input.contextType, input.contextId);
  const genAI = getClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: `${COPILOT_SYSTEM_PREAMBLE}\n\n${contextText}`,
  });

  try {
    const chat = model.startChat({
      history: (input.history ?? []).map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
    });
    const result = await chat.sendMessage(input.question);
    const text = result.response.text();
    if (!text.trim()) {
      throw new CopilotError("O Gemini não devolveu uma resposta.", "PROVIDER_ERROR");
    }
    return text;
  } catch (err) {
    if (err instanceof CopilotError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new CopilotError(`Erro ao consultar o Gemini: ${message}`, "PROVIDER_ERROR");
  }
}

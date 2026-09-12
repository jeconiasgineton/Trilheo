import type { Role } from "./roles";

/**
 * Todas as ações protegidas por permissão, mapeadas para o papel
 * MÍNIMO necessário para executá-las (a hierarquia em roles.ts
 * garante que papéis acima também podem).
 *
 * Adicionar uma ação nova = adicionar uma linha aqui. Nunca fazer
 * checagem de papel "solta" em algum lugar do código — toda decisão
 * de permissão passa por este arquivo.
 *
 * Decisões (documentar junto ao CONTEXTO.MD ao aplicar):
 * - CONVIDADO não aparece como mínimo de nenhuma ação aqui: por
 *   padrão só enxerga/lê (leitura não passa por `can`, é tratada por
 *   escopo de query — todo convidado só vê o que está na organização
 *   dele). Se uma ação de leitura explícita for necessária, adicionar
 *   com "CONVIDADO" aqui.
 * - GESTOR é o menor papel que cria/edita Workspace e Space
 *   (estrutura "grande" do workspace) e que configura pipelines de
 *   inovação / boards (pipeline:manage, board:manage).
 * - LIDER é o menor papel que mexe em Folder/List, que pode excluir
 *   Task ou remover comentário/anexo de terceiros (moderação local)
 *   e que aprova/reprova ideias (idea:approve) ou exclui ideia de
 *   terceiro (idea:delete).
 * - MEMBRO é o menor papel que cria/edita Task, comenta, anexa,
 *   cria/edita e move ideias entre estágios não-finais — papel "de
 *   trabalho" padrão.
 * - Só ADMIN/OWNER mexem em membros e excluem Workspace (ação
 *   destrutiva de maior impacto).
 */
export const ACTIONS = {
  "organization:update": "GESTOR",

  "member:invite": "ADMIN",
  "member:changeRole": "ADMIN",
  "member:remove": "ADMIN",

  "workspace:create": "GESTOR",
  "workspace:update": "GESTOR",
  "workspace:delete": "ADMIN",

  "space:create": "GESTOR",
  "space:update": "GESTOR",
  "space:delete": "GESTOR",

  "folder:create": "LIDER",
  "folder:update": "LIDER",
  "folder:delete": "LIDER",

  "list:create": "LIDER",
  "list:update": "LIDER",
  "list:delete": "LIDER",

  "task:create": "MEMBRO",
  "task:update": "MEMBRO",
  "task:reorder": "MEMBRO",
  "task:delete": "LIDER",
  "task:assign": "LIDER",

  "comment:create": "MEMBRO",
  "comment:delete": "LIDER",

  "attachment:create": "MEMBRO",
  "attachment:delete": "LIDER",

  // Fase 2 (Inovação) — Marco 1.
  "board:manage": "GESTOR", // criar/editar/excluir boards de inovação
  "pipeline:manage": "GESTOR", // criar/editar/excluir pipelines e estágios
  "idea:create": "MEMBRO",
  "idea:update": "MEMBRO",
  "idea:move": "MEMBRO", // mover entre estágios não-finais
  "idea:approve": "LIDER", // mover para/sair de estágio final (aprovar/reprovar/reabrir)
  "idea:delete": "LIDER", // moderação local: autor exclui a própria; LIDER+ de terceiro

  // Fase 3 (Melhoria Contínua) — biblioteca de ferramentas (5 Porquês,
  // Ishikawa, 5W2H...) anexadas a uma Idea. Mesma política de
  // moderação local do comment/attachment.
  "tool:create": "MEMBRO",
  "tool:update": "MEMBRO",
  "tool:delete": "LIDER",

  // Fase 5 (Business Case) — aprovação em dois níveis fixos (não
  // configurável): GESTOR aprova primeiro, ADMIN aprova por último
  // (e essa aprovação final gera o "Projeto"/List automaticamente).
  // Rejeitar em cada estágio exige o mesmo papel mínimo da aprovação
  // daquele estágio (checado dinamicamente na action, não uma
  // permissão própria — mesmo padrão de idea:approve).
  "businesscase:create": "MEMBRO",
  "businesscase:update": "MEMBRO",
  "businesscase:submit": "MEMBRO",
  "businesscase:approve_gestor": "GESTOR",
  "businesscase:approve_admin": "ADMIN",
  "businesscase:delete": "LIDER",
  "businesscase:record_benefit": "MEMBRO",

  // Fase 6 (IA / Innovation Copilot) — mesma faixa de acesso de
  // quem já pode ler o objeto (comentar/anexar), não uma ação
  // destrutiva. GESTOR/LIDER/ADMIN/OWNER herdam por hierarquia.
  "copilot:use": "MEMBRO",

  // Fase 7 (Escala — coleta mobile) — GESTOR é o menor papel que
  // monta/edita formulários (estrutura, igual pipeline:manage);
  // MEMBRO é quem coleta em campo (igual task:create).
  "form:manage": "GESTOR",
  "form:submit": "MEMBRO",

  // Fase 7 (Escala — billing) — só OWNER assina/cancela/troca de
  // plano. Acima de ADMIN de propósito: envolve dinheiro de verdade
  // da organização, diferente de qualquer outra ação do sistema.
  "billing:manage": "OWNER",
} as const satisfies Record<string, Role>;

export type Action = keyof typeof ACTIONS;
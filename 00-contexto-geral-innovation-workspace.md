# CONTEXTO GERAL DO PROJETO — Innovation Workspace

> Cole este prompt para o Claude Code **antes** do prompt de implementação de qualquer fase. Ele não pede nenhuma implementação — é só para você ter a visão completa do produto e do plano, e usar esse contexto ao tomar decisões dentro de cada fase.

---

## 1. O que é o produto

**Innovation Workspace** — "Transforme ideias em resultados."

Uma plataforma SaaS B2B que une, em um único ambiente:

- Gestão da Inovação e Melhoria Contínua
- Gestão de Projetos e Tarefas (Kanban, Gantt, Lista, Calendário, Workload)
- Business Case (viabilidade econômica de ideias)
- Gestão de Indicadores e Benefícios (previsto x realizado)
- Knowledge Management (conhecimento gerado por projetos concluídos)
- IA contextual (Innovation Copilot)
- Formulários, QR Code, Whiteboard, Documentos colaborativos

**Posicionamento:** workspace flexível como o ClickUp + ambiente de conhecimento como o Notion + canvas colaborativo como o Miro, mas especializado em transformar inovação e melhoria contínua em resultados. **Não é para ser um clone de nenhum deles.**

## 2. O fluxo que é o coração do produto

```
IDEIA → BACKLOG → PRIORIZAÇÃO → MATRIZ GUT → ANÁLISE → DESENVOLVIMENTO DA SOLUÇÃO
→ BUSINESS CASE → APROVAÇÃO → PROJETO → EXECUÇÃO → VALIDAÇÃO → RESULTADO
→ BENEFÍCIO REALIZADO → CONHECIMENTO → REPLICAÇÃO
```

Princípio: a tarefa é o elemento operacional; a ideia é o elemento de origem; o projeto é o elemento de execução; o resultado é o elemento de valor; o conhecimento é o elemento de perpetuação. **O produto não deve, em nenhuma fase, parecer "um sistema de tarefas com um módulo de ideias" — deve parecer uma plataforma completa de gestão da inovação.**

## 3. Decisões de arquitetura já fechadas (valem para todas as fases)

- **Stack:** Next.js 14 (App Router) + TypeScript, Prisma + PostgreSQL, Tailwind + shadcn/ui, NextAuth, dnd-kit, BullMQ + Redis (automações/notificações), storage S3-compatible (anexos), Claude API (Innovation Copilot).
- **Multi-tenant desde a primeira tabela:** toda entidade abaixo de `Organization` carrega `organizationId` obrigatório e indexado. Nenhuma informação pode vazar entre organizações — isso é tratado como requisito de segurança, testado automaticamente em toda fase.
- **Hierarquia de workspace:** Organization → Workspace → Space → Folder → List → Task → Subtask. Flexível, não rígida — diferentes times podem organizar o trabalho de formas diferentes dentro dela.
- **Views não duplicam dados:** Kanban, Lista, Gantt, Calendário e Workload são todos leituras diferentes da mesma tabela `Task`, nunca cópias.
- **Relações polimórficas** para Comment, Attachment e CustomField (`*Type` + `*Id`) — para que qualquer entidade nova (Idea, Project, BusinessCase, Meeting...) reuse a mesma estrutura sem nova tabela.
- **Campos customizados** via JSONB + tabela de definição, não colunas dinâmicas.
- **Motor de automações genérico**: `trigger_event + condition_json + action_json`, interpretado por um engine único — nunca lógica de automação espalhada e hardcoded pelo código.
- **Arquitetura em monólito modular**: cada domínio (`workspace`, `innovation`, `tools`, `business-case`, `projects`, `automations`, `knowledge`, `ai-copilot`, `notifications`) vive em `/lib/modules/<dominio>`, com services e server actions próprios; nada acessa o Prisma diretamente fora do módulo dono da entidade.

## 4. As fases do projeto

O projeto será implementado de forma incremental. **Cada fase será passada para você em um prompt separado**, só depois que a fase anterior estiver validada. Esta é a visão geral de todas elas, para contexto — não implemente nada além da fase que for explicitamente pedida em cada prompt:

1. **Fundação** — autenticação, organizações/multi-tenant, hierarquia Workspace→Task, Kanban, Lista, comentários, anexos, permissões (Owner/Admin/Gestor/Líder/Membro/Convidado).
2. **Inovação** — QR Code, formulário de captura de ideias, backlog, pipeline configurável, Matriz GUT, Score de inovação configurável, Innovation Workspace (contêiner da ideia).
3. **Melhoria Contínua** — biblioteca de ferramentas interativas (5 Porquês, Ishikawa, Pareto, SIPOC, 5W2H, PDCA, A3, brainstorming), cada uma capaz de gerar Tasks a partir de causas/ações identificadas.
4. **Projetos** — Gantt, dependências, milestones, workload, dashboards personalizáveis.
5. **Business Case** — formulário de Business Case, cálculo automático de ROI/Payback/CAPEX/OPEX, workflow de aprovação multi-nível, geração automática de Projeto a partir da aprovação, gestão de benefícios (previsto x realizado).
6. **IA (Innovation Copilot)** — camada de IA contextual plugada em Idea, Task, Project, A3, Business Case, Meeting e Dashboard — cada contexto usa os dados reais do objeto aberto, nunca uma resposta genérica.
7. **Escala** — mobile avançado, integrações externas (e-mail, futura integração com WhatsApp), automações avançadas, Knowledge Hub com busca inteligente, replicação de soluções, marketplace de templates.

## 5. Regras de trabalho válidas para todas as fases

- Prioridades ao tomar uma decisão técnica não especificada: experiência do usuário > diferencial do produto > simplicidade > escalabilidade > segurança > manutenibilidade > performance.
- Nunca duplicar dados entre módulos ou views.
- Nunca implementar uma funcionalidade de fase futura "de brinde" — mas sempre deixar o modelo de dados da fase atual pronto para que as futuras encaixem sem migração estrutural pesada.
- Uma funcionalidade só é considerada concluída quando: UX está adequada, dados são persistidos corretamente, relacionamentos funcionam, permissões estão corretas, erros são tratados, a tela é responsiva e há testes automatizados cobrindo o comportamento — não apenas "o botão funciona".

---

Confirme que entendeu esse contexto geral. Na sequência, vou te passar o prompt de implementação da Fase 1 (Fundação).

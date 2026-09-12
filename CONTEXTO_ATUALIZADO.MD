# CONTEXTO.MD — Trilheo

> Arquivo de contexto vivo do projeto. Atualizado ao final de cada marco importante — histórico completo em "Changelog" no final.

## Produto

**Trilheo** (codinome interno durante o desenvolvimento: "Innovation Workspace") — SaaS B2B que une, em um único ambiente: Gestão da Inovação, Melhoria Contínua, Projetos/Tarefas, Business Case, Indicadores/Benefícios, Knowledge Management e IA contextual (Innovation Copilot).

Posicionamento: workspace flexível (como ClickUp) + ambiente de conhecimento (como Notion) + canvas colaborativo (como Miro), especializado em transformar inovação e melhoria contínua em resultados. Fluxo central: `IDEIA → BACKLOG → PRIORIZAÇÃO → MATRIZ GUT → ANÁLISE → SOLUÇÃO → BUSINESS CASE → APROVAÇÃO → PROJETO → EXECUÇÃO → VALIDAÇÃO → RESULTADO → BENEFÍCIO → CONHECIMENTO → REPLICAÇÃO`.

## Nome e domínio

- Nome comercial definido: **Trilheo**.
- `trilheo.com` e `.com.br` disponíveis (verificado em 11/09/2026).
- Pré-busca INPI (exata e por radical) sem conflitos (base atualizada até 08/09/2026) — falta ainda checar por classe de Nice (9/35/42) antes do registro oficial.

## Pasta do projeto

Código-fonte vive em `C:\Projetos\Trilheo` na máquina do usuário. Desenvolvimento e verificação acontecem num sandbox cloud (sem acesso à internet — ver "Limitações do ambiente" abaixo) e depois são sincronizados para essa pasta.

## Stack (fixada, não trocar sem justificar)

Next.js 14 (App Router) + TypeScript · Prisma + PostgreSQL · Tailwind + shadcn/ui · NextAuth (Auth.js) · dnd-kit · Vitest.

## Arquitetura

- Multi-tenant desde a primeira tabela: toda entidade abaixo de `Organization` carrega `organizationId` obrigatório e indexado.
- Hierarquia: `Organization → Workspace → Space → Folder → List → Task → Subtask`.
- Kanban/Lista/Gantt/Calendário/Workload são leituras diferentes da mesma tabela `Task` — nunca cópias.
- `Comment`/`Attachment` polimórficos (`*Type` + `*Id`) para reuso por `Idea`, `Project`, `BusinessCase` etc. nas próximas fases.
- Monólito modular: cada domínio em `/lib/modules/<dominio>`; nada acessa o Prisma fora do módulo dono da entidade.

## Status por fase

- **Fase 1 — Fundação**: em andamento.
  - [x] `schema.prisma` completo e aprovado pelo usuário (11/09/2026).
  - [x] Estrutura de pastas do projeto criada.
  - [x] Módulo `permissions` (matriz de papéis x ações) — já estava implementado e testado quando este arquivo foi retomado nesta sessão (ver changelog).
  - [x] Módulo `auth` (signup, login, convite de membro) — service + server actions + NextAuth (Credentials/JWT) implementados nesta sessão.
  - [x] Telas de login/signup.
  - [x] Módulo `workspace` (Workspace/Space/Folder/List) — CRUD + reorder no service/actions; UI com reorder por botões ↑/↓ (drag & drop de verdade fica para quando dnd-kit entrar, junto do Kanban).
- [x] Módulo `task` + Kanban/Lista — implementado nesta sessão (ver "Decisões técnicas (módulo `task`)" abaixo).
- [x] Comentários/anexos polimórficos aplicados à Task — implementado nesta sessão (ver "Decisões técnicas (módulos `comment` e `attachment`)" abaixo).
- [x] Seed script — implementado nesta sessão (`prisma/seed.ts`, ver changelog).
- **Fase 2 / Marco 1 (Inovação — Idea, IdeaBoard, pipeline configurável): CONCLUÍDO.** Módulo `lib/modules/innovation` (constants, schemas, service, actions, testes puros), models `IdeaPipeline`/`IdeaPipelineStage`/`IdeaBoard`/`Idea` no Prisma, UI Kanban (dnd-kit) + gerenciamento de pipelines, seed atualizado. Comment/Attachment polimórficos aceitam `Idea`.
- Fases 2/ Marcos 2+ e Fases 3–7 (Melhoria Contínua, Projetos, Business Case, IA, Escala): não iniciadas.

## Limitações do ambiente (importante para quem continuar este trabalho)

O sandbox cloud onde o código é escrito **não tem acesso à internet liberado** para este ambiente (registry.npmjs.org, PyPI e GitHub retornam 403 — bloqueio de rede a nível de organização, não das ferramentas). Na prática isso significa:

- **Não é possível rodar `npm install`, `npm run build` ou `npm test` no sandbox.** O código é escrito e revisado manualmente, mas a validação real (compilação TypeScript, execução dos testes Vitest, `prisma generate`/`migrate`) precisa acontecer na máquina do usuário.
- Este ambiente também não tem um terminal na máquina do usuário (sem `device_bash` disponível nesta sessão) — só consegue ler/gravar arquivos lá. Ou seja, **o usuário precisa rodar `npm install` e `npm test` localmente** e reportar erros de volta, se houver.
- Se um administrador da organização liberar acesso de rede mais amplo (Admin settings → Capabilities), isso pode ser resolvido — mas é uma decisão do usuário/organização, não algo a ser contornado.

## Decisões de modelagem (Fase 1)

- `organizationId` adicionado também em `Space`, `Folder` e `List` (o sketch do prompt original só mostrava em Workspace/Task/Comment/Attachment; a regra geral exige em toda entidade abaixo de `Organization`).
- `MemberRole` é enum Prisma (papéis fixos da plataforma); `Task.status`/`priority` são `String` (validados na aplicação) para permitir pipelines configuráveis nas fases futuras.
- Subtask (`Task.parentTaskId`) com `onDelete: Cascade` — decisão reversível.
- NextAuth com Credentials + sessão JWT (sem tabelas de adapter Account/Session/VerificationToken), pois autenticação é via `passwordHash` local.
- Convite de membro (Fase 1, função 2): sem serviço de e-mail configurado na stack ainda, então o fluxo cria a conta com senha temporária gerada pelo sistema, retornada ao admin para repassar manualmente. Revisar quando um provedor de e-mail for definido.

## Decisões técnicas (módulo `auth`)

- `lib/db.ts`: singleton do `PrismaClient` guardado em `globalThis` (evita esgotar conexões do Postgres com o Fast Refresh do Next em dev). Todo módulo deve importar `db` daqui — nenhum import direto de `@prisma/client` fora deste arquivo.
- NextAuth: só `CredentialsProvider`, sessão `strategy: "jwt"`, sem `PrismaAdapter` (consistente com a decisão já registrada acima — sem tabelas de adapter). O JWT carrega `userId`/`organizationId`/`organizationSlug`/`role` e replica em `session.user`; papel só é atualizado no próximo login (aceitável por ora — revisar se "revogação imediata de papel" virar requisito).
- Um `User` tem, na prática, uma única `OrganizationMember` nesta fase (schema permite mais, mas nada no fluxo cria uma segunda). `verifyCredentials` pega a primeira membership — revisar se/quando suporte a multi-organização por usuário for implementado.
- Componentes em `components/ui/` (`Button`/`Input`/`Label`) foram escritos à mão seguindo a convenção do shadcn/ui (`cva` + `cn()` em `lib/utils.ts`), não gerados pelo CLI oficial (sandbox sem acesso à internet). Funcionalmente equivalentes; trocar pelo CLI quando houver rede, se for importante ter exatamente os componentes oficiais.
- `tailwind.config.ts` ganhou tokens de cor (`border`/`background`/`foreground`/`muted`/`primary`/`destructive`) mapeados para variáveis CSS definidas em `app/globals.css` — necessário para os componentes acima e para o restante da UI que vier depois.
- `vitest.config.ts` criado com alias `@` (espelhando `tsconfig.json`) — o módulo `permissions` não precisava disso por usar só imports relativos; `auth` já usa `@/lib/...`, e os módulos seguintes também vão usar.
- **Pendência importante**: `createOrganizationWithOwner`, `verifyCredentials` e `inviteMember` (tocam o Prisma) não têm teste automatizado ainda — só as funções puras (`slugify`, `generateTemporaryPassword`, schemas zod) foram testadas, porque este ambiente não tem Postgres disponível. Isso inclui o teste do critério de aceite "duas organizações não se veem" — ainda não implementado, precisa ser feito assim que houver um banco de teste (Claude Code local).

## Decisões técnicas (módulo `workspace`)

- `service.ts` expõe CRUD + reorder de Workspace/Space/Folder/List, sempre recebendo `organizationId` como primeiro parâmetro (nunca lido da URL) e filtrando por ele em toda query — inclusive nas checagens de que o pai (`workspaceId`/`spaceId`/`folderId`) pertence à mesma organização antes de criar um filho.
- `WorkspaceError` (código `NOT_FOUND`) é lançado tanto para "não existe" quanto para "existe em outra organização" — de propósito, para nunca dar a um usuário mal-intencionado uma forma de diferenciar as duas coisas (evita enumeração cross-tenant).
- Reorder: `reorder.ts#computeOrderUpdates` é uma função pura (só recalcula `order` 0..n-1 a partir de uma lista de ids já na ordem final) — testável sem banco. O service persiste isso numa transação, revalidando que cada id pertence ao pai/organização esperados.
- Reordenar não tinha uma `Action` própria em `permissions/actions.ts` — decisão: reusar `space:update`/`folder:update`/`list:update` como permissão mínima para reordenar aquele nível, em vez de criar `*:reorder` novas. Revisar se algum papel precisar reordenar sem poder renomear.
- **UI desta fase usa botões ↑/↓ para reordenar, não drag & drop de verdade.** O prompt original pede drag & drop já na hierarquia de workspace, mas `dnd-kit` só entra como dependência quando o Kanban for implementado (próximo módulo) — decisão de não introduzir a lib duas vezes; quando o Kanban chegar, a mesma interação de drag & drop é reaproveitada aqui. Sinalizar para o usuário se isso for uma regressão inaceitável antes de prosseguir.
- Isolamento por organização também na camada de URL: `app/(dashboard)/[orgSlug]/layout.tsx` confere que `orgSlug` da URL bate com `session.user.organizationSlug` e devolve 404 (não redirect) se não bater — evita que um usuário autenticado em uma org sequer abra a rota de outra.
- Página de uma Space (`workspace/[spaceId]/page.tsx`) trata `WorkspaceError` (`NOT_FOUND`) como 404 do Next — mesma lógica de não revelar se o id pertence a outra organização.
- **Mesma pendência do módulo `auth`**: nenhuma função do `service.ts` que toca o Prisma tem teste de integração ainda (sem Postgres neste ambiente); só `computeOrderUpdates` foi testada.

## Decisões técnicas (módulo `task`)

- `lib/modules/task/` segue a mesma arquitetura dos módulos `auth`/`workspace`: `service.ts` (CRUD + reorder + move, sempre recebendo `organizationId` da sessão e filtrando por ele), `schemas.ts` (zod), `actions.ts` (server actions com sessão + `requirePermission`), `constants.ts` (conjunto padrão de status/prioridade — String no banco, validado na app, por decisão de modelagem da Fase 1), `index.ts` (re-exports) e `status.test.ts` (testes das funções puras de validação de status/prioridade).
- Status padrão da Fase 1: `backlog`, `todo`, `in_progress`, `review`, `done`. Prioridades: `low`, `medium`, `high`, `urgent`. É só o conjunto padrão; o banco guarda `String` para que fases futuras (pipeline de inovação) tenham status configuráveis por organização sem migração.
- `order` é global por lista (não por coluna do Kanban). A view Lista ordena por `order`; o Kanban agrupa por `status` e ordena cada coluna por `order`. Reordenação (Lista, via botões ↑/↓) recalcula `order` 0..n-1 das tasks top-level da lista. Mover card entre colunas no Kanban só muda `status` (`moveTask`); reordenar dentro de uma mesma coluna do Kanban fica para depois (a Lista cobre reordenação nesta fase).
- Kanban e Lista leem a mesma tabela `Task` — a página carrega `listTasksByStatus` (uma query) e a Lista é só um achatamento desse resultado, sem query extra. Atende ao critério de aceite "tarefa criada/editada na Lista aparece no Kanban e vice-versa, sem duplicação de registro".
- Subtarefas: `parentTaskId` (self-relation, cascade). Kanban/Lista mostram só tasks top-level (`parentTaskId: null`); subtarefas são geradas e gerenciadas no modal de edição da task-pai. Criar subtarefa = `createTask` com `parentTaskId`.
- `task:assign` (papel mínimo LIDER) é checado além de `task:create`/`task:update` sempre que `assigneeId` é definido — definir responsável é uma ação de coordenação. A UI desabilita o select de responsável para papéis menores e não envia `assigneeId` no payload.
- `getTaskWithDetails` inclui subtasks e assignee, mas ainda NÃO inclui comentários/anexos — esses vêm no próximo marco, junto do módulo deles (item 6 da Fase 1).
- Novas funções de leitura em módulos existentes: `getListSummary(organizationId, listId)` adicionada a `workspace/service.ts` (módulo dono de `List`) para o breadcrumb da página de tasks; `listOrganizationMembers(organizationId)` adicionada a `auth/service.ts` (módulo dono de `OrganizationMember`) para o select de responsável. Ambas chamadas direto no server component da página (mesmo padrão do `workspace/page.tsx`), sem action — leitura não passa por `requirePermission`.
- Novos componentes UI: `components/ui/textarea.tsx` e `components/ui/select.tsx` (select nativo estilizado, sem `@radix-ui/react-select` que não está no `package.json`), seguindo a convenção dos `Button`/`Input`/`Label` existentes.
- **Mesma pendência dos outros módulos**: nenhuma função do `service.ts` que toca o Prisma tem teste de integração ainda (sem Postgres neste ambiente); só `status.test.ts` (funções puras) e os testes já existentes (`computeOrderUpdates`, `permissions`, funções puras do `auth`) rodam. O teste do critério "duas organizações não se veem" continua pendente, precisa de Postgres real (Claude Code local).

## Decisões técnicas (módulos `comment` e `attachment`)

- Os modelos `Comment` e `Attachment` **já existiam no `schema.prisma`** desde a fundação (Fase 1, item de modelagem) com relação polimórfica (`commentableType`/`commentableId`, `attachableType`/`attachableId`) — propositalmente sem relation nativa do Prisma, para que nas próximas fases `Idea`, `Project`, `BusinessCase` etc. reusam as mesmas tabelas sem migração. As permissões (`comment:create`/`comment:delete`, `attachment:create`/`attachment:delete`) também já estavam no `permissions/actions.ts`. Esta sessão só implementou o código dos módulos e a UI.
- `lib/modules/comment/` e `lib/modules/attachment/` seguem a mesma arquitetura de `auth`/`workspace`/`task`: `constants.ts` (tipos polimórficos válidos — hoje só `"Task"`), `schemas.ts` (zod), `service.ts` (CRUD sempre filtrado por `organizationId`, com `assertCommentableInOrg`/`assertAttachableInOrg` que valida que o alvo existe e pertence à org — defesa contra comentar/anexar numa task de outra org só mandando o `id`), `actions.ts` (server actions com sessão + `requirePermission`) e `index.ts`.
- **Moderação local** (regra de exclusão): o AUTOR sempre pode excluir o próprio comentário/anexo (qualquer papel com `comment:create`/`attachment:create`, ou seja MEMBRO+); excluir comentário/anexo DE OUTRO exige `comment:delete`/`attachment:delete` (LIDER+). A checagem de posse (authorId/uploadedById) fica no action; o service só exclui filtrado por org. Bate com a nota do `permissions/actions.ts`: "LIDER é o menor papel que... remove comentário/anexo de terceiros (moderação local)".
- **Upload de anexos**: rota `app/api/upload/route.ts` salva o arquivo em `public/uploads/<uuid>.<ext>` (máx. 50MB, igual ao schema) e devolve `{ url, filename, mimeType, sizeBytes }`. A UI faz duas etapas: 1) `POST /api/upload` (gera a URL); 2) `createAttachmentAction` registra o metadado no banco (validando que a task é da org). É a solução de dev local (arquivo em disco); para produção, trocar por storage em nuvem (S3/R2) com path por organização — o campo `url` no banco é opaco. `/public/uploads/` adicionado ao `.gitignore`.
- **UI**: criada a página de detalhe da task (`app/(dashboard)/[orgSlug]/workspace/[spaceId]/list/[listId]/task/[taskId]/`) — server component carrega task (via `getTaskWithDetails`, que já traz subtasks + assignee), comentários (`listComments`) e anexos (`listAttachments`) em paralelo, mais `getListSummary` (breadcrumb) e `listOrganizationMembers` (select de responsável no modal). O cliente (`task-detail-client.tsx`) renderiza header da task, descrição, subtarefas (lista), seção de anexos (`attachment-section.tsx`, com upload) e seção de comentários (`comment-section.tsx`). O botão "Editar" reabre o mesmo `TaskDialog` do quadro (reuso, sem duplicar lógica de edição/subtarefas). Mutações usam server actions + `router.refresh()`.
- **Navegação até o detalhe**: o título da task na view Lista virou link para a página de detalhe; o `TaskDialog` (modo edição) ganhou um link "Ver detalhes & comentários ↗". O Kanban mantém o clique-no-card abrindo o modal (sem mudança de comportamento); o detalhe é alcanável pelo link no modal.
- **Mesma pendência dos outros módulos**: sem Postgres no sandbox, nenhuma função do `service.ts` que toca o Prisma tem teste de integração; a rota de upload e o seed também não foram executados. Validação real (incluindo o fluxo de upload de arquivo ponta a ponta) fica para o Claude Code local.## Changelog

- **11/09/2026** — Nome "Trilheo" aprovado (domínio e pré-busca INPI ok). Schema Fase 1 apresentado e aprovado. Scaffold do projeto (estrutura de pastas + configs) gravado em `C:\Projetos\Trilheo`. Descoberto bloqueio de rede no sandbox cloud (ver seção acima). Criado este arquivo de contexto.
- **11/09/2026** — Como o sandbox cloud não tem acesso à internet (não dá para `npm install`/testar), a implementação a partir daqui foi passada para uma sessão de Claude Code rodando localmente na máquina do usuário (que tem acesso normal à rede). Criado `PROMPT-CONTINUACAO-CLAUDE-CODE.md` (raiz do projeto) com todo o histórico e os próximos passos, e `docs/prompt-fase1-original.md` com o prompt original completo da Fase 1, para nada se perder na transição. Nenhum módulo de código (auth/permissions/workspace/task) foi escrito ainda — só schema + scaffold.
- **11/09/2026** — Retomado no chat (créditos do Claude Code aguardando renovação). Ao reabrir o projeto, o módulo `permissions` já estava implementado e testado (`roles.ts`, `actions.ts`, `index.ts`, `permissions.test.ts`) — não há registro de quando/onde isso foi feito; ficou documentado agora para não se perder. Implementado o módulo `auth` completo: `lib/db.ts` (Prisma singleton), `schemas.ts` (zod: signup/login/convite), `service.ts` (`createOrganizationWithOwner`, `verifyCredentials`, `inviteMember`, `slugify`, `generateTemporaryPassword`), `auth-options.ts` (NextAuth Credentials + JWT com `organizationId`/`role`), `actions.ts` (`signupAction`, `inviteMemberAction`) e o route handler `app/api/auth/[...nextauth]`. Criadas as telas de login e signup, layout raiz (`app/layout.tsx` + `globals.css`), componentes base (`Button`/`Input`/`Label`), `middleware.ts` protegendo rotas autenticadas, e `app/page.tsx` redirecionando por sessão. Expandido `tailwind.config.ts` com tokens de cor. Criado `vitest.config.ts` e testes das funções puras do `auth` (ver "Decisões técnicas" acima para detalhes e pendências). **Nada disso foi validado com `npm install`/`build`/`test`** — mesma limitação de rede do sandbox; validação real fica para quando o Claude Code local retomar.
- **11/09/2026** — Implementado o módulo `workspace` completo (Fase 1, item 4): `service.ts` com CRUD + reorder de Workspace/Space/Folder/List (sempre isolado por `organizationId`), `reorder.ts` (função pura de recálculo de ordem, testada), `schemas.ts` (zod) e `actions.ts` (server actions com sessão + `requirePermission`). Criadas as telas: listagem de Workspaces/Spaces (`workspace/page.tsx` + `workspace-list-client.tsx`) e detalhe de uma Space com Folders/Lists (`workspace/[spaceId]/page.tsx` + `space-detail-client.tsx`), reordenação nesta fase via botões ↑/↓ (não drag & drop — ver "Decisões técnicas" acima sobre adiar `dnd-kit` para o Kanban). Adicionados `app/(dashboard)/layout.tsx` (header com nome do usuário e logout) e `app/(dashboard)/[orgSlug]/layout.tsx` (garante que a organização da URL bate com a da sessão, devolvendo 404 caso contrário — reforço de isolamento multi-tenant na camada de UI). Continua sem validação de `npm install`/`build`/`test` (mesma limitação de rede).

- **11/09/2026** (continuação no chat, enquanto o Claude Code local renova créditos) — Implementado o módulo `task` completo (Fase 1, item 5): `lib/modules/task/` com `service.ts` (CRUD de task + subtarefas + reorder + move entre colunas, sempre isolado por `organizationId`), `schemas.ts` (zod), `actions.ts` (server actions com sessão + `requirePermission`, checando `task:assign` ao definir responsável), `constants.ts` (status/prioridade padrão, `String` validado na app), `index.ts` e `status.test.ts` (funções puras). Criadas as telas: página do quadro de tasks de uma Lista (`app/(dashboard)/[orgSlug]/workspace/[spaceId]/list/[listId]/`) com alternador Kanban/Lista, Kanban com dnd-kit (drag & drop entre colunas atualiza `status`), Lista em tabela com filtros (status/prioridade/responsável) e reordenação ↑/↓, e modal de criar/editar task com subtarefas. Kanban e Lista leem a mesma tabela `Task` (uma query, sem duplicação). Adicionados `getListSummary` a `workspace/service.ts` e `listOrganizationMembers` a `auth/service.ts`, e os componentes `Textarea` e `Select`. Atualizado o `space-detail-client` para linkar cada Lista ao seu quadro de tasks. Continua sem validação de `npm install`/`build`/`test` (mesma limitação de rede do sandbox); teste de isolamento multi-tenant e testes de integração do `task` pendentes, no Claude Code local.

- **11/09/2026** (continuação no chat) — Implementados os módulos `comment` e `attachment` (Fase 1, item 6) e o seed script (item 7). Os modelos `Comment`/`Attachment` (polimórficos via `commentableType`/`attachableType`) e as permissões já existiam no schema; esta sessão criou `lib/modules/comment/` e `lib/modules/attachment/` (`constants.ts`, `schemas.ts`, `service.ts` com `assertCommentableInOrg`/`assertAttachableInOrg`, `actions.ts` com regra de moderação local — autor exclui o próprio, LIDER+ exclui de terceiro, `index.ts`). Criada a rota `app/api/upload/route.ts` (salva anexo em `public/uploads/`, máx. 50MB, devolve URL + metadados). Criada a página de detalhe da task (`.../list/[listId]/task/[taskId]/`) com seções de comentários e anexos (upload em duas etapas: `/api/upload` → `createAttachmentAction`), reusando o `TaskDialog` para editar. Título da task na Lista virou link para o detalhe; modal ganhou link "Ver detalhes & comentários". `/public/uploads/` adicionado ao `.gitignore`. Criado `prisma/seed.ts` (org "Innovation Demo", 3 usuários OWNER/LIDER/MEMBRO senha `demo12345`, workspace/space/folder/list, tasks com subtask, comentários e anexo). Continua sem validação de `npm install`/`build`/`test` (limitação de rede do sandbox); fluxo de upload e seed precisam ser validados no Claude Code local.


---

## Decisões técnicas — Fase 2 / Marco 1 (Inovação)

- **Módulo `innovation`** espelha a arquitetura da Fase 1: `constants` (tipos/labels/defaults), `schemas` (Zod), `service` (Prisma + isolamento por `organizationId` + regras de workflow), `actions` (Server Actions com verificação de permissão via `can(role, action)`), `index` (barrel), `pipeline.test.ts` (testes puros de lógica).
- **Pipeline configurável e compartilhável:** `IdeaPipeline → IdeaPipelineStage` (1:N). Um board referencia um pipeline (padrão); estágios são `stageType` String (não enum) pela mesma filosofia de `Task.status` — flexível para customização por organização. Estágios terminais (`isFinal`) representam Aprovada/Reprovada/Convertida.
- **IdeaBoard** pode sentar opcionalmente numa `Space` (`spaceId` nullable, `onDelete: SetNull`); `slug` único por organização. `Idea` carrega `source` (MANUAL | QR | FORM) String validado na app.
- **Workflow de aprovação:** mover ideia para/sair de estágio final exige `idea:approve` (LIDER+); o service revalida a regra do estágio final independentemente do client. Mover entre estágios não-finais é `idea:move` (MEMBRO+).
- **Moderação local:** autor exclui a própria ideia; excluir ideia de terceiro exige `idea:delete` (LIDER+), mesma política de comentário/anexo da Fase 1.
- **Reuso polimórfico:** `Comment` e `Attachment` aceitam `commentableType`/`attachableType` = "Idea" sem migração nova — só estender a constante e o `assert…InOrg` do service.
- **UI:** Kanban com `@dnd-kit/core` (mesma biblioteca já usada no Kanban de tasks); gerenciamento de pipelines/stages com reordenação por botões ↑/↓ (paridade com a hierarquia de workspace da Fase 1).

## Changelog

- **2026-09-11 — Fase 2 / Marco 1 (Inovação) entregue.** Criado módulo `innovation` completo, models Prisma (`IdeaPipeline`, `IdeaPipelineStage`, `IdeaBoard`, `Idea`), UI (lista de boards, Kanban de ideias, gerenciamento de pipelines), permissões (`board:manage`, `pipeline:manage`, `idea:create/update/move/approve/delete`), extensão polimórfica de Comment/Attachment para `Idea` e seed atualizado com pipeline + ideias de demonstração.

---

## Atualização consolidada — última entrega analisada (11/09/2026)

### Snapshot utilizado para esta atualização

Esta versão do contexto foi revisada a partir do `CONTEXTO.MD` anterior e do snapshot mais recente do projeto enviado em `Trilheo.zip`. O snapshot identifica a versão do projeto como **0.2.0** no `package.json` e traz a entrega **Fase 2 / Marco 1 — Inovação**.

### Fase 2 / Marco 1 — estado funcional identificado

O módulo `lib/modules/innovation` está estruturado com:

- `constants.ts`
- `schemas.ts`
- `service.ts`
- `actions.ts`
- `index.ts`
- `pipeline.test.ts`

A arquitetura mantém o mesmo padrão dos módulos anteriores:

`Server Action → sessão → Zod → permissão → service → Prisma`

e o `organizationId` é obtido da sessão e usado pelo service como escopo de todas as operações.

### Pipeline de Inovação

Foi implementado o conceito de pipeline configurável:

- `IdeaPipeline` é 1:N com `IdeaPipelineStage`.
- Um pipeline pode ser utilizado por vários boards.
- Ao criar um pipeline, o service cria automaticamente os estágios padrão em uma transação.
- Ordem dos estágios é persistida em `order`.
- Estágios podem ser criados, editados, excluídos e reordenados.
- Exclusão de pipeline em uso por board é bloqueada com erro de negócio `PIPELINE_IN_USE`.
- O gerenciamento de pipelines/stages é protegido por `pipeline:manage` (GESTOR+).

Estágios padrão disponíveis:

`BACKLOG → TRIAGE → ANALYSIS → APPROVED / REJECTED`

O conjunto de `STAGE_TYPES` também contempla `CONVERTED`, reservado para evolução do fluxo.

### Estágios finais e aprovação

A regra de workflow está explicitamente implementada no service:

- `APPROVED`, `REJECTED` e `CONVERTED` são tipos finais padrão.
- Entrada em estágio final exige `idea:approve` (LIDER+).
- Saída de estágio final também exige aprovação explícita.
- Movimentações entre estágios não-finais exigem apenas `idea:move` (MEMBRO+).
- O service revalida a regra independentemente da UI.
- Erros específicos:
  - `APPROVE_REQUIRED`
  - `EXIT_FINAL_REQUIRES_APPROVE`

`isFinal` também existe no banco, permitindo que um estágio customizado seja marcado como terminal. A classificação automática por `stageType` continua restrita aos tipos padrão.

### IdeaBoard

Foi implementado o contêiner de ideias:

- `IdeaBoard` pertence obrigatoriamente a uma organização.
- Possui `name`, `slug`, `description`.
- `slug` é único dentro da organização (`@@unique([organizationId, slug])`).
- Pode ser associado opcionalmente a uma `Space`.
- Utiliza um `IdeaPipeline` obrigatório.
- Um pipeline pode ser compartilhado por vários boards.
- `board:manage` é a permissão mínima para criar/editar/excluir boards (GESTOR+).

A UI inclui:

- lista de boards;
- contagem de ideias;
- pipeline utilizado;
- Space associada, quando houver;
- criação de board;
- exclusão de board;
- acesso ao board para visualização das ideias;
- acesso ao gerenciamento de pipelines.

### Ideias

O model `Idea` foi consolidado com:

- `organizationId`
- `boardId`
- `pipelineStageId`
- `title`
- `description`
- `authorId`
- `source`
- timestamps

Origens previstas:

- `MANUAL`
- `QR`
- `FORM`

Nesta entrega, a criação pela UI utiliza `MANUAL`. QR Code e Formulário ficam para marcos posteriores.

Criação/edição:

- `idea:create` — MEMBRO+
- `idea:update` — MEMBRO+

A ideia é criada no estágio informado ou, se omitido, no primeiro estágio do pipeline pela menor ordem.

### Kanban de Inovação

Foi implementado Kanban com `@dnd-kit/core`.

Características:

- uma coluna por estágio do pipeline;
- cards representam registros reais de `Idea`;
- drag & drop movimenta a ideia entre estágios;
- não existe duplicação de registros;
- a movimentação passa pelo service e pelas regras de aprovação;
- estágios finais são tratados de maneira diferente dos estágios intermediários;
- UI usa as cores configuradas no estágio;
- `color` é armazenado como hexadecimal no banco.

### UI da Inovação

Foram criadas/atualizadas as telas:

```text
/[orgSlug]/innovation
/[orgSlug]/innovation/[boardId]
/[orgSlug]/innovation/pipelines
```

Componentes principais:

```text
innovation-list-client.tsx
board-client.tsx
idea-kanban.tsx
idea-dialog.tsx
pipelines-client.tsx
```

A tela de pipeline permite:

- criar pipeline;
- renomear pipeline;
- excluir pipeline quando não estiver em uso;
- criar estágio;
- editar estágio;
- excluir estágio;
- alterar ordem dos estágios por ↑/↓.

A tela do board permite:

- visualizar ideias por estágio;
- criar ideia;
- editar ideia;
- mover ideia por drag & drop;
- visualizar título, descrição, origem e informações do fluxo conforme implementado na UI.

### Permissões adicionadas na Fase 2

Foram adicionadas ao registro central `lib/modules/permissions/actions.ts`:

```text
board:manage       → GESTOR
pipeline:manage    → GESTOR
idea:create        → MEMBRO
idea:update        → MEMBRO
idea:move          → MEMBRO
idea:approve       → LIDER
idea:delete        → LIDER
```

A regra de exclusão segue a política de moderação local:

- autor pode excluir a própria ideia;
- LIDER+ pode excluir ideia de terceiro.

### Polimorfismo ampliado

`Comment` e `Attachment`, originalmente preparados para reuso, passaram a aceitar também:

```text
commentableType = "Idea"
attachableType  = "Idea"
```

Sem criação de novas tabelas.

O seed já cria comentário em uma ideia como prova do reuso do modelo polimórfico.

### Seed atualizado

`prisma/seed.ts` foi atualizado para demonstrar o Marco 1.

Além dos dados da Fase 1, o seed cria:

- organização `Innovation Demo`;
- pipeline `Pipeline de Inovação`;
- 5 estágios;
- board `Inovação de Produto`;
- 4 ideias distribuídas entre estágios;
- comentário polimórfico em uma ideia.

Usuários de demonstração permanecem:

```text
owner@demo.com
lider@demo.com
membro@demo.com

senha: demo12345
```

### Testes do Marco 1

Existe:

```text
lib/modules/innovation/pipeline.test.ts
```

para lógica pura do módulo.

O teste de integração com PostgreSQL continua pendente.

Isso significa que ainda NÃO está comprovado automaticamente, no snapshot analisado, o critério completo:

> duas organizações distintas não conseguem, por nenhum caminho da UI ou API, visualizar ou modificar dados umas das outras.

### Observações de consistência encontradas nesta atualização

1. **URL do board**
   - O `IdeaBoard` possui `slug` único por organização e o comentário do service descreve uma URL amigável por slug.
   - Porém a implementação atual da página utiliza a rota `innovation/[boardId]`.
   - Decidir posteriormente se a URL oficial será por `boardId` ou por `boardSlug`. Não alterar sem necessidade, mas registrar a decisão para evitar divergência documental.

2. **Status configurável**
   - `stageType` é `String` no Prisma e existe intenção de extensibilidade.
   - Entretanto os schemas atuais validam contra o conjunto fixo `STAGE_TYPES`.
   - Portanto, customização real de tipos ainda NÃO está implementada; a estrutura está preparada para evolução futura.

3. **`isFinal` versus `stageType`**
   - O banco permite `isFinal=true` em estágio customizado.
   - A função `isFinalStageType()` reconhece automaticamente apenas os tipos finais padrão.
   - As regras de workflow devem continuar considerando explicitamente `isFinal` quando a customização de estágios for ampliada.

4. **Multi-tenant**
   - O service da inovação segue o padrão de filtrar por `organizationId`.
   - Ainda falta a suíte de testes de integração cross-tenant para transformar essa proteção de implementação em requisito comprovado.

5. **Upload**
   - O upload local da Fase 1 continua baseado em `public/uploads`.
   - Para produção, permanece a decisão registrada de migrar para storage privado em nuvem com URL assinada/controle de acesso.

6. **Multi-organização por usuário**
   - O schema continua permitindo múltiplas memberships.
   - O fluxo atual de autenticação continua tratando, na prática, a primeira membership.
   - Suporte real a múltiplas organizações por usuário permanece pendente.

7. **Validação de produção**
   - O snapshot analisado não altera a limitação já registrada: a validação real com `npm install`, `npm test`, `npm run build`, `prisma generate/migrate` e execução do seed deve ser feita no ambiente local com PostgreSQL disponível.

### Próximo marco recomendado

Antes de iniciar um novo grande módulo de negócio, manter como gate técnico:

```text
FASE 1 + FASE 2/M1
        ↓
HARDENING / QA
        ↓
integração PostgreSQL
        ↓
testes cross-tenant
        ↓
testes de permissões nas Server Actions
        ↓
validação build / seed / migrations
        ↓
produção
```

A Fase 2 / Marco 1 pode ser considerada **implementada funcionalmente**, mas a condição de **“pronta para produção” permanece não comprovada** até a execução dos testes de integração e do hardening já apontados.

---

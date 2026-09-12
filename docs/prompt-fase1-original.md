# PROMPT PARA CLAUDE CODE — Innovation Workspace, Fase 1 (Fundação)

> Cole este prompt inteiro para o Claude Code no diretório onde você quer criar o projeto.

---

Você vai construir a **Fase 1 (Fundação)** de um produto SaaS B2B chamado **Innovation Workspace**. As fases seguintes (Inovação, Melhoria Contínua, Projetos, Business Case, IA, Escala) virão depois, em prompts separados — não implemente nada delas agora, mas **projete o schema e a arquitetura de forma que elas encaixem sem retrabalho** (ver seção "Extensibilidade" abaixo).

## 1. Objetivo desta fase

Entregar uma base multi-tenant funcional de gestão de trabalho: organizações, usuários, permissões, e a hierarquia Workspace → Space → Folder → List → Task → Subtask, com visualização em Kanban e Lista sobre os mesmos dados, comentários e anexos.

## 2. Stack obrigatória

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL
- Tailwind CSS + shadcn/ui
- NextAuth (Auth.js) para autenticação
- dnd-kit para drag & drop do Kanban
- Vitest ou Jest para testes

Não troque essa stack sem antes explicar o motivo e pedir confirmação.

## 3. Estrutura de pastas

```
/app
  /(auth)/login, /(auth)/signup
  /(dashboard)/[orgSlug]/workspace/[spaceId]/...
  /api
/lib
  /modules
    /workspace   (organization, workspace, space, folder, list, task)
    /auth
    /permissions
/prisma
  schema.prisma
  seed.ts
```
Cada módulo em `/lib/modules` expõe seus próprios *services* (funções puras de lógica de negócio) e *server actions* (camada que fala com a UI). **Nenhum código fora do módulo acessa o Prisma diretamente** para as entidades daquele módulo — isso é importante para permitir extrair serviços depois, se necessário.

## 4. Modelo de dados desta fase

Implemente estas entidades no `schema.prisma`, com `organizationId` obrigatório e indexado em toda entidade abaixo do nível Organization (isolamento multi-tenant):

```
Organization
  id, name, slug, createdAt

User
  id, email, name, passwordHash, createdAt

OrganizationMember   // join table User <-> Organization com papel
  id, organizationId, userId, role (Owner|Admin|Gestor|Lider|Membro|Convidado)

Workspace
  id, organizationId, name, createdAt

Space
  id, workspaceId, name, order

Folder
  id, spaceId, name, order

List
  id, folderId, name, order, viewConfig (Json)  // filtros/agrupamento/ordenação salvos

Task
  id, listId, organizationId, parentTaskId (nullable, self-relation p/ subtask)
  title, description, status, priority, assigneeId (nullable -> User)
  dueDate, startDate, order, createdAt, updatedAt

Comment
  id, organizationId, authorId
  commentableType, commentableId   // relação polimórfica
  body, createdAt

Attachment
  id, organizationId, uploadedById
  attachableType, attachableId     // relação polimórfica
  url, filename, mimeType, sizeBytes, createdAt
```

**Regras de modelagem que precisam ser respeitadas:**
- `Comment` e `Attachment` usam relação polimórfica (`*Type` + `*Id`) — não crie `TaskComment`, `ProjectComment` etc. separados. Isso é proposital: nas próximas fases, Idea, Project, BusinessCase e outras entidades também vão precisar de comentários/anexos, e devem reusar essas mesmas tabelas.
- Kanban e Lista **não duplicam dados**: ambos leem da mesma tabela `Task`; a diferença é puramente de renderização + `viewConfig` salvo na `List`.
- Toda query de leitura/escrita de dados abaixo de Organization deve filtrar por `organizationId` — trate isso como regra de segurança, não como detalhe de implementação. Adicione um teste automatizado que prove que um usuário da Org A nunca recebe dados da Org B.

## 5. Funcionalidades a implementar

1. **Autenticação**: signup (cria Organization + primeiro usuário como Owner) e login.
2. **Convite de membros**: Owner/Admin convida por e-mail, define papel (role).
3. **Permissões**: middleware/helper que verifica papel do usuário antes de ações sensíveis (criar/editar/excluir Workspace, Space, Folder, List, Task; mudar papel de outro membro). Defina claramente, em uma tabela ou objeto de configuração, o que cada papel pode fazer.
4. **Hierarquia de workspace**: CRUD completo de Workspace, Space, Folder, List, com drag & drop para reordenar (campo `order`).
5. **Tasks**: CRUD completo, com subtarefas (via `parentTaskId`), responsável, prioridade, datas, status.
6. **Kanban**: colunas configuráveis por status, drag & drop de cards entre colunas (dnd-kit), refletindo update do `status` da Task.
7. **Lista**: tabela com as mesmas tasks, com ordenação e filtros básicos (por responsável, status, prioridade).
8. **Comentários e anexos**: implementados de forma genérica (polimórfica) e usados em pelo menos Task nesta fase — a prova de que funcionam em outra entidade também virá nas próximas fases.

## 6. Extensibilidade (não implementar agora, só não travar o caminho)

- Deixe um lugar óbvio no schema para, no futuro, `Idea`, `Project` e `BusinessCase` também usarem `Comment`/`Attachment` sem migração estrutural.
- Não hardcode a lista de status/prioridade de Task em enum fixo do banco se puder ser um `String` validado na aplicação — nas próximas fases, workflows (pipeline de inovação) precisam de status configuráveis por organização.

## 7. Critérios de aceite (a fase só está pronta quando todos passarem)

- [ ] Duas organizações distintas não conseguem, por nenhum caminho da UI ou da API, ver ou modificar dados uma da outra (com teste automatizado cobrindo isso).
- [ ] Um usuário com papel "Membro" não consegue executar ações restritas a "Gestor" ou acima (com teste automatizado).
- [ ] Uma tarefa criada/editada na Lista aparece corretamente refletida no Kanban e vice-versa, sem duplicação de registro.
- [ ] Comentários e anexos funcionam via relação polimórfica em Task (arquitetura pronta para reuso em outras entidades).
- [ ] Interface responsiva para os fluxos de criação/edição de tarefa e comentário em mobile.
- [ ] Seed script que cria uma organização de exemplo com workspace, spaces, folders, lists e tasks de demonstração.

## 8. Forma de trabalhar

- Antes de gerar código, apresente o `schema.prisma` completo desta fase para eu revisar.
- Depois do schema aprovado, implemente por módulo, na ordem: auth/permissões → workspace/space/folder/list → task → kanban/lista → comentários/anexos.
- Ao final de cada módulo, rode os testes relevantes antes de seguir para o próximo.
- Não implemente nada das fases futuras (ideias, GUT, business case, IA etc.) — apenas garanta que o modelo de dados desta fase não impede que elas sejam adicionadas depois sem grande refatoração.

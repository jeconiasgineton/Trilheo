# Trilheo — Fase 2 / Marco 1 (Inovação)

Plataforma de gerenciamento de projetos e fluxos de trabalho com foco, nesta
entrega, no **módulo de Inovação**: pipelines configuráveis, boards de ideias
e Kanban de ideias por estágio (drag & drop).

Stack: **Next.js 14 (App Router) + Prisma + PostgreSQL + NextAuth + Tailwind +
shadcn/ui + Zod + dnd-kit**.

## Arquitetura

- **Multi-tenant**: toda entidade abaixo de `Organization` carrega
  `organizationId` obrigatório e indexado. Toda query do service filtra por
  `organizationId` vindo da **sessão** (nunca do client).
- **Defesa em profundidade**: Server Actions validam sessão → Zod → permissão
  (`requirePermission`) → service (filtra por org). Três camadas redundantes.
- **Permissões**: registro central em `lib/modules/permissions/actions.ts`
  (ação → papel mínimo). Hierarquia por rank: OWNER > ADMIN > GESTOR >
  LIDER > MEMBRO > CONVIDADO.
- **Extensibilidade**: `status`, `priority`, `stageType` e `source` são
  `String` no banco (não enum Prisma) — a organização pode customizar sem
  migrar enum. Validados na aplicação.
- **Polimorfismo**: `Comment` e `Attachment` usam tabela única polimórfica
  (`commentableType/Id`, `attachableType/Id`). Hoje aceitam "Task" e "Idea".

## Setup

```bash
cp .env.example .env          # ajuste DATABASE_URL, NEXTAUTH_SECRET
npm install
npx prisma migrate dev --name init   # (ou prisma db push)
npm run prisma:seed
npm run dev
```

Acesse http://localhost:3000 → /login.

### Usuários de demo (senha: `demo12345`)

| Email            | Papel |
|------------------|-------|
| owner@demo.com   | OWNER |
| lider@demo.com   | LIDER |
| membro@demo.com  | MEMBRO |

## Estrutura principal

```
app/
  (dashboard)/
    layout.tsx                         # header + nav + guarda de sessão
    [orgSlug]/
      innovation/
        page.tsx                       # lista de boards
        innovation-list-client.tsx
        pipelines/
          page.tsx                     # gerenciar pipelines e estágios
          pipelines-client.tsx
        [boardId]/
          page.tsx                     # board (Kanban)
          board-client.tsx
          idea-kanban.tsx              # Kanban dnd-kit (UI refinada)
          idea-dialog.tsx              # criar/editar ideia
      workspace/page.tsx              # placeholder (Fase 1 fora do escopo)
  login/
lib/
  db.ts                                # PrismaClient singleton
  utils.ts                             # cn (shadcn)
  modules/
    auth/index.ts                      # NextAuth (JWT + membership)
    permissions/
      roles.ts                         # Role, can, requirePermission
      actions.ts                       # ação → papel mínimo
    workspace/reorder.ts               # computeOrderUpdates (puro)
    comment/                           # serviço polimórfico de comentários
    attachment/                         # serviço polimórfico de anexos
    innovation/
      constants.ts                     # estágios/origens padrão + helpers
      schemas.ts                        # validação Zod
      service.ts                        # regras de negócio (org-scoped)
      actions.ts                        # Server Actions
      pipeline.test.ts                 # testes puros (vitest)
components/ui/                          # button, input, textarea, select, label
prisma/
  schema.prisma
  seed.ts
```

## Testes

```bash
npm test        # vitest (lógica pura do pipeline/slugify)
```

> Testes de integração do Prisma dependem de um Postgres ativo.

## Regras do Kanban de Inovação

- Criar/editar ideia: `idea:create`/`idea:update` (MEMBRO+).
- Mover entre estágios **não-finais**: `idea:move` (MEMBRO+).
- Entrar/sair de estágio **final** (Aprovada/Reprovada/Convertida): exige
  `idea:approve` (LIDER+). O service valida a regra e devolve erro se faltar
  aprovação.
- Excluir ideia: o autor exclui a própria; excluir de terceiro exige
  `idea:delete` (LIDER+).

# PROMPT PARA CLAUDE CODE — Continuação do Trilheo (Fase 1, Fundação)

> Cole este prompt inteiro no Claude Code, rodando **localmente, dentro da pasta `C:\Projetos\Trilheo`** (este projeto já existe e tem trabalho feito — não é um projeto novo).

---

## 0. Antes de tudo: leia o histórico

Este projeto já tem contexto acumulado de uma sessão anterior (em outra ferramenta, sem acesso à internet, por isso a implementação parou aqui e foi passada para você). Antes de escrever qualquer código:

1. Leia `CONTEXTO.MD` na raiz do projeto — tem o histórico completo, decisões já tomadas, status por fase e um changelog.
2. Leia `docs/prompt-fase1-original.md` — é o prompt original e completo da Fase 1, com todas as regras, critérios de aceite e a ordem de implementação definida pelo usuário. **Todas as regras desse documento continuam valendo integralmente.**
3. Leia `prisma/schema.prisma` — **já foi apresentado ao usuário e APROVADO por ele**. Não redesenhe nem reescreva do zero. Só altere algum ponto dele se for estritamente necessário para uma funcionalidade desta fase, e nesse caso explique o motivo e peça confirmação antes de rodar a migration (mesma regra do prompt original para trocar de stack).
4. **A partir de agora, você é responsável por manter `CONTEXTO.MD` atualizado.** Ao final de cada atualização importante (schema alterado, módulo concluído, decisão de arquitetura tomada, testes rodados), edite o arquivo: marque o item correspondente como feito na seção "Status por fase" e adicione uma linha nova em "Changelog" com a data e o que mudou. Isso é uma instrução permanente do usuário, não apenas desta sessão.

## 1. Onde a implementação parou

Já feito e aprovado (não refazer):
- `schema.prisma` completo (Organization, User, OrganizationMember, Workspace, Space, Folder, List, Task, Comment, Attachment) — ver decisões de modelagem em `CONTEXTO.MD`.
- Estrutura de pastas (`/app`, `/lib/modules/{auth,permissions,workspace}`, `/prisma`).
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env.example`, `.gitignore`, `README.md`.

Ainda não implementado (é o que falta na Fase 1, na ordem definida no prompt original):
1. **Módulo `permissions`** — matriz de papéis (Owner/Admin/Gestor/Lider/Membro/Convidado) x ações permitidas, com helper tipo `can(role, action)` / `requirePermission(...)`.
2. **Módulo `auth`** — NextAuth (Credentials + sessão JWT, sem tabelas de adapter — ver `CONTEXTO.MD`), signup (cria Organization + User Owner), login, convite de membro (ver decisão de simplificação do fluxo de convite em `CONTEXTO.MD` — sem serviço de e-mail configurado ainda).
3. **Telas de login/signup** (`app/(auth)/login`, `app/(auth)/signup`).
4. **Módulo `workspace`** — CRUD de Workspace/Space/Folder/List com reordenação (`order`).
5. **Módulo `task`** — CRUD, subtarefas, e as views Kanban (dnd-kit) e Lista sobre a mesma tabela `Task`.
6. **Comentários/anexos** — usando as tabelas polimórficas já no schema, aplicados em Task.
7. **Seed script** (`prisma/seed.ts`) — organização de exemplo com workspace, spaces, folders, lists e tasks.

## 2. Primeiros passos técnicos

```bash
cd C:\Projetos\Trilheo
npm install
npx prisma generate
```

Você vai precisar de um PostgreSQL rodando localmente (ou Docker) e preencher `.env` a partir do `.env.example` antes de `npx prisma migrate dev`.

## 3. Regras que continuam valendo (do prompt original — não são negociáveis sem pedir confirmação)

- Stack fixa: Next.js 14 (App Router) + TypeScript, Prisma + PostgreSQL, Tailwind + shadcn/ui, NextAuth, dnd-kit, Vitest.
- Nenhum código fora do módulo dono acessa o Prisma diretamente para as entidades daquele módulo.
- Toda entidade abaixo de `Organization` é filtrada por `organizationId` — trate como regra de segurança. Teste automatizado obrigatório provando que a Org A nunca vê/edita dados da Org B.
- Kanban e Lista leem a mesma tabela `Task`, nunca duplicam dados.
- **Ao final de cada módulo, rode os testes relevantes antes de seguir para o próximo** (agora você tem acesso à internet e a um terminal de verdade — pode e deve cumprir essa regra à risca, diferente da sessão anterior).
- Não implemente nada das fases futuras (Inovação, Melhoria Contínua, Business Case, IA, Escala) — só não impedir que encaixem depois.
- Critérios de aceite da Fase 1 estão em `docs/prompt-fase1-original.md`, seção 7 — a fase só está pronta quando todos passarem.

## 4. Nome do produto

O produto se chama **Trilheo** (domínio `trilheo.com`/`.com.br` e pré-busca INPI já verificados, sem conflito). "Innovation Workspace" foi só o codinome interno usado até a definição do nome — pode aparecer residualmente em algum lugar (ex.: texto de posicionamento), não precisa correr atrás disso agora, só usar "Trilheo" em qualquer branding novo que você escrever.

## 5. Ao terminar (ou ao atingir um marco importante)

Atualize `CONTEXTO.MD` (seção 0 acima) e resuma para o usuário, em português, o que foi feito, o que falta e se algum critério de aceite ainda não passa.

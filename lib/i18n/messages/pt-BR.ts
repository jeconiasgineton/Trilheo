/**
 * Mensagens em pt-BR — idioma padrão e original de todo o produto.
 * O formato (`Messages`) é definido em `./index.ts`; este arquivo só
 * precisa satisfazer esse formato.
 *
 * Cobre nesta rodada: navegação principal, autenticação (login/
 * signup) e o seletor de idioma. O restante do app (workspace, task,
 * inovação, ferramentas de melhoria, business case, copilot,
 * formulários) continua com texto fixo em português — ver
 * "Decisões técnicas — Fase 7 (i18n)" no CONTEXTO.MD para o porquê de
 * não ter sido traduzido nesta rodada e como estender esta base.
 */
import type { Messages } from "./index";

const messages: Messages = {
  nav: {
    workspace: "Workspace",
    innovation: "Inovação",
    forms: "Formulários",
    members: "Membros",
    signOut: "Sair",
  },
  locale: {
    label: "Idioma",
  },
  login: {
    title: "Entrar no Trilheo",
    subtitle: "Use sua conta da organização.",
    email: "Email",
    password: "Senha",
    submit: "Entrar",
    submitting: "Entrando...",
    invalidCredentials: "Email ou senha inválidos.",
    demoHint: "Demo: owner@demo.com / lider@demo.com / membro@demo.com — senha demo12345",
  },
  signup: {
    title: "Criar sua organização no Trilheo",
    subtitle: "Você será o Owner da nova organização.",
    organizationName: "Nome da organização",
    yourName: "Seu nome",
    email: "Email",
    password: "Senha",
    submit: "Criar organização",
    submitting: "Criando...",
    alreadyHaveAccount: "Já tem conta?",
    signIn: "Entrar",
  },
};

export default messages;

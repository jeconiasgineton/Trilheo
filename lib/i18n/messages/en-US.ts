import type { Messages } from "./index";

const messages: Messages = {
  nav: {
    workspace: "Workspace",
    innovation: "Innovation",
    forms: "Forms",
    members: "Members",
    signOut: "Sign out",
  },
  locale: {
    label: "Language",
  },
  login: {
    title: "Sign in to Trilheo",
    subtitle: "Use your organization account.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
    invalidCredentials: "Invalid email or password.",
    demoHint: "Demo: owner@demo.com / lider@demo.com / membro@demo.com — password demo12345",
  },
  signup: {
    title: "Create your organization on Trilheo",
    subtitle: "You will be the Owner of the new organization.",
    organizationName: "Organization name",
    yourName: "Your name",
    email: "Email",
    password: "Password",
    submit: "Create organization",
    submitting: "Creating...",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign in",
  },
};

export default messages;

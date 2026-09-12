import { describe, expect, it } from "vitest";
import { inviteEmailContent, inviteEmailSubject } from "./templates";

describe("inviteEmailSubject", () => {
  it("inclui o nome da organização", () => {
    expect(inviteEmailSubject("Acme")).toBe("Você foi convidado para Acme no Trilheo");
  });
});

describe("inviteEmailContent", () => {
  it("inclui email, senha e link de login no texto e no html", () => {
    const { html, text } = inviteEmailContent({
      organizationName: "Acme",
      recipientEmail: "novo@acme.com",
      temporaryPassword: "Abc12345",
      loginUrl: "https://trilheo.com/login",
    });
    expect(text).toContain("novo@acme.com");
    expect(text).toContain("Abc12345");
    expect(text).toContain("https://trilheo.com/login");
    expect(html).toContain("novo@acme.com");
    expect(html).toContain("Abc12345");
  });

  it("escapa HTML no nome da organização (única string não validada por Zod)", () => {
    const { html } = inviteEmailContent({
      organizationName: '<script>alert(1)</script>',
      recipientEmail: "a@b.com",
      temporaryPassword: "x",
      loginUrl: "https://trilheo.com/login",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

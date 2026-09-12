import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as forms from "@/lib/modules/forms/service";
import { FormError } from "@/lib/modules/forms/service";

/**
 * Fase 7 (coleta mobile) — integração real contra Postgres. Cobre o
 * ciclo completo de montar um formulário (campos ordenados, tipos
 * variados), coletar (validação de obrigatoriedade/tipo/opção),
 * desativar em vez de excluir quando já há coletas, e isolamento
 * cross-tenant.
 */
describe("Formulários e coleta mobile (Fase 7)", () => {
  let orgA: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let orgB: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  const suffix = Date.now();

  beforeAll(async () => {
    orgA = await createOrganizationWithOwner({
      organizationName: `Forms Test A ${suffix}`,
      name: "Owner A",
      email: `forms-a-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    orgB = await createOrganizationWithOwner({
      organizationName: `Forms Test B ${suffix}`,
      name: "Owner B",
      email: `forms-b-${suffix}@test.local`,
      password: "senhaSegura123",
    });
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: { in: [orgA.organization.id, orgB.organization.id] } } });
    await db.user.deleteMany({ where: { id: { in: [orgA.user.id, orgB.user.id] } } });
  });

  it("cria template, define campos ordenados e coleta uma submissão válida", async () => {
    const template = await forms.createTemplate(orgA.organization.id, orgA.user.id, {
      title: "Inspeção de segurança",
    });

    const withFields = await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [
        { type: "TEXT", label: "Responsável pela inspeção", required: true },
        { type: "SINGLE_CHOICE", label: "Turno", required: true, options: ["Manhã", "Tarde", "Noite"] },
        { type: "SIGNATURE", label: "Assinatura", required: true },
      ],
    });
    expect(withFields.fields.map((f) => f.label)).toEqual([
      "Responsável pela inspeção",
      "Turno",
      "Assinatura",
    ]);
    expect(withFields.fields.map((f) => f.order)).toEqual([0, 1, 2]);

    const [respField, turnoField, sigField] = withFields.fields;
    const submission = await forms.submitForm(orgA.organization.id, orgA.user.id, {
      templateId: template.id,
      answers: {
        [respField.id]: "Ana",
        [turnoField.id]: "Manhã",
        [sigField.id]: "data:image/png;base64,AAAA",
      },
    });
    expect(submission.id).toBeTruthy();
    expect((submission.answers as Record<string, unknown>)[respField.id]).toBe("Ana");
  });

  it("rejeita submissão sem campo obrigatório preenchido", async () => {
    const template = await forms.createTemplate(orgA.organization.id, orgA.user.id, { title: "Checklist X" });
    const withFields = await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [{ type: "TEXT", label: "Nome do site", required: true }],
    });
    await expect(
      forms.submitForm(orgA.organization.id, orgA.user.id, { templateId: template.id, answers: {} }),
    ).rejects.toThrow(FormError);
  });

  it("recusa nova coleta em formulário desativado", async () => {
    const template = await forms.createTemplate(orgA.organization.id, orgA.user.id, { title: "Antigo" });
    await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [{ type: "TEXT", label: "Campo", required: false }],
    });
    await forms.updateTemplate(orgA.organization.id, template.id, { id: template.id, isActive: false });
    await expect(
      forms.submitForm(orgA.organization.id, orgA.user.id, { templateId: template.id, answers: {} }),
    ).rejects.toThrow(FormError);
  });

  it("não exclui um template que já tem coletas — exige desativar em vez disso", async () => {
    const template = await forms.createTemplate(orgA.organization.id, orgA.user.id, { title: "Com coleta" });
    await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [{ type: "TEXT", label: "Campo", required: false }],
    });
    await forms.submitForm(orgA.organization.id, orgA.user.id, { templateId: template.id, answers: {} });

    await expect(forms.deleteTemplate(orgA.organization.id, template.id)).rejects.toThrow(FormError);
    expect(await db.formTemplate.findUnique({ where: { id: template.id } })).not.toBeNull();

    await forms.updateTemplate(orgA.organization.id, template.id, { id: template.id, isActive: false });
    const updated = await db.formTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(updated.isActive).toBe(false);
  });

  it("replaceFields atualiza campo existente no lugar (preserva id) e remove o que não veio na lista", async () => {
    const template = await forms.createTemplate(orgA.organization.id, orgA.user.id, { title: "Editável" });
    const v1 = await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [
        { type: "TEXT", label: "Campo 1", required: false },
        { type: "TEXT", label: "Campo 2", required: false },
      ],
    });
    const field1Id = v1.fields[0].id;

    const v2 = await forms.replaceFields(orgA.organization.id, {
      templateId: template.id,
      fields: [{ id: field1Id, type: "NUMBER", label: "Campo 1 renomeado", required: true }],
    });
    expect(v2.fields).toHaveLength(1);
    expect(v2.fields[0].id).toBe(field1Id);
    expect(v2.fields[0].label).toBe("Campo 1 renomeado");
    expect(v2.fields[0].type).toBe("NUMBER");
  });

  it("Org A não lê, edita nem coleta em formulário da Org B (isolamento cross-tenant)", async () => {
    const templateB = await forms.createTemplate(orgB.organization.id, orgB.user.id, { title: "Template B" });
    await forms.replaceFields(orgB.organization.id, {
      templateId: templateB.id,
      fields: [{ type: "TEXT", label: "Campo B", required: false }],
    });

    await expect(forms.getTemplateWithFields(orgA.organization.id, templateB.id)).rejects.toThrow(FormError);
    await expect(
      forms.updateTemplate(orgA.organization.id, templateB.id, { id: templateB.id, title: "hack" }),
    ).rejects.toThrow(FormError);
    await expect(
      forms.submitForm(orgA.organization.id, orgA.user.id, { templateId: templateB.id, answers: {} }),
    ).rejects.toThrow(FormError);
    await expect(
      forms.replaceFields(orgA.organization.id, { templateId: templateB.id, fields: [] }),
    ).rejects.toThrow(FormError);

    const listA = await forms.listTemplates(orgA.organization.id);
    expect(listA.map((t) => t.id)).not.toContain(templateB.id);
  });
});

import { describe, expect, it } from "vitest";
import { validateAnswers } from "./constants";

const fields = [
  { id: "f1", type: "TEXT", label: "Nome", required: true, options: null },
  { id: "f2", type: "NUMBER", label: "Idade", required: false, options: null },
  { id: "f3", type: "SINGLE_CHOICE", label: "Turno", required: false, options: ["Manhã", "Tarde"] },
  { id: "f4", type: "MULTI_CHOICE", label: "Equipamentos", required: false, options: ["EPI", "Capacete"] },
  { id: "f5", type: "YES_NO", label: "Aprovado?", required: false, options: null },
  { id: "f6", type: "SIGNATURE", label: "Assinatura", required: true, options: null },
];

describe("validateAnswers", () => {
  it("aceita um conjunto de respostas válido e completo", () => {
    const err = validateAnswers(fields, {
      f1: "João",
      f2: 30,
      f3: "Manhã",
      f4: ["EPI"],
      f5: true,
      f6: "data:image/png;base64,AAAA",
    });
    expect(err).toBeNull();
  });

  it("rejeita quando falta um campo obrigatório", () => {
    const err = validateAnswers(fields, { f6: "data:image/png;base64,AAAA" });
    expect(err).toMatch(/Nome/);
  });

  it("rejeita tipo errado em campo numérico", () => {
    const err = validateAnswers(fields, { f1: "João", f2: "trinta", f6: "data:image/png;base64,AAAA" });
    expect(err).toMatch(/Idade/);
  });

  it("rejeita opção fora da lista em SINGLE_CHOICE", () => {
    const err = validateAnswers(fields, { f1: "João", f3: "Noite", f6: "data:image/png;base64,AAAA" });
    expect(err).toMatch(/Turno/);
  });

  it("rejeita opção fora da lista em MULTI_CHOICE", () => {
    const err = validateAnswers(fields, { f1: "João", f4: ["Drone"], f6: "data:image/png;base64,AAAA" });
    expect(err).toMatch(/Equipamentos/);
  });

  it("rejeita assinatura que não é uma data URL", () => {
    const err = validateAnswers(fields, { f1: "João", f6: "não é imagem" });
    expect(err).toMatch(/Assinatura/);
  });

  it("campos opcionais vazios não geram erro", () => {
    const err = validateAnswers(fields, { f1: "João", f6: "data:image/png;base64,AAAA" });
    expect(err).toBeNull();
  });
});

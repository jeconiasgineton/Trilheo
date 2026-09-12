import { describe, expect, it } from "vitest";
import { translate } from "./translate";

describe("translate", () => {
  it("traduz uma chave existente em pt-BR", () => {
    expect(translate("pt-BR", "nav.workspace")).toBe("Workspace");
  });

  it("traduz a mesma chave em en-US", () => {
    expect(translate("en-US", "nav.innovation")).toBe("Innovation");
  });

  it("devolve a própria chave quando ela não existe em nenhum locale (nunca quebra a tela)", () => {
    // @ts-expect-error -- chave propositalmente ausente do dicionário para testar o fallback
    expect(translate("en-US", "nav.naoexiste")).toBe("nav.naoexiste");
  });
});

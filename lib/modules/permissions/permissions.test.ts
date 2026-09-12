import { describe, expect, it } from "vitest";
import {
  can,
  canChangeRole,
  PermissionError,
  requirePermission,
} from "./index";

describe("can", () => {
  it("CONVIDADO não pode criar task", () => {
    expect(can("CONVIDADO", "task:create")).toBe(false);
  });

  it("MEMBRO pode criar, editar e reordenar task", () => {
    expect(can("MEMBRO", "task:create")).toBe(true);
    expect(can("MEMBRO", "task:update")).toBe(true);
    expect(can("MEMBRO", "task:reorder")).toBe(true);
  });

  it("MEMBRO não pode excluir task nem atribuir responsável", () => {
    expect(can("MEMBRO", "task:delete")).toBe(false);
    expect(can("MEMBRO", "task:assign")).toBe(false);
  });

  it("LIDER pode excluir task e gerenciar folder/list", () => {
    expect(can("LIDER", "task:delete")).toBe(true);
    expect(can("LIDER", "folder:create")).toBe(true);
    expect(can("LIDER", "list:delete")).toBe(true);
  });

  it("LIDER não pode criar workspace nem space", () => {
    expect(can("LIDER", "workspace:create")).toBe(false);
    expect(can("LIDER", "space:create")).toBe(false);
  });

  it("GESTOR pode criar workspace e space, mas não excluir workspace", () => {
    expect(can("GESTOR", "workspace:create")).toBe(true);
    expect(can("GESTOR", "space:create")).toBe(true);
    expect(can("GESTOR", "workspace:delete")).toBe(false);
  });

  it("ADMIN pode excluir workspace e gerenciar membros", () => {
    expect(can("ADMIN", "workspace:delete")).toBe(true);
    expect(can("ADMIN", "member:invite")).toBe(true);
    expect(can("ADMIN", "member:remove")).toBe(true);
  });

  it("OWNER herda todas as permissões de ADMIN", () => {
    expect(can("OWNER", "workspace:delete")).toBe(true);
    expect(can("OWNER", "member:invite")).toBe(true);
    expect(can("OWNER", "task:create")).toBe(true);
  });

  it("só OWNER gerencia billing — nem ADMIN pode", () => {
    expect(can("ADMIN", "billing:manage")).toBe(false);
    expect(can("OWNER", "billing:manage")).toBe(true);
  });

  it("hierarquia é monotônica: se um papel pode, todo papel acima também pode", () => {
    const ordered = [
      "CONVIDADO",
      "MEMBRO",
      "LIDER",
      "GESTOR",
      "ADMIN",
      "OWNER",
    ] as const;
    for (const action of ["task:create", "workspace:delete"] as const) {
      let seenTrue = false;
      for (const role of ordered) {
        const allowed = can(role, action);
        if (allowed) seenTrue = true;
        // uma vez que um papel permite, todos os seguintes também devem permitir
        if (seenTrue) expect(allowed).toBe(true);
      }
    }
  });
});

describe("requirePermission", () => {
  it("lança PermissionError quando o papel não tem a permissão", () => {
    expect(() => requirePermission("MEMBRO", "workspace:delete")).toThrow(
      PermissionError,
    );
  });

  it("não lança quando o papel tem a permissão", () => {
    expect(() =>
      requirePermission("GESTOR", "workspace:create"),
    ).not.toThrow();
  });

  it("erro carrega role e action para log/debug", () => {
    try {
      requirePermission("MEMBRO", "workspace:delete");
      throw new Error("deveria ter lançado PermissionError");
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionError);
      const permErr = err as PermissionError;
      expect(permErr.role).toBe("MEMBRO");
      expect(permErr.action).toBe("workspace:delete");
    }
  });
});

describe("canChangeRole", () => {
  it("ADMIN não pode alterar o papel de um OWNER", () => {
    expect(canChangeRole("ADMIN", "OWNER", "MEMBRO")).toBe(false);
  });

  it("ADMIN não pode promover alguém para ADMIN (papel igual ao seu)", () => {
    expect(canChangeRole("ADMIN", "MEMBRO", "ADMIN")).toBe(false);
  });

  it("ADMIN não pode promover alguém para OWNER", () => {
    expect(canChangeRole("ADMIN", "MEMBRO", "OWNER")).toBe(false);
  });

  it("ADMIN pode promover MEMBRO para GESTOR", () => {
    expect(canChangeRole("ADMIN", "MEMBRO", "GESTOR")).toBe(true);
  });

  it("OWNER pode alterar qualquer papel, inclusive de outro OWNER", () => {
    expect(canChangeRole("OWNER", "OWNER", "ADMIN")).toBe(true);
    expect(canChangeRole("OWNER", "MEMBRO", "ADMIN")).toBe(true);
  });

  it("MEMBRO não pode alterar papel de ninguém (falta member:changeRole)", () => {
    expect(canChangeRole("MEMBRO", "MEMBRO", "LIDER")).toBe(false);
  });
});

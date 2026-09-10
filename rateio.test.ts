import { describe, it, expect } from "vitest";
import type { Associacao } from "./rateio";
import { MUDAS_POR_BANDEJA, RateioError, ratearMudas } from "./rateio";

function assoc(over: Partial<Associacao> & { nome: string }): Associacao {
  return {
    cnpj: over.cnpj ?? `00.000.000/0001-${over.nome.length.toString().padStart(2, "0")}`,
    municipio: "Porto Velho",
    familias: 10,
    cotaMaxima: 1_000_000,
    situacao: "regular",
    ...over,
  };
}

function pega(resultado: { distribuicoes: { nome: string }[] }, nome: string) {
  const d = resultado.distribuicoes.find((x) => x.nome === nome);
  if (!d) throw new Error(`distribuição não encontrada: ${nome}`);
  return d as { nome: string; bandejas: number; mudas: number; motivoExclusao?: string };
}

describe("setup", () => {
  it("exporta a constante de bandeja", () => {
    expect(MUDAS_POR_BANDEJA).toBe(50);
  });

  it("RateioError é um Error com nome próprio", () => {
    const erro = new RateioError("teste");
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toBeInstanceOf(RateioError);
    expect(erro.name).toBe("RateioError");
  });
});

describe("R1 — elegibilidade", () => {
  it("exclui situação não regular e reporta o motivo", () => {
    for (const situacao of ["suspensa", "irregular"] as const) {
      const r = ratearMudas(5000, [assoc({ nome: "A", situacao })]);
      const a = pega(r, "A");
      expect(a.bandejas).toBe(0);
      expect(a.mudas).toBe(0);
      expect(a.motivoExclusao).toContain(situacao);
    }
  });

  it("exclui associação sem famílias", () => {
    const r = ratearMudas(5000, [assoc({ nome: "A", familias: 0 })]);
    expect(pega(r, "A").motivoExclusao).toContain("família");
  });

  it("acumula motivos quando há mais de um impedimento", () => {
    const r = ratearMudas(5000, [
      assoc({ nome: "A", familias: 0, situacao: "irregular" }),
    ]);
    const motivo = pega(r, "A").motivoExclusao ?? "";
    expect(motivo).toContain("irregular");
    expect(motivo).toContain("família");
  });

  it("nenhuma elegível: tudo zerado e sobra igual ao total", () => {
    const r = ratearMudas(18000, [
      assoc({ nome: "A", situacao: "suspensa" }),
      assoc({ nome: "B", familias: 0 }),
    ]);
    expect(r.totalDistribuido).toBe(0);
    expect(r.sobraNaoDistribuida).toBe(18000);
    expect(r.distribuicoes).toHaveLength(2);
  });

  it("lista vazia é entrada válida degenerada", () => {
    const r = ratearMudas(18000, []);
    expect(r.distribuicoes).toEqual([]);
    expect(r.sobraNaoDistribuida).toBe(18000);
  });
});

describe("pureza", () => {
  it("não altera o array recebido", () => {
    const entrada = [assoc({ nome: "A" }), assoc({ nome: "B", familias: 3 })];
    const copia = structuredClone(entrada);
    ratearMudas(18000, entrada);
    expect(entrada).toEqual(copia);
  });

  it("é determinística", () => {
    const entrada = [assoc({ nome: "A" }), assoc({ nome: "B", familias: 3 })];
    expect(ratearMudas(18000, entrada)).toEqual(ratearMudas(18000, entrada));
  });
});

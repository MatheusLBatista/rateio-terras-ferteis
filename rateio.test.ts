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

describe("R4 — maiores restos", () => {
  it("exemplo 2 do enunciado (sem saturação)", () => {
    const r = ratearMudas(5180, [
      assoc({ nome: "Alto Alegre", familias: 10, cotaMaxima: 100_000 }),
      assoc({ nome: "Água Boa", familias: 10, cotaMaxima: 100_000 }),
      assoc({ nome: "Boa Esperança", familias: 5, cotaMaxima: 3_000 }),
    ]);

    expect(pega(r, "Água Boa").bandejas).toBe(41);
    expect(pega(r, "Alto Alegre").bandejas).toBe(41);
    expect(pega(r, "Boa Esperança").bandejas).toBe(21);
    expect(pega(r, "Boa Esperança").mudas).toBe(1050);

    expect(r.totalDistribuido).toBe(5150);
    expect(r.sobraNaoDistribuida).toBe(30); // R2: as 30 mudas fora da bandeja
  });

  it("divisão exata não gera sobra de bandeja", () => {
    const r = ratearMudas(5000, [
      assoc({ nome: "A", familias: 1 }),
      assoc({ nome: "B", familias: 1 }),
    ]);
    expect(pega(r, "A").bandejas).toBe(50);
    expect(pega(r, "B").bandejas).toBe(50);
    expect(r.sobraNaoDistribuida).toBe(0);
  });

  it("total menor que uma bandeja vai inteiro para a sobra", () => {
    const r = ratearMudas(49, [assoc({ nome: "A" })]);
    expect(pega(r, "A").bandejas).toBe(0);
    expect(r.totalDistribuido).toBe(0);
    expect(r.sobraNaoDistribuida).toBe(49);
  });

  it("totalMudas zero é válido", () => {
    const r = ratearMudas(0, [assoc({ nome: "A" })]);
    expect(r.totalDistribuido).toBe(0);
    expect(r.sobraNaoDistribuida).toBe(0);
  });

  it("R8 — a invariante se mantém", () => {
    const casos: Array<[number, Associacao[]]> = [
      [18000, [assoc({ nome: "A", familias: 120 }), assoc({ nome: "B", familias: 7 })]],
      [5180, [assoc({ nome: "A", familias: 10 }), assoc({ nome: "B", familias: 5 })]],
      [7, [assoc({ nome: "A" })]],
      [123456, [assoc({ nome: "A", familias: 3 }), assoc({ nome: "B", familias: 11 }), assoc({ nome: "C", familias: 29 })]],
    ];
    for (const [total, lista] of casos) {
      const r = ratearMudas(total, lista);
      expect(r.totalDistribuido + r.sobraNaoDistribuida).toBe(total);
      expect(r.sobraNaoDistribuida).toBeGreaterThanOrEqual(0);
    }
  });
});

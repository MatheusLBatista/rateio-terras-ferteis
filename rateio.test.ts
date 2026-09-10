import { describe, it, expect } from "vitest";
import type { Associacao } from "./rateio";
import { MUDAS_POR_BANDEJA, RateioError, ratearMudas } from "./rateio";

// Sequencial, e não derivado do nome: dois nomes de mesmo comprimento gerariam
// o mesmo CNPJ, o que agora é entrada inválida (CNPJ duplicado).
let sequencialCnpj = 0;

function assoc(over: Partial<Associacao> & { nome: string }): Associacao {
  sequencialCnpj += 1;
  return {
    cnpj: over.cnpj ?? `00.000.000/0001-${sequencialCnpj.toString().padStart(2, "0")}`,
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

describe("R3/R5 — cota máxima e redistribuição do excedente", () => {
  it("exemplo 1 do enunciado (saturação em cascata)", () => {
    const r = ratearMudas(18000, [
      assoc({ nome: "ASPRORIO", familias: 120, cotaMaxima: 4_000 }),
      assoc({ nome: "APROPERO", familias: 80, cotaMaxima: 18_000 }),
      assoc({ nome: "ARUVE", familias: 80, cotaMaxima: 18_000 }),
      assoc({ nome: "Água Boa", familias: 45, cotaMaxima: 2_000 }),
      assoc({ nome: "ACRUB", familias: 35, cotaMaxima: 18_000, situacao: "suspensa" }),
      assoc({ nome: "Alto Alegre", familias: 0, cotaMaxima: 5_000 }),
    ]);

    expect(pega(r, "APROPERO").bandejas).toBe(120);
    expect(pega(r, "APROPERO").mudas).toBe(6000);
    expect(pega(r, "ARUVE").bandejas).toBe(120);
    expect(pega(r, "ASPRORIO").bandejas).toBe(80);
    expect(pega(r, "Água Boa").bandejas).toBe(40);
    expect(pega(r, "ACRUB").bandejas).toBe(0);
    expect(pega(r, "Alto Alegre").bandejas).toBe(0);

    expect(r.totalDistribuido).toBe(18000);
    expect(r.sobraNaoDistribuida).toBe(0);
  });

  it("nenhuma associação ultrapassa a própria cota", () => {
    const r = ratearMudas(18000, [
      assoc({ nome: "A", familias: 100, cotaMaxima: 1_000 }),
      assoc({ nome: "B", familias: 50, cotaMaxima: 500 }),
      assoc({ nome: "C", familias: 10, cotaMaxima: 100_000 }),
    ]);
    expect(pega(r, "A").mudas).toBeLessThanOrEqual(1_000);
    expect(pega(r, "B").mudas).toBeLessThanOrEqual(500);
  });

  it("todas saturadas: o que sobra do lote vira sobraNaoDistribuida", () => {
    const r = ratearMudas(5000, [
      assoc({ nome: "A", familias: 10, cotaMaxima: 50 }),
      assoc({ nome: "B", familias: 10, cotaMaxima: 50 }),
    ]);
    expect(pega(r, "A").bandejas).toBe(1);
    expect(pega(r, "B").bandejas).toBe(1);
    expect(r.totalDistribuido).toBe(100);
    expect(r.sobraNaoDistribuida).toBe(4900);
  });

  it("cota menor que uma bandeja satura em zero", () => {
    const r = ratearMudas(5000, [assoc({ nome: "A", cotaMaxima: 49 })]);
    expect(pega(r, "A").bandejas).toBe(0);
    expect(r.totalDistribuido).toBe(0);
    expect(r.sobraNaoDistribuida).toBe(5000);
  });

  it("saturação em cascata: liberar excedente satura quem estava dentro da cota", () => {
    const r = ratearMudas(10000, [
      assoc({ nome: "A", familias: 100, cotaMaxima: 1_000 }),
      assoc({ nome: "B", familias: 60, cotaMaxima: 3_500 }),
      assoc({ nome: "C", familias: 40, cotaMaxima: 500_000 }),
    ]);
    expect(pega(r, "A").bandejas).toBe(20);
    expect(pega(r, "B").bandejas).toBe(70);
    expect(pega(r, "C").bandejas).toBe(110);
    expect(r.totalDistribuido).toBe(10000);
    expect(r.sobraNaoDistribuida).toBe(0);
  });
});

describe("R7 — ordenação da saída", () => {
  it("exemplo 1: ordena por mudas decrescente e joga as excluídas para o fim", () => {
    const r = ratearMudas(18000, [
      assoc({ nome: "ASPRORIO", familias: 120, cotaMaxima: 4_000 }),
      assoc({ nome: "APROPERO", familias: 80, cotaMaxima: 18_000 }),
      assoc({ nome: "ARUVE", familias: 80, cotaMaxima: 18_000 }),
      assoc({ nome: "Água Boa", familias: 45, cotaMaxima: 2_000 }),
      assoc({ nome: "ACRUB", familias: 35, cotaMaxima: 18_000, situacao: "suspensa" }),
      assoc({ nome: "Alto Alegre", familias: 0, cotaMaxima: 5_000 }),
    ]);

    expect(r.distribuicoes.map((d) => d.nome)).toEqual([
      "APROPERO",    
      "ARUVE",       
      "ASPRORIO",    
      "Água Boa",    
      "ACRUB",       
      "Alto Alegre", 
    ]);
  });

  it("exemplo 2: desempate alfabético respeita a colação do pt-BR", () => {
    const r = ratearMudas(5180, [
      assoc({ nome: "Alto Alegre", familias: 10, cotaMaxima: 100_000 }),
      assoc({ nome: "Água Boa", familias: 10, cotaMaxima: 100_000 }),
      assoc({ nome: "Boa Esperança", familias: 5, cotaMaxima: 3_000 }),
    ]);

    expect(r.distribuicoes.map((d) => d.nome)).toEqual([
      "Água Boa",
      "Alto Alegre",
      "Boa Esperança",
    ]);
  });

  it("a ordem da saída não depende da ordem da entrada", () => {
    const entrada = [
      assoc({ nome: "C", familias: 5 }),
      assoc({ nome: "A", familias: 30 }),
      assoc({ nome: "B", familias: 15 }),
    ];
    const direta = ratearMudas(10000, entrada);
    const invertida = ratearMudas(10000, [...entrada].reverse());

    expect(direta.distribuicoes).toEqual(invertida.distribuicoes);
    expect(direta.distribuicoes.map((d) => d.nome)).toEqual(["A", "B", "C"]);
  });

  it("todas as associações recebidas aparecem na saída", () => {
    const entrada = [
      assoc({ nome: "A" }),
      assoc({ nome: "B", situacao: "irregular" }),
      assoc({ nome: "C", familias: 0 }),
    ];
    const r = ratearMudas(5000, entrada);
    expect(r.distribuicoes).toHaveLength(entrada.length);
  });
});

describe("§6 — entradas inválidas", () => {
  const invalidas: Array<[string, () => unknown]> = [
    ["totalMudas negativo", () => ratearMudas(-1, [])],
    ["totalMudas NaN", () => ratearMudas(Number.NaN, [])],
    ["totalMudas fracionário", () => ratearMudas(10.5, [])],
    ["familias negativa", () => ratearMudas(5000, [assoc({ nome: "A", familias: -1 })])],
    ["cotaMaxima negativa", () => ratearMudas(5000, [assoc({ nome: "A", cotaMaxima: -1 })])],
    [
      "CNPJ duplicado",
      () =>
        ratearMudas(5000, [
          assoc({ nome: "A", cnpj: "11.111.111/0001-11" }),
          assoc({ nome: "B", cnpj: "11.111.111/0001-11" }),
        ]),
    ],
  ];

  for (const [descricao, executar] of invalidas) {
    it(`lança RateioError: ${descricao}`, () => {
      expect(executar).toThrow(RateioError);
    });
  }

  it("a mensagem diz qual é o problema", () => {
    expect(() => ratearMudas(5000, [assoc({ nome: "A", familias: -3 })])).toThrow(
      /familias/i
    );
  });
});

describe("§6 — degeneradas porém válidas não são erro", () => {
  const validas: Array<[string, () => unknown]> = [
    ["lista vazia", () => ratearMudas(18000, [])],
    ["totalMudas zero", () => ratearMudas(0, [assoc({ nome: "A" })])],
    ["familias zero", () => ratearMudas(5000, [assoc({ nome: "A", familias: 0 })])],
    ["cotaMaxima zero", () => ratearMudas(5000, [assoc({ nome: "A", cotaMaxima: 0 })])],
  ];

  for (const [descricao, executar] of validas) {
    it(`não lança: ${descricao}`, () => {
      expect(executar).not.toThrow();
    });
  }
});

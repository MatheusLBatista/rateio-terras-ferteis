import { describe, it, expect } from "vitest";
import { CODIGO_DESAFIO, MUDAS_POR_BANDEJA, RateioError, ratearMudas } from "./rateio";

describe("setup", () => {
  it("exporta o código do desafio", () => {
    expect(CODIGO_DESAFIO).toMatch(/^TF-2026-/);
  });

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

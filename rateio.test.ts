import { describe, it, expect } from "vitest";
import { CODIGO_DESAFIO } from "./rateio";

describe("setup", () => {
  it("exporta o código do desafio", () => {
    expect(CODIGO_DESAFIO).toMatch(/^TF-2026-/);
  });
});

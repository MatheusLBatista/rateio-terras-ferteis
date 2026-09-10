export const MUDAS_POR_BANDEJA = 50;

export type SituacaoCadastral = "regular" | "suspensa" | "irregular";

export interface Associacao {
  cnpj: string;
  nome: string;
  municipio: string;
  familias: number;
  cotaMaxima: number;
  situacao: SituacaoCadastral;
}

export interface Distribuicao {
  cnpj: string;
  nome: string;
  bandejas: number;
  mudas: number;
  motivoExclusao?: string;
}

export interface ResultadoRateio {
  distribuicoes: Distribuicao[];
  totalDistribuido: number;
  sobraNaoDistribuida: number;
}

export class RateioError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RateioError";
    Object.setPrototypeOf(this, RateioError.prototype);
  }
}

export function motivoExclusao(associacao: Associacao): string | undefined {
  if (associacao.situacao != "regular" && associacao.familias <= 0) {
    return `Situação cadastral ${associacao.situacao} e nenhuma família cadastrada.`;
  }

  if (associacao.situacao != "regular") {
    return `Situação cadastral ${associacao.situacao}`;
  }

  if (associacao.familias <= 0) {
    return `Nenhuma família cadastrada.`;
  }

  return undefined;
}

interface Linha {
  associacao: Associacao;
  motivoExclusao?: string;
  cotaBandejas: number;
  bandejas: number;
  saturada: boolean;
}

export function ratearMudas(
  totalMudas: number,
  associacoes: Associacao[]
): ResultadoRateio {
  const loteBandejas = Math.floor(totalMudas / MUDAS_POR_BANDEJA);

  const linhas: Linha[] = associacoes.map((associacao) => ({
    associacao,
    motivoExclusao: motivoExclusao(associacao),
    cotaBandejas: Math.floor(associacao.cotaMaxima / MUDAS_POR_BANDEJA),
    bandejas: 0,
    saturada: false,
  }));

  const elegiveis = linhas.filter((linha) => linha.motivoExclusao === undefined);

  distribuirPorMaioresRestos(loteBandejas, elegiveis);

  const distribuicoes = linhas.map(criarDistribuicao);
  const totalDistribuido = distribuicoes.reduce((soma, d) => soma + d.mudas, 0);

  return {
    distribuicoes,
    totalDistribuido,
    sobraNaoDistribuida: totalMudas - totalDistribuido,
  };
}

function criarDistribuicao(linha: Linha): Distribuicao {
  const { cnpj, nome } = linha.associacao;

  if (linha.motivoExclusao !== undefined) {
    return { cnpj, nome, bandejas: 0, mudas: 0, motivoExclusao: linha.motivoExclusao };
  }

  return {
    cnpj,
    nome,
    bandejas: linha.bandejas,
    mudas: linha.bandejas * MUDAS_POR_BANDEJA,
  };
}

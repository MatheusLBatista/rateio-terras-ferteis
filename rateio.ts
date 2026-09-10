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

function validarEntrada(totalMudas: number, associacoes: Associacao[]): void {
  if (!Number.isInteger(totalMudas) || totalMudas < 0) {
    throw new RateioError(
      `totalMudas deve ser um inteiro não negativo; recebido: ${totalMudas}.`
    );
  }

  const cnpjsVistos = new Set<string>();

  for (const { cnpj, nome, familias, cotaMaxima } of associacoes) {
    if (!Number.isInteger(familias) || familias < 0) {
      throw new RateioError(
        `${nome}: familias deve ser um inteiro não negativo; recebido: ${familias}.`
      );
    }
    if (!Number.isInteger(cotaMaxima) || cotaMaxima < 0) {
      throw new RateioError(
        `${nome}: cotaMaxima deve ser um inteiro não negativo; recebida: ${cotaMaxima}.`
      );
    }
    if (cnpjsVistos.has(cnpj)) {
      throw new RateioError(`CNPJ duplicado: ${cnpj}. O rateio ficaria ambíguo.`);
    }
    cnpjsVistos.add(cnpj);
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
  validarEntrada(totalMudas, associacoes);

  const loteBandejas = Math.floor(totalMudas / MUDAS_POR_BANDEJA);

  const linhas: Linha[] = associacoes.map((associacao) => ({
    associacao,
    motivoExclusao: motivoExclusao(associacao),
    cotaBandejas: Math.floor(associacao.cotaMaxima / MUDAS_POR_BANDEJA),
    bandejas: 0,
    saturada: false,
  }));

  const elegiveis = linhas.filter((linha) => linha.motivoExclusao === undefined);

  ratearRespeitandoCotas(loteBandejas, elegiveis);

  const distribuicoes = linhas.map(criarDistribuicao).sort(compararSaida);
  const totalDistribuido = distribuicoes.reduce((soma, d) => soma + d.mudas, 0);

  return {
    distribuicoes,
    totalDistribuido,
    sobraNaoDistribuida: totalMudas - totalDistribuido,
  };
}

function compararSaida(a: Distribuicao, b: Distribuicao): number {
  return b.mudas - a.mudas || a.nome.localeCompare(b.nome, "pt-BR");
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

function ratearRespeitandoCotas(loteBandejas: number, elegiveis: Linha[]): void {
  let bandejasDisponiveis = loteBandejas;
  
  for (let rodada = 0; rodada <= elegiveis.length; rodada++) {
    const naoSaturadas = elegiveis.filter((linha) => !linha.saturada);
    if (naoSaturadas.length === 0) return;

    distribuirPorMaioresRestos(bandejasDisponiveis, naoSaturadas);

    const estouraram = naoSaturadas.filter((l) => l.bandejas > l.cotaBandejas);
    if (estouraram.length === 0) return;

    for (const linha of estouraram) {
      linha.bandejas = linha.cotaBandejas;
      linha.saturada = true;
      bandejasDisponiveis -= linha.cotaBandejas;
    }
  }
}

function distribuirPorMaioresRestos(lote: number, ativos: Linha[]): void {
  const somaFamilias = ativos.reduce((s, p) => s + p.associacao.familias, 0);
  if (ativos.length === 0 || somaFamilias <= 0) return;

  let alocadas = 0;
  
  const comResto = ativos.map((participante) => {
    const numerador = lote * participante.associacao.familias;
    const inteiro = Math.floor(numerador / somaFamilias);
    participante.bandejas = inteiro;
    alocadas += inteiro;
    return { participante, resto: numerador % somaFamilias };
  });

  comResto.sort((a, b) => b.resto - a.resto);

  const restantes = lote - alocadas;
  for (let i = 0; i < restantes && i < comResto.length; i++) {
    comResto[i]!.participante.bandejas += 1;
  }
}





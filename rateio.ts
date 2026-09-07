//TODO: adjust this variable
export const CODIGO_DESAFIO = "TF-2026-____";

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

export function ratearMudas(
  totalMudas: number,
  associacoes: Associacao[]
): ResultadoRateio {
  throw new Error("não implementado");
}
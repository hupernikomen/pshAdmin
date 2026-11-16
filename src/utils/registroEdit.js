import { PLAN_CONFIG } from "../constants/appConfig";

// Utiliza o valor centralizado de PLAN_CONFIG (ou fallback de 24h caso não esteja definido)
const getLimiteMs = () => PLAN_CONFIG?.TEMPO_EDICAO_RG || (24 * 60 * 60 * 1000);

export function podeEditarRegistro(item) {
  const criado = item?.createdAt || item?.reg;
  if (!criado) return false;
  return Date.now() - Number(criado) <= getLimiteMs();
}

export function tempoRestanteEdicao(item) {
  const criado = item?.createdAt || item?.reg;
  if (!criado) return 0;
  return Math.max(0, Number(criado) + getLimiteMs() - Date.now());
}

export const LIMITE = getLimiteMs();
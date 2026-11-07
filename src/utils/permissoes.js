// src/utils/permissoes.js
import { PLAN_CONFIG } from "../constants/appConfig";

/**
 * Retorna os limites aplicáveis com base no status de assinatura da igreja.
 * @param {Object} igrejaAtiva - Objeto com os dados da igreja (contendo statusAssinatura ou isPremium)
 */
export function obterLimitesApp(igrejaAtiva) {
  const isPremium =
    igrejaAtiva?.isPremium || igrejaAtiva?.statusAssinatura === "active";

  return isPremium ? PLAN_CONFIG.PREMIUM_LIMITES : PLAN_CONFIG.FREE_LIMITES;
}
// src/utils/assinatura.js
import { PLAN_CONFIG } from "../constants/appConfig";

export function calcularDataExpiracao(tipoPlano) {
  const agora = new Date();
  if (tipoPlano === "ANUAL") {
    agora.setDate(agora.getDate() + 365);
  } else {
    agora.setDate(agora.getDate() + 30);
  }
  return agora.getTime();
}

export function verificarStatusAssinatura(igrejaAtiva) {
  const status = PLAN_CONFIG.verificarStatus(igrejaAtiva);
  
  return {
    isPremium: status.isPremium,
    isTrial: status.tipo === "TRIAL",
    tempoRestanteTexto: status.textoStatus,
  };
}
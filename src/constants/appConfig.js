// constants/appConfig.js

export const PLAN_CONFIG = {
  PRECO_MES: 3.90,
  PRECO_ANUAL: 36.90,
  DIAS_TRIAL_GRATUITO: 15,

  FREE_LIMITES: {
    LIMITE_HISTORICO: 10,
    PERMITE_CAIXINHAS: true,
    MAX_USUARIOS: 1,
    PERMITE_GERAR_RELATORIO: false,
  },

  PREMIUM_LIMITES: {
    LIMITE_HISTORICO: Infinity,
    PERMITE_CAIXINHAS: true,
    MAX_USUARIOS: 5,
    PERMITE_GERAR_RELATORIO: true,
  },

  PREMIUM_LOCK: {
    icon: "diamond-outline",
    size: 14,
    colorDark: "#FFB74D",
    colorLight: "#EF6C00",
  },

  /**
   * 🧠 REGRA CENTRALIZADA DE ASSINATURA
   * Trata as 4 situações solicitadas:
   * 1. Vitalício: isPremium true, dataExpiracaoPremium null/0
   * 2. Pago / Trial Ativo: isPremium true, dataExpiracaoPremium > agora
   * 3. Expirado: dataExpiracaoPremium < agora (bloqueia independente da flag)
   */
  verificarStatus(igreja) {
    const dataExpiracao = igreja?.dataExpiracaoPremium ? Number(igreja.dataExpiracaoPremium) : 0;
    const agora = Date.now();
    const isFlagTrue = !!igreja?.isPremium;

    // Caso Vitalício
    const ehVitalicio = isFlagTrue && !dataExpiracao;

    // Caso Válido no Futuro (Pago ou Trial)
    const ehValidoNoFuturo = isFlagTrue && dataExpiracao > agora;

    // Caso Expirado (se a data passou)
    const estaExpirado = dataExpiracao > 0 && dataExpiracao <= agora;

    if (estaExpirado || (!ehVitalicio && !ehValidoNoFuturo)) {
      return {
        isPremium: false,
        tipo: "EXPIRADO",
        textoStatus: "Seu período de teste ou assinatura expirou.",
      };
    }

    if (ehVitalicio) {
      return {
        isPremium: true,
        tipo: "VITALICIO",
        textoStatus: "Plano Premium Ativo (Acesso Vitalício)",
      };
    }

    // Se chegou aqui, é um plano com data futura (Pago ou Trial)
    const diferencaMs = dataExpiracao - agora;
    const diasRestantes = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24));
    
    // Identifica se é Trial recente ou Plano Pago com base no tempo criado ou faixa de dias
    const createdAt = igreja?.createdAt ? Number(igreja.createdAt) : agora;
    const idadeIgrejaDias = (agora - createdAt) / (1000 * 60 * 60 * 24);
    const ehTrial = idadeIgrejaDias <= PLAN_CONFIG.DIAS_TRIAL_GRATUITO + 1 && diasRestantes <= PLAN_CONFIG.DIAS_TRIAL_GRATUITO;

    return {
      isPremium: true,
      tipo: ehTrial ? "TRIAL" : "PAGO",
      diasRestantes,
      textoStatus: ehTrial 
        ? `Período de Teste Gratuito · Restam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}.`
        : `Plano Premium Ativo · Restam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}.`,
    };
  }
};
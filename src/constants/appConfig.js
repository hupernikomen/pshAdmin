// constants/appConfig.js

export const PLAN_CONFIG = {
  // Configurações financeiras dos planos
  PRECO_MES: 3.90,
  PRECO_ANUAL: 34.90,

  // Regras da versão Gratuita (Free)
  FREE_LIMITES: {
    LIMITE_HISTORICO: 10,
    PERMITE_CAIXINHAS: false,
    MAX_USUARIOS: 1, // Apenas o admin principal
    PERMITE_GERAR_RELATORIO: false, // Exemplo: se quiser bloquear o relatório no grátis
  },

  // Regras da versão Premium (Tudo liberado)
  PREMIUM_LIMITES: {
    LIMITE_HISTORICO: Infinity,
    PERMITE_CAIXINHAS: true,
    MAX_USUARIOS: Infinity,
    PERMITE_GERAR_RELATORIO: true,
  },


  // Configuração centralizada para o visual dos recursos Premium bloqueados
  PREMIUM_LOCK: {
    // Opções recomendadas do Ionicons:
    // "sparkles" ( ✨ Brilhos / Exclusivo )
    // "star" ( ⭐ Estrela )
    // "diamond-outline" ( 💎 Diamante )
    // "flash" ( ⚡ Acelerado / Potente )
    // "shield-checkmark" ( 🛡️ Protegido / Seguro )
    icon: "diamond-outline", // Ex: "star", "shield-checkmark", "lock-closed", "sparkles"
    size: 14,
    colorDark: "#FFB74D",  // Amarelo/Laranja no tema escuro
    colorLight: "#EF6C00", // Laranja vibrante no tema claro
  },
};
// src/constants/notificacoesConfig.js
export const NOTIFICACOES_CONFIG = {
  LEMBRETE_CULTO: {
    idUnico: 'lembrete-culto-semanal',
    titulo: 'Lembrete',
    corpo: 'Não se esqueça de atualizar os lançamentos e o caixa da igreja.',
    diaSemana: 5, // 1 = Segunda-feira
    hora: 15,
    minuto: 24,
    repetirSemanalmente: true,
  },
  AVISO_VENCIMENTO_PLANO: {
    idUnico: 'aviso-vencimento-plano',
    titulo: 'Seu plano está vencendo',
    corpo: 'Seu acesso Premium vence em breve. Renove agora para não perder os recursos exclusivos.',
    repetirSemanalmente: false,
  },
};
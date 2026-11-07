// src/utils/assinatura.js

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
  const dataExpiracao = igrejaAtiva?.dataExpiracaoPremium ? Number(igrejaAtiva.dataExpiracaoPremium) : 0;
  const agora = Date.now();

  const isPremium = igrejaAtiva?.isPremium || (dataExpiracao > agora);

  if (!isPremium) {
    return {
      isPremium: false,
      tempoRestanteTexto: "Você está usando o plano gratuito com recursos limitados.",
    };
  }

  if (!dataExpiracao) {
    return {
      isPremium: true,
      tempoRestanteTexto: "Plano Premium Ativo (Acesso Ilimitado)",
    };
  }

  const diferencaMs = dataExpiracao - agora;
  const diasRestantes = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24));

  let tempoTexto = "";
  if (diasRestantes > 30) {
    const meses = Math.floor(diasRestantes / 30);
    tempoTexto = `Plano Premium Ativo · Restam aprox. ${meses} ${meses === 1 ? 'mês' : 'meses'}.`;
  } else if (diasRestantes > 0) {
    tempoTexto = `Plano Premium Ativo · Restam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}.`;
  } else {
    tempoTexto = `Sua assinatura expira hoje.`;
  }

  return {
    isPremium: true,
    tempoRestanteTexto: tempoTexto,
  };
}
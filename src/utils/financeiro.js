/** Helpers de caixa — regra única para Home, A receber, A pagar, Relatório e Context */

export function arred(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export function fimDoDiaTs(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

export function dataDoItem(item) {
  return Number(item?.data || item?.createdAt || item?.reg || 0) || 0;
}

/** Alias usado em partes antigas do código */
export function dataDoMovimento(item) {
  return dataDoItem(item);
}

/**
 * A receber: sempre o que ainda falta (total − recebido).
 * Saldo inicial nunca entra.
 * Usado na Home (posição de hoje, sem filtro de mês).
 */
export function valorAReceberItem(item) {
  if (item?.tipoMovimento !== "entrada") return 0;
  if (item?.tipo === "Saldo inicial") return 0;

  // Garante que só considera se a data do item for estritamente futura (maior que o fim de hoje)
  const limiteHoje = fimDoDiaTs();
  const ts = dataDoItem(item);
  if (!ts || ts <= limiteHoje) return 0;

  const total = Number(item.valorTotal) || 0;
  const recebido = Number(item.valorRecebidoTotal) || 0;
  const falta = Math.max(0, arred(total - recebido));
  return falta > 0 ? falta : 0;
}

/**
 * A pagar: parcelas abertas (ou sem status) OU documento não quitado com falta.
 * Usado na Home (posição de hoje, sem filtro de mês).
 */
export function valorAPagarItem(item) {
  if (item?.tipoMovimento !== "saida") return 0;
  if (item?.status === "quitada") return 0;

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  if (parcelas.length > 0) {
    return arred(
      parcelas.reduce((acc, p) => {
        if (p.status === "aberta" || !p.status) {
          return acc + (Number(p.valor) || 0);
        }
        return acc;
      }, 0)
    );
  }

  const total = Number(item.valorTotal) || 0;
  const pago = Number(item.valorPagoTotal) || 0;
  const falta = arred(total - pago);
  return falta > 0 ? falta : 0;
}

/**
 * A receber do relatório: só o que já era devido até o fim do período.
 * Lançamento com data depois desse fim não entra em mês anterior.
 */
export function valorAReceberAte(item, fimTs) {
  if (item?.tipoMovimento !== "entrada") return 0;
  if (item?.tipo === "Saldo inicial") return 0;
  if (item?.status === "quitada") return 0;

  const ts = dataDoItem(item);
  if (!ts || ts > fimTs) return 0;

  return valorAReceberItem(item);
}

/**
 * A pagar do relatório: parcela aberta só entra se o vencimento
 * for até o fim do período. Parcela de novembro não altera setembro.
 */
export function valorAPagarAte(item, fimTs) {
  if (item?.tipoMovimento !== "saida") return 0;

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  if (parcelas.length > 0) {
    return arred(
      parcelas.reduce((acc, p) => {
        const aberta = p.status === "aberta" || !p.status;
        if (!aberta) return acc;
        const ts = Number(p.vencimento || p.data || 0) || 0;
        if (!ts || ts > fimTs) return acc;
        return acc + (Number(p.valor) || 0);
      }, 0)
    );
  }

  if (item?.status === "quitada") return 0;
  const ts = dataDoItem(item);
  if (!ts || ts > fimTs) return 0;

  const total = Number(item.valorTotal) || 0;
  const pago = Number(item.valorPagoTotal) || 0;
  const falta = arred(total - pago);
  return falta > 0 ? falta : 0;
}

export function isEntradaFutura(item, limiteHoje = fimDoDiaTs()) {
  const ts = dataDoItem(item);
  return !!ts && ts > limiteHoje;
}

/** Timestamp estável do dia (meio-dia local) para gravação de pagamento/recebimento */
export function tsDoDia(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x.getTime();
}

/** Entradas realizadas até limiteTs — pela data de cada recebimento */
export function valorRealizadoEntradaAte(item, limiteTs) {
  const recebidos = Array.isArray(item.valoresRecebidos)
    ? item.valoresRecebidos
    : [];

  if (recebidos.length > 0) {
    return recebidos.reduce((acc, r) => {
      const ts = Number(r.data || 0);
      if (ts && ts <= limiteTs) return acc + (Number(r.valor) || 0);
      return acc;
    }, 0);
  }

  const ts = dataDoItem(item);
  if (ts && ts <= limiteTs) return Number(item.valorRecebidoTotal) || 0;
  return 0;
}

/** Saídas realizadas até limiteTs — pela data de cada pagamento */
export function valorRealizadoSaidaAte(item, limiteTs) {
  const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];

  if (pagos.length > 0) {
    return pagos.reduce((acc, p) => {
      const ts = Number(p.data || 0);
      if (ts && ts <= limiteTs) return acc + (Number(p.valor) || 0);
      return acc;
    }, 0);
  }

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  const pagas = parcelas.filter(
    (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
  );

  if (pagas.length > 0) {
    return pagas.reduce((acc, p) => {
      const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
      if (ts && ts <= limiteTs) return acc + (Number(p.valor) || 0);
      return acc;
    }, 0);
  }

  const ts = dataDoItem(item);
  if (ts && ts <= limiteTs) return Number(item.valorPagoTotal) || 0;
  return 0;
}

/** Saldo realizado (caixa): só baixas com data ≤ fim de hoje */
export function calcularSaldoRealizado(lista) {
  const limite = fimDoDiaTs();
  let total = 0;

  (lista || []).forEach((item) => {
    if (item.tipoMovimento === "entrada") {
      total += valorRealizadoEntradaAte(item, limite);
    } else if (item.tipoMovimento === "saida") {
      total -= valorRealizadoSaidaAte(item, limite);
    }
  });

  return arred(total);
}

/** Totais de pendências de hoje (Home). Não usar no relatório por mês. */
export function totaisPendentes(lista) {
  let aReceber = 0;
  let aPagar = 0;

  (lista || []).forEach((item) => {
    aReceber += valorAReceberItem(item);
    aPagar += valorAPagarItem(item);
  });

  return {
    totalAReceber: arred(aReceber),
    totalAPagar: arred(aPagar),
  };
}
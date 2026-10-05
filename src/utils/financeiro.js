/** Helpers de caixa — regra única para Home, A receber, A pagar e Relatório */

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

/**
 * A receber: sempre o que ainda falta (total − recebido).
 * Não soma “recebido + falta” em data futura (evita valor inflado).
 * Saldo inicial nunca entra.
 */
export function valorAReceberItem(item) {
  if (item?.tipoMovimento !== "entrada") return 0;
  if (item?.tipo === "Saldo inicial") return 0;

  const total = Number(item.valorTotal) || 0;
  const recebido = Number(item.valorRecebidoTotal) || 0;
  const falta = Math.max(0, arred(total - recebido));
  return falta > 0 ? falta : 0;
}

/**
 * A pagar: parcelas abertas (ou sem status) OU documento não quitado com falta.
 * Mesma regra em Home, APagar e Relatório.
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
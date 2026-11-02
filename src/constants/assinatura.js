/** Ajuste livremente estes valores */
export const DIAS_GRATIS_PDF = 90;
export const PRECO_ANUAL_PDF = 24.9;
export const MESES_CONTRATO_PDF = 12;
export const MOEDA_PDF = "BRL";

export const TEXTO_PRECO_PDF = `R$ ${PRECO_ANUAL_PDF
  .toFixed(2)
  .replace(".", ",")}/ano`;

/** Pagamento manual (Pix) — preencha com seus dados */
export const PIX_CHAVE = "hupcontato@gmail.com"; // ← sua chave
export const PIX_TITULAR = "WILSON RAMOS ALVES DOS SANTOS";
export const PIX_CIDADE = "Teresina"; // opcional, só texto
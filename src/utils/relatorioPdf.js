import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";

const C = {
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.55, 0.58, 0.62),
  line: rgb(0.9, 0.91, 0.92),
  card: rgb(0.96, 0.965, 0.97),
  greenDark: rgb(0.22, 0.48, 0.28),
  red: rgb(0.78, 0.18, 0.18),
};

function safe(t) {
  return String(t ?? "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...");
}

function isDizimo(item) {
  const t = String(item.tipo || "").toLowerCase();
  return t.includes("dizimo") || t.includes("dízimo");
}

function isOferta(item) {
  const t = String(item.tipo || "").toLowerCase();
  return t.includes("oferta");
}

function valorEntrada(item) {
  return Number(item.valorRecebidoTotal) || 0;
}

function valorSaida(item) {
  return Number(item.valorPagoTotal) || 0;
}

function labelMovimento(item) {
  if (isDizimo(item)) return "Dízimo ***";
  if (isOferta(item)) return "Oferta ***";
  const desc = String(item.descricao || "").trim();
  if (desc) return desc;
  return String(item.tipo || "Movimento");
}

function valorMovimento(item) {
  if (item.tipoMovimento === "entrada") return valorEntrada(item);
  if (item.tipoMovimento === "saida") return valorSaida(item);
  return 0;
}

function money(fmt, v) {
  return `R$ ${fmt.format(Number(v) || 0)}`;
}

function resumoDizimos(historicoPeriodo) {
  let total = 0;
  let qtd = 0;
  (historicoPeriodo || []).forEach((item) => {
    if (item.tipoMovimento !== "entrada") return;
    if (!isDizimo(item)) return;
    total += valorEntrada(item);
    qtd += 1;
  });
  return { total, qtd };
}

export async function exportarRelatorioPDF({
  nomeIgreja,
  labelPeriodo,
  resumo,
  projecao,
  historicoPeriodo,
  formatoMoeda,
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const gapCol = 28;
  const colRightW = 165;
  const colLeftW = pageWidth - margin * 2 - gapCol - colRightW;
  const xLeft = margin;
  const xRight = margin + colLeftW + gapCol;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yLeft = pageHeight - margin;
  let yRight = pageHeight - margin;

  const pagesRef = () => pdfDoc.getPages();

  const drawVLine = (p) => {
    p.drawLine({
      start: { x: xRight - gapCol / 2, y: margin + 20 },
      end: { x: xRight - gapCol / 2, y: pageHeight - margin },
      thickness: 0.5,
      color: C.line,
    });
  };

  drawVLine(page);

  const novaPagina = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    yLeft = pageHeight - margin;
    yRight = pageHeight - margin;
    drawVLine(page);
  };

  const ensureLeft = (h) => {
    if (yLeft - h < margin + 28) novaPagina();
  };

  const sectionLeft = (titulo) => {
    ensureLeft(40);
    yLeft -= 14;

    page.drawText(safe(titulo), {
      x: xLeft,
      y: yLeft,
      size: 10,
      font: fontBold,
      color: C.ink,
    });
    yLeft -= 8;

    page.drawLine({
      start: { x: xLeft, y: yLeft },
      end: { x: xLeft + colLeftW, y: yLeft },
      thickness: 0.5,
      color: C.line,
    });
    yLeft -= 14;
  };

  /** Nota orientativa (como a da coluna ao lado) */
  const notaOrientativa = (linhas) => {
    const list = (Array.isArray(linhas) ? linhas : [linhas]).filter(Boolean);
    const lineH = 11;
    const pad = 8;
    const boxH = pad * 2 + list.length * lineH;

    ensureLeft(boxH + 8);
    yLeft -= 4;

    page.drawRectangle({
      x: xLeft,
      y: yLeft - boxH,
      width: colLeftW,
      height: boxH,
      color: C.card,
    });

    list.forEach((txt, i) => {
      page.drawText(safe(txt), {
        x: xLeft + pad,
        y: yLeft - pad - 7 - i * lineH,
        size: 7.5,
        font,
        color: C.muted,
        maxWidth: colLeftW - pad * 2,
      });
    });

    yLeft -= boxH + 10;
  };

  const drawCard = (x, top, w, h, label, valueText, valueColor) => {
    page.drawRectangle({
      x,
      y: top - h,
      width: w,
      height: h,
      color: C.card,
    });
    page.drawText(safe(label), {
      x: x + 8,
      y: top - 12,
      size: 7,
      font,
      color: C.muted,
    });
    page.drawText(safe(valueText), {
      x: x + 8,
      y: top - 28,
      size: 10,
      font: fontBold,
      color: valueColor || C.ink,
      maxWidth: w - 14,
    });
  };

  const listaTipo = (titulo, entries, cor) => {
    sectionLeft(titulo);
    if (!entries.length) {
      ensureLeft(14);
      page.drawText(safe("Sem dados."), {
        x: xLeft,
        y: yLeft,
        size: 8,
        font,
        color: C.muted,
      });
      yLeft -= 16;
      return;
    }
    entries.forEach(([tipo, total]) => {
      ensureLeft(15);
      page.drawText(safe(String(tipo)), {
        x: xLeft,
        y: yLeft,
        size: 8,
        font,
        color: C.ink,
        maxWidth: colLeftW - 72,
      });
      const val = money(formatoMoeda, total);
      const vw = fontBold.widthOfTextAtSize(val, 8);
      page.drawText(val, {
        x: xLeft + colLeftW - vw,
        y: yLeft,
        size: 8,
        font: fontBold,
        color: cor,
      });
      yLeft -= 14;
    });
    yLeft -= 8;
  };

  // ——— CABEÇALHO ———
  page.drawText(safe(nomeIgreja || "Tesouraria"), {
    x: xLeft,
    y: yLeft,
    size: 14,
    font: fontBold,
    color: C.ink,
    maxWidth: colLeftW,
  });
  yLeft -= 16;
  page.drawText(safe(labelPeriodo || ""), {
    x: xLeft,
    y: yLeft,
    size: 9,
    font,
    color: C.muted,
    maxWidth: colLeftW,
  });
  yLeft -= 12;

  // ——— RESULTADO DO PERÍODO (sem nota) ———
  sectionLeft("Resultado do período");
  {
    const gap = 8;
    const cardH = 44;
    const cardW = (colLeftW - gap) / 2;
    ensureLeft(cardH * 2 + gap + 12);

    const itens = [
      ["Saldo anterior", money(formatoMoeda, resumo.saldoAnterior || 0), C.ink],
      ["Saldo atual", money(formatoMoeda, resumo.saldoAtual || 0), C.ink],
      ["Receitas", money(formatoMoeda, resumo.entradas), C.greenDark],
      ["Despesas", money(formatoMoeda, resumo.saidas), C.red],
    ];
    itens.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = xLeft + col * (cardW + gap);
      const top = yLeft - row * (cardH + gap);
      drawCard(x, top, cardW, cardH, k[0], k[1], k[2]);
    });
    yLeft -= cardH * 2 + gap + 10;
  }

  // ——— PROJEÇÃO ———
  sectionLeft("Projeção");
  {
    const gap = 8;
    const cardH = 44;
    const cardW = (colLeftW - gap * 2) / 3;
    ensureLeft(cardH + 12);

    const itens = [
      ["A receber", money(formatoMoeda, projecao.aReceber), C.greenDark],
      ["A pagar", money(formatoMoeda, projecao.aPagar), C.red],
      ["Saldo projetado", money(formatoMoeda, projecao.saldoProjetado), C.ink],
    ];
    itens.forEach((k, i) => {
      const x = xLeft + i * (cardW + gap);
      drawCard(x, yLeft, cardW, cardH, k[0], k[1], k[2]);
    });
    yLeft -= cardH + 10;
  }
  notaOrientativa([
    "Projeção indica o que a igreja teria em caixa após quitar todas as dívidas futuras.",
  ]);
  


    // ——— DÍZIMOS E OFERTAS ———
  const diz = resumoDizimos(historicoPeriodo);

  let totalOfertas = 0;
  let qtdOfertas = 0;
  (historicoPeriodo || []).forEach((item) => {
    if (item.tipoMovimento !== "entrada") return;
    if (!isOferta(item)) return;
    totalOfertas += valorEntrada(item);
    qtdOfertas += 1;
  });

  const totalDizimos =
    resumo.dizimos != null ? Number(resumo.dizimos) || 0 : diz.total;
  const receitasPeriodo = Number(resumo.entradas) || 0;

  const pctDizimos =
    receitasPeriodo > 0 ? (totalDizimos / receitasPeriodo) * 100 : 0;
  const pctOfertas =
    receitasPeriodo > 0 ? (totalOfertas / receitasPeriodo) * 100 : 0;

  const fmtPct = (v) =>
    `${v.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;

  sectionLeft("Dízimos e ofertas");
  {
    const gap = 8;
    const cardH = 44;
    const cardW = (colLeftW - gap) / 2;
    ensureLeft(cardH * 2 + gap + 12);

    // linha 1 — dízimos
    drawCard(
      xLeft,
      yLeft,
      cardW,
      cardH,
      "Dízimos (% receitas)",
      fmtPct(pctDizimos),
      C.greenDark
    );
    drawCard(
      xLeft + cardW + gap,
      yLeft,
      cardW,
      cardH,
      "Qtd. de dizimistas",
      String(diz.qtd),
      C.ink
    );

    // linha 2 — ofertas
    const top2 = yLeft - cardH - gap;
    drawCard(
      xLeft,
      top2,
      cardW,
      cardH,
      "Ofertas (% receitas)",
      fmtPct(pctOfertas),
      C.greenDark
    );
    drawCard(
      xLeft + cardW + gap,
      top2,
      cardW,
      cardH,
      "Qtd. de ofertas",
      String(qtdOfertas),
      C.ink
    );

    yLeft -= cardH * 2 + gap + 10;
  }
  notaOrientativa([
    "Percentuais em relação ao total de receitas do período",
  ]);

  // ——— POR TIPO ———
  listaTipo(
    "Receitas por tipo",
    Object.entries(resumo.porTipoEntrada || {}).sort((a, b) => b[1] - a[1]),
    C.greenDark
  );
  listaTipo(
    "Despesas por tipo",
    Object.entries(resumo.porTipoSaida || {}).sort((a, b) => b[1] - a[1]),
    C.red
  );
  notaOrientativa([
    "O detalhamento de cada lançamento (valores e descrições) está na coluna ao lado.",
    "Dízimos e ofertas aparecem de forma protegida (***).",
  ]);

  // ——— COLUNA DIREITA ———
  const drawRightHeader = () => {
    yRight -= 2;
    page.drawText(safe("Movimentações"), {
      x: xRight,
      y: yRight,
      size: 10,
      font: fontBold,
      color: C.ink,
    });
    yRight -= 8;
    page.drawLine({
      start: { x: xRight, y: yRight },
      end: { x: xRight + colRightW, y: yRight },
      thickness: 0.5,
      color: C.line,
    });
    yRight -= 16;
  };

  page = pagesRef()[0];
  yRight = pageHeight - margin;
  drawRightHeader();

  const hist = historicoPeriodo || [];
  if (!hist.length) {
    page.drawText(safe("Nenhum lançamento."), {
      x: xRight,
      y: yRight,
      size: 8,
      font,
      color: C.muted,
    });
  } else {
    for (let i = 0; i < hist.length; i++) {
      const item = hist[i];
      const lab = labelMovimento(item);
      const valor = valorMovimento(item);
      const isEnt = item.tipoMovimento === "entrada";
      const valorTxt = `${isEnt ? "+" : "-"} ${money(formatoMoeda, valor)}`;
      const corVal = isEnt ? C.greenDark : C.red;

      if (yRight - 16 < margin + 22) {
        const all = pagesRef();
        const idx = all.indexOf(page);
        if (idx >= 0 && idx < all.length - 1) {
          page = all[idx + 1];
        } else {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          drawVLine(page);
        }
        yRight = pageHeight - margin;
        drawRightHeader();
      }

      let nome = safe(lab);
      if (nome.length > 20) nome = nome.slice(0, 19) + ".";

      page.drawText(nome, {
        x: xRight,
        y: yRight,
        size: 8,
        font,
        color: C.ink,
        maxWidth: colRightW - 56,
      });

      const vw = fontBold.widthOfTextAtSize(valorTxt, 8);
      page.drawText(valorTxt, {
        x: xRight + colRightW - vw,
        y: yRight,
        size: 8,
        font: fontBold,
        color: corVal,
      });

      yRight -= 14;
    }
  }

  // ——— RODAPÉ ———
  const all = pagesRef();
  all.forEach((p, idx) => {
    p.drawText(
      safe(
        `Gerado em ${new Date().toLocaleDateString(
          "pt-BR"
        )} ${new Date().toLocaleTimeString("pt-BR")}  ·  ${
          resumo.quantidade || 0
        } reg.  ·  ${idx + 1}/${all.length}`
      ),
      {
        x: margin,
        y: 14,
        size: 7,
        font,
        color: C.muted,
      }
    );
  });

  const base64 = await pdfDoc.saveAsBase64();
  if (!base64) throw new Error("Falha ao gerar o conteúdo do PDF.");

  const fileName = `relatorio_${Date.now()}.pdf`;
  const cachePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
  await RNFS.writeFile(cachePath, base64, "base64");
  const fileUrl = cachePath.startsWith("file://")
    ? cachePath
    : `file://${cachePath}`;

  try {
    await Share.open({
      title: "Relatório Financeiro",
      url: fileUrl,
      type: "application/pdf",
      showAppsToView: true,
      failOnCancel: false,
    });
  } catch {
    await RNFS.copyFile(cachePath, `${RNFS.DownloadDirectoryPath}/${fileName}`);
  }

  return fileName;
}
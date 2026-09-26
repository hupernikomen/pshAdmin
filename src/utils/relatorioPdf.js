import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";

const C = {
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.55, 0.58, 0.62),
  line: rgb(0.9, 0.91, 0.92),
  card: rgb(0.96, 0.96, 0.97),
  green: rgb(0.18, 0.42, 0.31),
  red: rgb(0.61, 0.13, 0.15),
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

function valorEntrada(item) {
  return Number(item.valorRecebidoTotal) || 0;
}

function valorSaida(item) {
  return Number(item.valorPagoTotal) || 0;
}

function labelMovimento(item) {
  if (isDizimo(item)) return "Diz. ***";
  const desc = String(item.descricao || "").trim();
  if (desc) return desc;
  return String(item.tipo || "Movimento");
}

function valorMovimento(item) {
  if (item.tipoMovimento === "entrada") return valorEntrada(item);
  if (item.tipoMovimento === "saida") return valorSaida(item);
  return 0;
}

function desenharLinhaChart(page, font, opts) {
  const {
    x,
    y,
    width,
    height,
    series,
    labels,
    colors,
    lineColor = C.line,
    mutedColor = C.muted,
  } = opts;

  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baseY = y - height + padB;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: lineColor,
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  page.drawLine({
    start: { x: x + padL, y: baseY },
    end: { x: x + width - padR, y: baseY },
    thickness: 0.5,
    color: lineColor,
  });

  const allVals = series.flatMap((s) => s.values);
  const maxV = Math.max(...allVals, 1);
  const n = Math.max(labels.length, 1);
  // 1 ponto no início; vários distribuídos da esquerda para a direita
  const stepX = n <= 1 ? 0 : plotW / (n - 1);

  const pointsFor = (values) =>
    values.map((v, i) => ({
      px: x + padL + i * stepX,
      py: baseY + (Number(v) / maxV) * plotH,
    }));

  series.forEach((s, si) => {
    const pts = pointsFor(s.values);
    const col = colors[si] || C.ink;
    for (let i = 0; i < pts.length - 1; i++) {
      page.drawLine({
        start: { x: pts[i].px, y: pts[i].py },
        end: { x: pts[i + 1].px, y: pts[i + 1].py },
        thickness: 1.5,
        color: col,
      });
    }
    pts.forEach((p) => {
      page.drawCircle({ x: p.px, y: p.py, size: 2.2, color: col });
    });
  });

  const stepLabel = labels.length > 8 ? 2 : 1;
  labels.forEach((lab, i) => {
    if (i % stepLabel !== 0 && i !== labels.length - 1) return;
    const px = x + padL + i * stepX;
    page.drawText(String(lab), {
      x: px - 6,
      y: y - height + 4,
      size: 7,
      font,
      color: mutedColor,
    });
  });
}

/** Barras verticais alinhadas à esquerda, valor no topo */
function desenharBarrasChart(page, font, fontBold, opts) {
  const {
    x,
    y,
    width,
    height,
    values,
    labels,
    barColor = C.green,
    lineColor = C.line,
    mutedColor = C.muted,
    formatoMoeda,
  } = opts;

  const padL = 10;
  const padR = 10;
  const padT = 22;
  const padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baseY = y - height + padB;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: lineColor,
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  page.drawLine({
    start: { x: x + padL, y: baseY },
    end: { x: x + width - padR, y: baseY },
    thickness: 0.5,
    color: lineColor,
  });

  const n = Math.max(values.length, 1);
  const maxV = Math.max(...values.map(Number), 1);
  const gap = 4;
  const barW = Math.min(22, Math.max(8, (plotW - gap * (n - 1)) / n));
  // sempre do início (esquerda)
  const startX = x + padL;

  values.forEach((v, i) => {
    const val = Number(v) || 0;
    const h = Math.max(val > 0 ? 3 : 0, (val / maxV) * plotH);
    const bx = startX + i * (barW + gap);
    const by = baseY;

    if (h > 0) {
      page.drawRectangle({
        x: bx,
        y: by,
        width: barW,
        height: h,
        color: barColor,
      });
    }

    const txt =
      val > 0
        ? val >= 1000
          ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`
          : formatoMoeda
            ? formatoMoeda.format(val)
            : String(val)
        : "—";
    const tw = fontBold.widthOfTextAtSize(txt, 6.5);
    page.drawText(txt, {
      x: bx + barW / 2 - tw / 2,
      y: by + h + 3,
      size: 6.5,
      font: fontBold,
      color: C.ink,
    });

    const lab = String(labels[i] || "");
    const lw = font.widthOfTextAtSize(lab, 7);
    page.drawText(lab, {
      x: bx + barW / 2 - lw / 2,
      y: y - height + 4,
      size: 7,
      font,
      color: mutedColor,
    });
  });
}

/**
 * Gera e compartilha o PDF do relatório.
 */
export async function exportarRelatorioPDF({
  nomeIgreja,
  labelPeriodo,
  labelJanelaGrafico,
  resumo,
  projecao,
  seriesGraficos,
  historicoPeriodo,
  formatoMoeda,
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 28;
  const gapCol = 12;
  const colRightW = 168;
  const colLeftW = pageWidth - margin * 2 - gapCol - colRightW;
  const xLeft = margin;
  const xRight = margin + colLeftW + gapCol;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yLeft = pageHeight - margin;
  let yRight = pageHeight - margin;

  const pagesRef = () => pdfDoc.getPages();

  const drawVLine = (p) => {
    p.drawLine({
      start: { x: xRight - gapCol / 2, y: margin },
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
    if (yLeft - h < margin + 20) novaPagina();
  };

  const lineLeft = (yy) => {
    page.drawLine({
      start: { x: xLeft, y: yy },
      end: { x: xLeft + colLeftW, y: yy },
      thickness: 0.5,
      color: C.line,
    });
  };

  page.drawText(safe(nomeIgreja || "Tesouraria"), {
    x: xLeft,
    y: yLeft,
    size: 13,
    font: fontBold,
    color: C.ink,
    maxWidth: colLeftW,
  });
  yLeft -= 14;
  page.drawText(safe("RELATÓRIO FINANCEIRO"), {
    x: xLeft,
    y: yLeft,
    size: 8,
    font,
    color: C.muted,
  });
  yLeft -= 12;
  page.drawText(safe(labelPeriodo), {
    x: xLeft,
    y: yLeft,
    size: 9,
    font: fontBold,
    color: C.ink,
    maxWidth: colLeftW,
  });
  yLeft -= 8;
  lineLeft(yLeft);
  yLeft -= 14;

  const textoExec = safe(
    `Período: ${labelPeriodo}. Receitas R$ ${formatoMoeda.format(
      resumo.entradas
    )}, despesas R$ ${formatoMoeda.format(
      resumo.saidas
    )}, saldo do período R$ ${formatoMoeda.format(resumo.saldo)}. ` +
      `Saldo atual R$ ${formatoMoeda.format(
        projecao.saldoAtual
      )}. A receber R$ ${formatoMoeda.format(
        projecao.aReceber
      )}, a pagar R$ ${formatoMoeda.format(
        projecao.aPagar
      )}. Projetado R$ ${formatoMoeda.format(projecao.saldoProjetado)}.`
  );

  let resto = textoExec;
  const maxChars = 58;
  while (resto.length > 0) {
    ensureLeft(12);
    let chunk = resto.slice(0, maxChars);
    if (resto.length > maxChars) {
      const sp = chunk.lastIndexOf(" ");
      if (sp > 28) chunk = chunk.slice(0, sp);
    }
    page.drawText(chunk, {
      x: xLeft,
      y: yLeft,
      size: 8,
      font,
      color: C.ink,
      maxWidth: colLeftW,
    });
    yLeft -= 11;
    resto = resto.slice(chunk.length).trim();
  }
  yLeft -= 12;

  const cardW = (colLeftW - 6) / 2;
  const cardH = 36;
  ensureLeft(cardH * 2 + 20);

  const kpis = [
    { label: "RECEITAS", value: resumo.entradas, color: C.green },
    { label: "DESPESAS", value: resumo.saidas, color: C.red },
    { label: "RESULTADO", value: resumo.saldo, color: C.ink },
    { label: "DÍZIMOS", value: resumo.dizimos, color: C.green },
  ];
  kpis.forEach((k, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = xLeft + col * (cardW + 6);
    const yy = yLeft - row * (cardH + 6);
    page.drawRectangle({
      x,
      y: yy - cardH,
      width: cardW,
      height: cardH,
      color: C.card,
      borderColor: C.line,
      borderWidth: 0.5,
    });
    page.drawText(safe(k.label), {
      x: x + 6,
      y: yy - 12,
      size: 6,
      font,
      color: C.muted,
    });
    page.drawText(safe(`R$ ${formatoMoeda.format(k.value)}`), {
      x: x + 6,
      y: yy - 26,
      size: 8,
      font: fontBold,
      color: k.color,
      maxWidth: cardW - 10,
    });
  });
  yLeft -= cardH * 2 + 18;

  ensureLeft(cardH + 20);
  page.drawText(safe("Posição e projeção"), {
    x: xLeft,
    y: yLeft,
    size: 9,
    font: fontBold,
    color: C.ink,
  });
  yLeft -= 12;
  const proj = [
    { label: "ATUAL", value: projecao.saldoAtual, color: C.ink },
    { label: "A RECEBER", value: projecao.aReceber, color: C.green },
    { label: "A PAGAR", value: projecao.aPagar, color: C.red },
    { label: "PROJETADO", value: projecao.saldoProjetado, color: C.ink },
  ];
  const pW = (colLeftW - 9) / 4;
  proj.forEach((k, i) => {
    const x = xLeft + i * (pW + 3);
    page.drawRectangle({
      x,
      y: yLeft - cardH,
      width: pW,
      height: cardH,
      color: C.card,
      borderColor: C.line,
      borderWidth: 0.5,
    });
    page.drawText(safe(k.label), {
      x: x + 3,
      y: yLeft - 11,
      size: 5.5,
      font,
      color: C.muted,
    });
    page.drawText(safe(formatoMoeda.format(k.value)), {
      x: x + 3,
      y: yLeft - 24,
      size: 7,
      font: fontBold,
      color: k.color,
      maxWidth: pW - 6,
    });
  });
  yLeft -= cardH + 18;

  const labels = (seriesGraficos || []).map((s) => s.label);

  ensureLeft(110);
  page.drawText(safe(`Dízimos (${labelJanelaGrafico || ""})`), {
    x: xLeft,
    y: yLeft,
    size: 9,
    font: fontBold,
    color: C.ink,
  });
  yLeft -= 8;
  const chartH1 = 88;
  desenharBarrasChart(page, font, fontBold, {
    x: xLeft,
    y: yLeft,
    width: colLeftW,
    height: chartH1,
    values: (seriesGraficos || []).map((s) => s.dizimo),
    labels,
    barColor: C.green,
    formatoMoeda,
  });
  yLeft -= chartH1 + 16;

  ensureLeft(110);
  page.drawText(safe(`Receitas e despesas (${labelJanelaGrafico || ""})`), {
    x: xLeft,
    y: yLeft,
    size: 9,
    font: fontBold,
    color: C.ink,
  });
  yLeft -= 8;
  const chartH2 = 80;
  desenharLinhaChart(page, font, {
    x: xLeft,
    y: yLeft,
    width: colLeftW,
    height: chartH2,
    labels,
    series: [
      { values: (seriesGraficos || []).map((s) => s.receita) },
      { values: (seriesGraficos || []).map((s) => s.despesa) },
    ],
    colors: [C.green, C.red],
  });
  yLeft -= chartH2 + 16;

  const drawTabela = (titulo, lista, cor) => {
    ensureLeft(20);
    page.drawText(safe(titulo), {
      x: xLeft,
      y: yLeft,
      size: 9,
      font: fontBold,
      color: C.ink,
    });
    yLeft -= 8;
    lineLeft(yLeft);
    yLeft -= 12;
    if (!lista.length) {
      page.drawText(safe("Sem dados."), {
        x: xLeft,
        y: yLeft,
        size: 8,
        font,
        color: C.muted,
      });
      yLeft -= 14;
      return;
    }
    lista.forEach(([tipo, total]) => {
      ensureLeft(12);
      page.drawText(safe(String(tipo)), {
        x: xLeft,
        y: yLeft,
        size: 8,
        font,
        color: C.ink,
        maxWidth: colLeftW - 70,
      });
      page.drawText(safe(`R$ ${formatoMoeda.format(total)}`), {
        x: xLeft + colLeftW - 62,
        y: yLeft,
        size: 8,
        font: fontBold,
        color: cor,
      });
      yLeft -= 12;
    });
    yLeft -= 10;
  };

  drawTabela(
    "Receitas por tipo",
    Object.entries(resumo.porTipoEntrada || {}).sort((a, b) => b[1] - a[1]),
    C.green
  );
  drawTabela(
    "Despesas por tipo",
    Object.entries(resumo.porTipoSaida || {}).sort((a, b) => b[1] - a[1]),
    C.red
  );

  const drawRightHeader = () => {
    page.drawText(safe("Movimentações"), {
      x: xRight,
      y: yRight,
      size: 9,
      font: fontBold,
      color: C.ink,
    });
    yRight -= 6;
    page.drawLine({
      start: { x: xRight, y: yRight },
      end: { x: xRight + colRightW, y: yRight },
      thickness: 0.5,
      color: C.line,
    });
    yRight -= 12;
  };

  page = pagesRef()[0];
  yRight = pageHeight - margin;
  drawRightHeader();

  const hist = historicoPeriodo || [];
  if (hist.length === 0) {
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
      const label = labelMovimento(item);
      const valor = valorMovimento(item);
      const isEnt = item.tipoMovimento === "entrada";
      const sinal = isEnt ? "+" : "-";
      const corVal = isEnt ? C.green : C.red;
      const valorTxt = `${sinal} ${formatoMoeda.format(valor)}`;

      if (yRight - 14 < margin + 16) {
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

      let lab = safe(label);
      if (lab.length > 18) lab = lab.slice(0, 17) + ".";

      page.drawText(lab, {
        x: xRight,
        y: yRight,
        size: 8,
        font,
        color: C.ink,
        maxWidth: colRightW - 52,
      });

      const vw = fontBold.widthOfTextAtSize(valorTxt, 8);
      page.drawText(valorTxt, {
        x: xRight + colRightW - vw,
        y: yRight,
        size: 8,
        font: fontBold,
        color: corVal,
      });

      yRight -= 13;
    }
  }

  const lastPage = pagesRef()[pagesRef().length - 1];
  lastPage.drawText(
    safe(
      `Gerado em ${new Date().toLocaleDateString(
        "pt-BR"
      )} ${new Date().toLocaleTimeString("pt-BR")} · ${
        resumo.quantidade || 0
      } reg.`
    ),
    {
      x: margin,
      y: 14,
      size: 7,
      font,
      color: C.muted,
    }
  );

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
    await RNFS.copyFile(
      cachePath,
      `${RNFS.DownloadDirectoryPath}/${fileName}`
    );
  }

  return fileName;
}
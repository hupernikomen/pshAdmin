import { Platform } from "react-native";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";

const C = {
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.55, 0.58, 0.62),
  line: rgb(0.9, 0.91, 0.92),
  card: rgb(0.96, 0.965, 0.97),
  headerBg: rgb(0.97, 0.975, 0.98),
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

function diaDoRegistro(ts) {
  const n = Number(ts) || 0;
  if (!n) return "--";
  const d = new Date(n);
  if (isNaN(d.getTime())) return "--";
  return String(d.getDate()).padStart(2, "0");
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

function base64ToUint8Array(base64) {
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function embedUmaFonteAndroid(pdfDoc, nomeArquivo) {
  const relative = `fonts/${nomeArquivo}`;
  const b64 = await RNFS.readFileAssets(relative, "base64");
  if (!b64 || b64.length < 50) {
    throw new Error(`Arquivo inválido: ${relative}`);
  }
  const bytes = base64ToUint8Array(b64);
  return pdfDoc.embedFont(bytes, { subset: false });
}

async function embedUmaFonteIos(pdfDoc, nomeArquivo) {
  const candidatos = [
    `${RNFS.MainBundlePath}/fonts/${nomeArquivo}`,
    `${RNFS.MainBundlePath}/${nomeArquivo}`,
  ];
  for (const path of candidatos) {
    if (await RNFS.exists(path)) {
      const b64 = await RNFS.readFile(path, "base64");
      return pdfDoc.embedFont(base64ToUint8Array(b64), { subset: false });
    }
  }
  throw new Error(`Fonte iOS não encontrada: ${nomeArquivo}`);
}

async function embedUmaFonte(pdfDoc, nomeArquivo) {
  if (Platform.OS === "android") {
    return embedUmaFonteAndroid(pdfDoc, nomeArquivo);
  }
  return embedUmaFonteIos(pdfDoc, nomeArquivo);
}

async function carregarFontes(pdfDoc) {
  let font;
  try {
    font = await embedUmaFonte(pdfDoc, "Roboto-Regular.ttf");
  } catch (e) {
    console.log("[PDF] Regular falhou → Helvetica:", e?.message || e);
    const h = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const hb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { font: h, fontMedium: hb, fontBold: hb };
  }

  let fontMedium = font;
  try {
    fontMedium = await embedUmaFonte(pdfDoc, "Roboto-Medium.ttf");
  } catch (e) {
    console.log("[PDF] Medium ausente, usando Regular");
  }

  let fontBold = fontMedium;
  try {
    fontBold = await embedUmaFonte(pdfDoc, "Roboto-Bold.ttf");
  } catch (e) {
    console.log("[PDF] Bold ausente, usando Medium/Regular");
  }

  return { font, fontMedium, fontBold };
}

export async function exportarRelatorioPDF({
  nomeIgreja,
  labelPeriodo,
  resumo,
  projecao,
  historicoPeriodo,
  formatoMoeda,
  nomeTesoureiro,
}) {
  const pdfDoc = await PDFDocument.create();
  const { font, fontMedium, fontBold } = await carregarFontes(pdfDoc);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const gapCol = 24;
  const colRightW = 165;
  const colLeftW = pageWidth - margin * 2 - gapCol - colRightW;
  const xLeft = margin;
  const xRight = margin + colLeftW + gapCol;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yLeft = pageHeight - margin;
  let yRight = pageHeight - margin;

  const pagesRef = () => pdfDoc.getPages();

  // ——— CABEÇALHO FULL WIDTH ———
  const headerTop = pageHeight - 20;
  const headerH = 50;
  const headerBottom = headerTop - headerH;

  page.drawRectangle({
    x: 0,
    y: headerBottom,
    width: pageWidth,
    height: headerH + 20,
    color: C.headerBg,
  });

  // faixa inferior do header
  page.drawLine({
    start: { x: 0, y: headerBottom },
    end: { x: pageWidth, y: headerBottom },
    thickness: 0.8,
    color: C.line,
  });

  const headerPadX = margin;
  const leftBlockW = contentWidth * 0.58;
  const rightBlockX = headerPadX + leftBlockW + 12;
  const rightBlockW = contentWidth - leftBlockW - 12;

  // ESQUERDA: app + igreja
  let yH = headerTop - 6;
  page.drawText(safe("Tig · Tesouraria Igrejas"), {
    x: headerPadX,
    y: yH,
    size: 8,
    font: fontMedium,
    color: C.muted,
    maxWidth: leftBlockW,
  });
  yH -= 16;
  page.drawText(safe(nomeIgreja || "Tesouraria"), {
    x: headerPadX,
    y: yH,
    size: 14,
    font: fontBold,
    color: C.ink,
    maxWidth: leftBlockW,
  });

  // DIREITA: período + tesoureiro (alinhado à direita)
  const periodoTxt = safe(labelPeriodo || "Período não informado");
  const tesoureiroTxt = safe(
    nomeTesoureiro ? `Emitido por ${nomeTesoureiro}` : "Emitido pelo app"
  );

  const drawRightLine = (text, size, fnt, color, y) => {
    const w = fnt.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: rightBlockX + rightBlockW - w,
      y,
      size,
      font: fnt,
      color,
    });
  };

  let yR = headerTop - 10;
  drawRightLine(periodoTxt, 9, fontBold, C.ink, yR);
  yR -= 14;
  drawRightLine(tesoureiroTxt, 8, fontMedium, C.muted, yR);

  // conteúdo começa abaixo do header
  const contentTop = headerBottom - 16;
  yLeft = contentTop;
  yRight = contentTop;

  const drawVLine = (p, topY) => {
    p.drawLine({
      start: { x: xRight - gapCol / 2, y: margin + 20 },
      end: { x: xRight - gapCol / 2, y: topY },
      thickness: 0.5,
      color: C.line,
    });
  };

  drawVLine(page, contentTop + 4);

  const novaPagina = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    // páginas seguintes: só linha vertical, sem repetir header grande
    yLeft = pageHeight - margin;
    yRight = pageHeight - margin;
    drawVLine(page, pageHeight - margin);
  };

  const ensureLeft = (h) => {
    if (yLeft - h < margin + 28) novaPagina();
  };

  const sectionLeft = (titulo) => {
    ensureLeft(40);
    yLeft -= 12;

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

  const drawCard = (
    x,
    top,
    w,
    h,
    label,
    valueText,
    valueColor,
    destaque = false
  ) => {
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
      font: destaque ? fontBold : fontMedium,
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
      const vw = fontMedium.widthOfTextAtSize(val, 8);
      page.drawText(val, {
        x: xLeft + colLeftW - vw,
        y: yLeft,
        size: 8,
        font: fontMedium,
        color: cor,
      });
      yLeft -= 14;
    });
    yLeft -= 8;
  };

  // ——— RESULTADO DO PERÍODO ———
  sectionLeft("Resultado do período");
  {
    const gap = 3;
    const cardH = 44;
    const cardW = (colLeftW - gap * 3) / 4;
    ensureLeft(cardH + 12);

    const itens = [
      ["Saldo anterior", money(formatoMoeda, resumo.saldoAnterior || 0), C.ink, false],
      ["Receitas", money(formatoMoeda, resumo.entradas), C.greenDark, false],
      ["Despesas", money(formatoMoeda, resumo.saidas), C.red, false],
      ["Saldo atual", money(formatoMoeda, resumo.saldoAtual || 0), C.ink, true],
    ];
    itens.forEach((k, i) => {
      const x = xLeft + i * (cardW + gap);
      drawCard(x, yLeft, cardW, cardH, k[0], k[1], k[2], k[3]);
    });
    yLeft -= cardH + 10;
  }

  // ——— PROJEÇÃO ———
  sectionLeft("Projeção");
  {
    const gap = 3;
    const cardH = 44;
    const cardW = (colLeftW - gap * 2) / 3;
    ensureLeft(cardH + 12);

    const itens = [
      ["A receber", money(formatoMoeda, projecao.aReceber), C.greenDark, false],
      ["A pagar", money(formatoMoeda, projecao.aPagar), C.red, false],
      ["Saldo projetado", money(formatoMoeda, projecao.saldoProjetado), C.ink, true],
    ];
    itens.forEach((k, i) => {
      const x = xLeft + i * (cardW + gap);
      drawCard(x, yLeft, cardW, cardH, k[0], k[1], k[2], k[3]);
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
    const gap = 3;
    const cardH = 44;
    const cardW = (colLeftW - gap * 2) / 3;
    ensureLeft(cardH * 2 + gap + 12);

    const linhaDiz = [
      ["Dízimos (% receitas)", fmtPct(pctDizimos), C.greenDark, false],
      ["Qtd. de dizimistas", String(diz.qtd), C.ink, false],
      ["Total dízimos", money(formatoMoeda, totalDizimos), C.greenDark, true],
    ];
    linhaDiz.forEach((k, i) => {
      const x = xLeft + i * (cardW + gap);
      drawCard(x, yLeft, cardW, cardH, k[0], k[1], k[2], k[3]);
    });

    const top2 = yLeft - cardH - gap;
    const linhaOfe = [
      ["Ofertas (% receitas)", fmtPct(pctOfertas), C.greenDark, false],
      ["Qtd. de ofertas", String(qtdOfertas), C.ink, false],
      ["Total ofertas", money(formatoMoeda, totalOfertas), C.greenDark, true],
    ];
    linhaOfe.forEach((k, i) => {
      const x = xLeft + i * (cardW + gap);
      drawCard(x, top2, cardW, cardH, k[0], k[1], k[2], k[3]);
    });

    yLeft -= cardH * 2 + gap + 10;
  }

  // ——— DESPESAS FIXAS ———
  const porFixa = {};
  (historicoPeriodo || []).forEach((item) => {
    if (item.tipoMovimento !== "saida") return;
    const t = String(item.tipo || "").toLowerCase();
    if (!t.includes("fixa")) return;
    const chave = String(item.descricao || item.tipo || "Conta fixa").trim();
    porFixa[chave] = (porFixa[chave] || 0) + valorSaida(item);
  });

  listaTipo(
    "Despesas fixas",
    Object.entries(porFixa).sort((a, b) => b[1] - a[1]),
    C.red
  );

  // ——— DESPESAS POR MINISTÉRIOS ———
  const porMinisterio =
    resumo.porMinisterioSaida &&
    typeof resumo.porMinisterioSaida === "object"
      ? resumo.porMinisterioSaida
      : {};

  listaTipo(
    "Despesas por ministérios",
    Object.entries(porMinisterio).sort((a, b) => b[1] - a[1]),
    C.red
  );

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
  yRight = contentTop;
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
      const dia = diaDoRegistro(item.data);
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
          drawVLine(page, pageHeight - margin);
        }
        yRight = pageHeight - margin;
        drawRightHeader();
      }

      let nome = safe(`${dia} ${lab}`);
      if (nome.length > 22) nome = nome.slice(0, 21) + ".";

      page.drawText(nome, {
        x: xRight,
        y: yRight,
        size: 8,
        font,
        color: C.ink,
        maxWidth: colRightW - 56,
      });

      const vw = fontMedium.widthOfTextAtSize(valorTxt, 8);
      page.drawText(valorTxt, {
        x: xRight + colRightW - vw,
        y: yRight,
        size: 8,
        font: fontMedium,
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
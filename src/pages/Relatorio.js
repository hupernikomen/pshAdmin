import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import Load from "../componentes/Load";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimDoDia(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function arred(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function valorEntrada(item) {
  return Number(item.valorRecebidoTotal) || 0;
}

function valorSaida(item) {
  return Number(item.valorPagoTotal) || 0;
}

function isDizimo(item) {
  const t = String(item.tipo || "").toLowerCase();
  return t.includes("dizimo") || t.includes("dízimo");
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

function resumoDeLista(lista) {
  let entradas = 0;
  let saidas = 0;
  let dizimos = 0;
  const porTipoEntrada = {};
  const porTipoSaida = {};

  lista.forEach((item) => {
    const tipo = item.tipo || "Outros";
    if (item.tipoMovimento === "entrada") {
      const v = valorEntrada(item);
      entradas += v;
      porTipoEntrada[tipo] = (porTipoEntrada[tipo] || 0) + v;
      if (isDizimo(item)) dizimos += v;
    } else if (item.tipoMovimento === "saida") {
      const v = valorSaida(item);
      saidas += v;
      porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
    }
  });

  return {
    entradas: arred(entradas),
    saidas: arred(saidas),
    saldo: arred(entradas - saidas),
    dizimos: arred(dizimos),
    porTipoEntrada,
    porTipoSaida,
    quantidade: lista.length,
  };
}

const C = {
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.55, 0.58, 0.62),
  line: rgb(0.9, 0.91, 0.92),
  card: rgb(0.96, 0.96, 0.97),
  green: rgb(0.18, 0.42, 0.31),
  red: rgb(0.61, 0.13, 0.15),
  white: rgb(1, 1, 1),
};

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
  const stepX = n === 1 ? plotW / 2 : plotW / (n - 1);

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
      x: px - 8,
      y: y - height + 4,
      size: 7,
      font,
      color: mutedColor,
    });
  });
}

export default function Relatorio() {
  const {
    dadosFinancas,
    load,
    HistoricoMovimentos,
    formatoMoeda,
    igrejaAtiva,
    saldo,
  } = useContext(AppContext);
  const { uid, authPronto } = useAuth();
  const { colors } = useTheme();

  const agora = new Date();
  const [modoFiltro, setModoFiltro] = useState("mes");
  const [mesSelecionado, setMesSelecionado] = useState(agora.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(agora.getFullYear());
  const [dataDe, setDataDe] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [dataAte, setDataAte] = useState(new Date());
  const [showDe, setShowDe] = useState(false);
  const [showAte, setShowAte] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!authPronto || !uid) return;
    HistoricoMovimentos();
  }, [authPronto, uid, igrejaAtiva?.id]);

  const filtrados = useMemo(() => {
    const lista = dadosFinancas || [];

    if (modoFiltro === "periodo") {
      const ini = inicioDoDia(dataDe).getTime();
      const fim = fimDoDia(dataAte).getTime();
      return lista.filter((item) => {
        const ts = item.data || item.createdAt || item.reg;
        if (!ts) return false;
        return ts >= ini && ts <= fim;
      });
    }

    return lista.filter((item) => {
      const ts = item.data || item.createdAt || item.reg;
      if (!ts) return false;
      const d = new Date(ts);
      return (
        d.getFullYear() === anoSelecionado && d.getMonth() === mesSelecionado
      );
    });
  }, [
    dadosFinancas,
    modoFiltro,
    dataDe,
    dataAte,
    mesSelecionado,
    anoSelecionado,
  ]);

  const historicoPeriodo = useMemo(() => {
    return [...filtrados]
      .filter((i) => i.tipo !== "Saldo inicial")
      .sort((a, b) => (a.data || a.reg || 0) - (b.data || b.reg || 0));
  }, [filtrados]);

  const resumo = useMemo(() => resumoDeLista(filtrados), [filtrados]);

  const projecao = useMemo(() => {
    const lista = dadosFinancas || [];
    let aReceber = 0;
    let aPagar = 0;

    lista.forEach((i) => {
      if (i.tipoMovimento === "entrada") {
        if (i.tipo === "Saldo inicial") return;
        if (i.status === "quitada") return;
        const falta =
          (Number(i.valorTotal) || 0) - (Number(i.valorRecebidoTotal) || 0);
        if (falta > 0) aReceber += falta;
        return;
      }
      if (i.tipoMovimento === "saida") {
        if (i.status === "quitada") return;
        const parcelas = Array.isArray(i.parcelas) ? i.parcelas : [];
        if (parcelas.length > 0) {
          parcelas.forEach((p) => {
            if (p.status === "aberta") aPagar += Number(p.valor) || 0;
          });
          return;
        }
        const falta =
          (Number(i.valorTotal) || 0) - (Number(i.valorPagoTotal) || 0);
        if (falta > 0) aPagar += falta;
      }
    });

    const saldoAtual = Number(saldo) || 0;
    return {
      saldoAtual: arred(saldoAtual),
      aReceber: arred(aReceber),
      aPagar: arred(aPagar),
      saldoProjetado: arred(saldoAtual - aPagar + aReceber),
    };
  }, [dadosFinancas, saldo]);

  const seriesGraficos = useMemo(() => {
    const lista = dadosFinancas || [];
    const pontos = [];
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const m = ref.getMonth();
      const a = ref.getFullYear();
      const ini = new Date(a, m, 1, 0, 0, 0, 0).getTime();
      const fimM = new Date(a, m + 1, 0, 23, 59, 59, 999).getTime();
      let receita = 0;
      let despesa = 0;
      let dizimo = 0;
      lista.forEach((item) => {
        const ts = item.data || item.createdAt || item.reg;
        if (!ts || ts < ini || ts > fimM) return;
        if (item.tipoMovimento === "entrada") {
          const v = valorEntrada(item);
          receita += v;
          if (isDizimo(item)) dizimo += v;
        } else if (item.tipoMovimento === "saida") {
          despesa += valorSaida(item);
        }
      });
      pontos.push({
        label: MESES_CURTO[m],
        receita: arred(receita),
        despesa: arred(despesa),
        dizimo: arred(dizimo),
      });
    }
    return pontos;
  }, [dadosFinancas]);

  const labelPeriodo = useMemo(() => {
    if (modoFiltro === "periodo") {
      return `${inicioDoDia(dataDe).toLocaleDateString(
        "pt-BR"
      )} até ${fimDoDia(dataAte).toLocaleDateString("pt-BR")}`;
    }
    return `${MESES[mesSelecionado]} de ${anoSelecionado}`;
  }, [modoFiltro, dataDe, dataAte, mesSelecionado, anoSelecionado]);

  async function exportarPDF() {
    if (filtrados.length === 0) {
      Alert.alert("Aviso", "Não há registros neste período.");
      return;
    }

    setGerando(true);

    try {
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

      // Mantém acentos (WinAnsi / Helvetica). Só normaliza aspas e travessões.
      const safe = (t) =>
        String(t ?? "")
          .replace(/\u2013|\u2014/g, "-")
          .replace(/\u2018|\u2019/g, "'")
          .replace(/\u201c|\u201d/g, '"')
          .replace(/\u2026/g, "...");

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
        if (yLeft - h < margin + 20) {
          novaPagina();
        }
      };

      const lineLeft = (yy) => {
        page.drawLine({
          start: { x: xLeft, y: yy },
          end: { x: xLeft + colLeftW, y: yy },
          thickness: 0.5,
          color: C.line,
        });
      };

      const nomeIgreja = igrejaAtiva?.nome || "Tesouraria";

      // ===== COLUNA ESQUERDA =====
      page.drawText(safe(nomeIgreja), {
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

      const labels = seriesGraficos.map((s) => s.label);

      ensureLeft(100);
      page.drawText(safe("Dízimos (12 meses)"), {
        x: xLeft,
        y: yLeft,
        size: 9,
        font: fontBold,
        color: C.ink,
      });
      yLeft -= 8;
      const chartH1 = 72;
      desenharLinhaChart(page, font, {
        x: xLeft,
        y: yLeft,
        width: colLeftW,
        height: chartH1,
        labels,
        series: [{ values: seriesGraficos.map((s) => s.dizimo) }],
        colors: [C.green],
      });
      yLeft -= chartH1 + 16;

      ensureLeft(110);
      page.drawText(safe("Receitas e despesas (12 meses)"), {
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
          { values: seriesGraficos.map((s) => s.receita) },
          { values: seriesGraficos.map((s) => s.despesa) },
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
        Object.entries(resumo.porTipoEntrada).sort((a, b) => b[1] - a[1]),
        C.green
      );
      drawTabela(
        "Despesas por tipo",
        Object.entries(resumo.porTipoSaida).sort((a, b) => b[1] - a[1]),
        C.red
      );

      // ===== COLUNA DIREITA =====
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

      if (historicoPeriodo.length === 0) {
        page.drawText(safe("Nenhum lançamento."), {
          x: xRight,
          y: yRight,
          size: 8,
          font,
          color: C.muted,
        });
      } else {
        for (let i = 0; i < historicoPeriodo.length; i++) {
          const item = historicoPeriodo[i];
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
            resumo.quantidade
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
        Alert.alert("PDF salvo", `Arquivo salvo em Downloads:\n\n${fileName}`);
      }
    } catch (e) {
      console.log("ERRO PDF:", e);
      Alert.alert("Erro ao exportar PDF", e?.message || "Erro desconhecido");
    } finally {
      setGerando(false);
    }
  }

  if ((!authPronto || load) && !(dadosFinancas || []).length) return <Load />;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.block}>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modoFiltro === "mes" && { backgroundColor: colors.principal },
              ]}
              onPress={() => setModoFiltro("mes")}
            >
              <Text
                style={[
                  styles.segmentText,
                  modoFiltro === "mes" && { color: "#fff" },
                ]}
              >
                Por mês
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modoFiltro === "periodo" && {
                  backgroundColor: colors.principal,
                },
              ]}
              onPress={() => setModoFiltro("periodo")}
            >
              <Text
                style={[
                  styles.segmentText,
                  modoFiltro === "periodo" && { color: "#fff" },
                ]}
              >
                Por período
              </Text>
            </TouchableOpacity>
          </View>

          {modoFiltro === "mes" ? (
            <>
              <View style={styles.anoRow}>
                <TouchableOpacity
                  style={styles.anoBtn}
                  onPress={() => setAnoSelecionado((a) => a - 1)}
                >
                  <Ionicons name="chevron-back" size={18} color="#444" />
                </TouchableOpacity>
                <Text style={styles.anoText}>{anoSelecionado}</Text>
                <TouchableOpacity
                  style={styles.anoBtn}
                  onPress={() => setAnoSelecionado((a) => a + 1)}
                >
                  <Ionicons name="chevron-forward" size={18} color="#444" />
                </TouchableOpacity>
              </View>

              <View style={styles.mesesGrid}>
                {MESES.map((nome, index) => {
                  const ativo = mesSelecionado === index;
                  return (
                    <TouchableOpacity
                      key={nome}
                      style={[
                        styles.mesChip,
                        ativo && { backgroundColor: colors.principal },
                      ]}
                      onPress={() => setMesSelecionado(index)}
                    >
                      <Text
                        style={[styles.mesText, ativo && { color: "#fff" }]}
                      >
                        {nome.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.customRow}>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setShowDe(true)}
              >
                <Text style={styles.dateLabel}>De</Text>
                <Text style={styles.dateValue}>
                  {dataDe.toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setShowAte(true)}
              >
                <Text style={styles.dateLabel}>Até</Text>
                <Text style={styles.dateValue}>
                  {dataAte.toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {showDe && (
            <DateTimePicker
              value={dataDe}
              mode="date"
              display="default"
              maximumDate={dataAte}
              onChange={(e, selected) => {
                setShowDe(false);
                if (selected) setDataDe(selected);
              }}
            />
          )}
          {showAte && (
            <DateTimePicker
              value={dataAte}
              mode="date"
              display="default"
              minimumDate={dataDe}
              maximumDate={new Date()}
              onChange={(e, selected) => {
                setShowAte(false);
                if (selected) setDataAte(selected);
              }}
            />
          )}

          <View style={styles.filtroAtivo}>
            <Ionicons name="calendar-outline" size={14} color="#9aa0a6" />
            <Text style={styles.filtroAtivoText}>{labelPeriodo}</Text>
            <Text style={styles.filtroQtd}>{resumo.quantidade} reg.</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pdfBtn,
              { backgroundColor: colors.principal || "#65C556" },
              gerando && { opacity: 0.75 },
            ]}
            onPress={exportarPDF}
            disabled={gerando}
            activeOpacity={0.85}
          >
            {gerando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.pdfBtnText}>Gerar relatório</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  block: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#555",
  },
  anoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 18,
  },
  anoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f4f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  anoText: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
    minWidth: 64,
    textAlign: "center",
  },
  mesesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mesChip: {
    width: "22%",
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f4f5f7",
  },
  mesText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
    color: "#333",
  },
  customRow: { flexDirection: "row", gap: 10 },
  dateBox: {
    flex: 1,
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  filtroAtivo: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ececec",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filtroAtivoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#555",
  },
  filtroQtd: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
    color: "#9aa0a6",
  },
  pdfBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pdfBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
});
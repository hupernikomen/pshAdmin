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
      const margin = 36;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      const safe = (t) =>
        String(t ?? "")
          .replace(/\u2013|\u2014/g, "-")
          .replace(/\u2018|\u2019/g, "'")
          .replace(/\u201c|\u201d/g, '"')
          .replace(/\u2026/g, "...");

      const ensure = (h) => {
        if (y - h < margin + 28) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      };

      const line = (x1, x2, yy) => {
        page.drawLine({
          start: { x: x1, y: yy },
          end: { x: x2, y: yy },
          thickness: 0.6,
          color: C.line,
        });
      };

      const nomeIgreja = igrejaAtiva?.nome || "Tesouraria";

      page.drawText(safe(nomeIgreja), {
        x: margin,
        y,
        size: 16,
        font: fontBold,
        color: C.ink,
      });
      y -= 16;
      page.drawText(safe("RELATÓRIO FINANCEIRO"), {
        x: margin,
        y,
        size: 9,
        font,
        color: C.muted,
      });
      y -= 14;
      page.drawText(safe(labelPeriodo), {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: C.ink,
      });
      y -= 10;
      line(margin, pageWidth - margin, y);
      y -= 20;

      const textoExec = safe(
        `Este relatório contempla exclusivamente os lançamentos do período referente a: ${labelPeriodo}. ` +
          `Receitas realizadas R$ ${formatoMoeda.format(
            resumo.entradas
          )}, despesas pagas R$ ${formatoMoeda.format(
            resumo.saidas
          )}, saldo R$ ${formatoMoeda.format(resumo.saldo)}. ` +
          `O saldo atual da tesouraria é de R$ ${formatoMoeda.format(
            projecao.saldoAtual
          )}. Considerando os valores a receber (R$ ${formatoMoeda.format(
            projecao.aReceber
          )}) e as obrigações a pagar (R$ ${formatoMoeda.format(
            projecao.aPagar
          )}), o saldo projetado é de R$ ${formatoMoeda.format(
            projecao.saldoProjetado
          )}.`
      );

      let resto = textoExec;
      const maxChars = 95;
      while (resto.length > 0) {
        ensure(14);
        let chunk = resto.slice(0, maxChars);
        if (resto.length > maxChars) {
          const sp = chunk.lastIndexOf(" ");
          if (sp > 40) chunk = chunk.slice(0, sp);
        }
        page.drawText(chunk, {
          x: margin,
          y,
          size: 9,
          font,
          color: C.ink,
          maxWidth: pageWidth - margin * 2,
        });
        y -= 13;
        resto = resto.slice(chunk.length).trim();
      }
      y -= 22;

      const cardW = (pageWidth - margin * 2 - 18) / 4;
      const cardH = 44;
      ensure(cardH + 16);

      [
        { label: "RECEITAS", value: resumo.entradas, color: C.green },
        { label: "DESPESAS", value: resumo.saidas, color: C.red },
        { label: "RESULTADO", value: resumo.saldo, color: C.ink },
        { label: "DÍZIMOS", value: resumo.dizimos, color: C.green },
      ].forEach((k, i) => {
        const x = margin + i * (cardW + 6);
        page.drawRectangle({
          x,
          y: y - cardH,
          width: cardW,
          height: cardH,
          color: C.card,
          borderColor: C.line,
          borderWidth: 0.5,
        });
        page.drawText(safe(k.label), {
          x: x + 8,
          y: y - 14,
          size: 7,
          font,
          color: C.muted,
        });
        page.drawText(safe(`R$ ${formatoMoeda.format(k.value)}`), {
          x: x + 8,
          y: y - 32,
          size: 9,
          font: fontBold,
          color: k.color,
          maxWidth: cardW - 12,
        });
      });
      y -= cardH + 32;

      ensure(cardH + 28);
      page.drawText(safe("Posição e projeção (tesouraria)"), {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: C.ink,
      });
      y -= 14;
      [
        { label: "SALDO ATUAL", value: projecao.saldoAtual, color: C.ink },
        { label: "A RECEBER", value: projecao.aReceber, color: C.green },
        { label: "A PAGAR", value: projecao.aPagar, color: C.red },
        { label: "PROJETADO", value: projecao.saldoProjetado, color: C.ink },
      ].forEach((k, i) => {
        const x = margin + i * (cardW + 6);
        page.drawRectangle({
          x,
          y: y - cardH,
          width: cardW,
          height: cardH,
          color: C.card,
          borderColor: C.line,
          borderWidth: 0.5,
        });
        page.drawText(safe(k.label), {
          x: x + 8,
          y: y - 14,
          size: 7,
          font,
          color: C.muted,
        });
        page.drawText(safe(`R$ ${formatoMoeda.format(k.value)}`), {
          x: x + 8,
          y: y - 32,
          size: 9,
          font: fontBold,
          color: k.color,
          maxWidth: cardW - 12,
        });
      });
      y -= cardH + 32;

      const labels = seriesGraficos.map((s) => s.label);
      const chartW = pageWidth - margin * 2;

      ensure(140);
      page.drawText(safe("Evolução dos dízimos (12 meses)"), {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: C.ink,
      });
      y -= 10;
      line(margin, pageWidth - margin, y);
      y -= 12;
      const chartH1 = 100;
      desenharLinhaChart(page, font, {
        x: margin,
        y,
        width: chartW,
        height: chartH1,
        labels,
        series: [{ values: seriesGraficos.map((s) => s.dizimo) }],
        colors: [C.green],
      });
      y -= chartH1 + 32;

      ensure(160);
      page.drawText(safe("Receitas e despesas (12 meses)"), {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: C.ink,
      });
      y -= 10;
      line(margin, pageWidth - margin, y);
      y -= 8;
      page.drawCircle({
        x: pageWidth - margin - 105,
        y: y - 2,
        size: 2.5,
        color: C.green,
      });
      page.drawText(safe("Receitas"), {
        x: pageWidth - margin - 98,
        y: y - 5,
        size: 7,
        font,
        color: C.muted,
      });
      page.drawCircle({
        x: pageWidth - margin - 50,
        y: y - 2,
        size: 2.5,
        color: C.red,
      });
      page.drawText(safe("Despesas"), {
        x: pageWidth - margin - 43,
        y: y - 5,
        size: 7,
        font,
        color: C.muted,
      });
      y -= 12;
      const chartH2 = 110;
      desenharLinhaChart(page, font, {
        x: margin,
        y,
        width: chartW,
        height: chartH2,
        labels,
        series: [
          { values: seriesGraficos.map((s) => s.receita) },
          { values: seriesGraficos.map((s) => s.despesa) },
        ],
        colors: [C.green, C.red],
      });
      y -= chartH2 + 32;

      const entradas = Object.entries(resumo.porTipoEntrada).sort(
        (a, b) => b[1] - a[1]
      );
      const saidas = Object.entries(resumo.porTipoSaida).sort(
        (a, b) => b[1] - a[1]
      );

      const drawTabela = (titulo, lista, cor) => {
        ensure(24);
        page.drawText(safe(titulo), {
          x: margin,
          y,
          size: 10,
          font: fontBold,
          color: C.ink,
        });
        y -= 10;
        line(margin, pageWidth - margin, y);
        y -= 16;
        if (!lista.length) {
          page.drawText(safe("Sem dados no período."), {
            x: margin,
            y,
            size: 9,
            font,
            color: C.muted,
          });
          y -= 20;
          return;
        }
        lista.forEach(([tipo, total]) => {
          ensure(14);
          page.drawText(safe(String(tipo)), {
            x: margin,
            y,
            size: 9,
            font,
            color: C.ink,
            maxWidth: 320,
          });
          page.drawText(safe(`R$ ${formatoMoeda.format(total)}`), {
            x: pageWidth - margin - 90,
            y,
            size: 9,
            font: fontBold,
            color: cor,
          });
          y -= 14;
        });
        y -= 18;
      };

      drawTabela("Receitas por tipo (período filtrado)", entradas, C.green);
      drawTabela("Despesas por tipo (período filtrado)", saidas, C.red);

      ensure(40);
      y -= 12;
      line(margin, pageWidth - margin, y);
      y -= 14;
      page.drawText(
        safe(
          `Gerado em ${new Date().toLocaleDateString(
            "pt-BR"
          )} ${new Date().toLocaleTimeString("pt-BR")} · ${
            resumo.quantidade
          } registro(s) no filtro`
        ),
        { x: margin, y, size: 8, font, color: C.muted }
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
  container: { flex: 1, paddingHorizontal:14 },
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
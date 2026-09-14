import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

const PERIODOS = [
  { id: "7d", label: "7 dias" },
  { id: "15d", label: "15 dias" },
  { id: "1m", label: "1 mês" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "1a", label: "1 ano" },
  { id: "custom", label: "Personalizado" },
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

function calcularPeriodo(id, de, ate) {
  const agora = new Date();
  const fim = fimDoDia(agora);
  let inicio = inicioDoDia(agora);

  switch (id) {
    case "7d":
      inicio.setDate(inicio.getDate() - 7);
      break;
    case "15d":
      inicio.setDate(inicio.getDate() - 15);
      break;
    case "1m":
      inicio.setMonth(inicio.getMonth() - 1);
      break;
    case "3m":
      inicio.setMonth(inicio.getMonth() - 3);
      break;
    case "6m":
      inicio.setMonth(inicio.getMonth() - 6);
      break;
    case "1a":
      inicio.setFullYear(inicio.getFullYear() - 1);
      break;
    case "custom":
      return {
        inicio: inicioDoDia(de),
        fim: fimDoDia(ate),
      };
    default:
      inicio.setMonth(inicio.getMonth() - 1);
  }

  return { inicio, fim };
}

function textoSemAcento(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Relatorio() {
  const { dadosFinancas, load, HistoricoMovimentos, formatoMoeda } =
    useContext(AppContext);
  const { colors } = useTheme();

  const [periodoId, setPeriodoId] = useState("1m");
  const [dataDe, setDataDe] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [dataAte, setDataAte] = useState(new Date());
  const [showDe, setShowDe] = useState(false);
  const [showAte, setShowAte] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    HistoricoMovimentos();
  }, []);

  const { inicio, fim } = useMemo(
    () => calcularPeriodo(periodoId, dataDe, dataAte),
    [periodoId, dataDe, dataAte]
  );

  const filtrados = useMemo(() => {
    return (dadosFinancas || []).filter((item) => {
      const ts = item.data || item.createdAt || item.reg;
      if (!ts) return false;
      const d = new Date(ts);
      return d >= inicio && d <= fim;
    });
  }, [dadosFinancas, inicio, fim]);

  const resumo = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    const porTipoEntrada = {};
    const porTipoSaida = {};

    filtrados.forEach((item) => {
      const valor =
        item.valorRecebidoTotal ||
        item.valorPagoTotal ||
        item.valorTotal ||
        0;
      const tipo = item.tipo || "Outros";

      if (item.tipoMovimento === "entrada") {
        entradas += valor;
        porTipoEntrada[tipo] = (porTipoEntrada[tipo] || 0) + valor;
      } else if (item.tipoMovimento === "saida") {
        saidas += valor;
        porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + valor;
      }
    });

    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      porTipoEntrada,
      porTipoSaida,
      quantidade: filtrados.length,
    };
  }, [filtrados]);

  const labelPeriodo = useMemo(() => {
    const a = inicio.toLocaleDateString("pt-BR");
    const b = fim.toLocaleDateString("pt-BR");
    return `${a} ate ${b}`;
  }, [inicio, fim]);

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
    const gap = 14;
    const leftWidth = 340;
    const rightX = margin + leftWidth + gap;
    const rightWidth = pageWidth - rightX - margin;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yLeft = pageHeight - margin;
    let yRight = pageHeight - margin;

    const safe = (t) =>
      String(t ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const ensureLeft = (need = 14) => {
      if (yLeft - need < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yLeft = pageHeight - margin;
        yRight = pageHeight - margin;
        drawRightHeader();
      }
    };

    const ensureRight = (need = 12) => {
      if (yRight - need < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yLeft = pageHeight - margin;
        yRight = pageHeight - margin;
        drawLeftHeader();
      }
    };

    const textLeft = (text, opts = {}) => {
      const size = opts.size || 10;
      const used = opts.bold ? fontBold : font;
      ensureLeft(size + 4);
      page.drawText(safe(text), {
        x: opts.x ?? margin,
        y: yLeft,
        size,
        font: used,
        color: opts.color || rgb(0.2, 0.2, 0.2),
        maxWidth: opts.maxWidth || leftWidth,
      });
      yLeft -= opts.lh || size + 5;
    };

    const textRight = (text, opts = {}) => {
      const size = opts.size || 8;
      const used = opts.bold ? fontBold : font;
      ensureRight(size + 3);
      page.drawText(safe(text), {
        x: opts.x ?? rightX,
        y: yRight,
        size,
        font: used,
        color: opts.color || rgb(0.25, 0.25, 0.25),
        maxWidth: opts.maxWidth || rightWidth,
      });
      yRight -= opts.lh || size + 4;
    };

    const drawLeftHeader = () => {
      textLeft("Relatorio Financeiro", {
        size: 16,
        bold: true,
        color: rgb(0.17, 0.24, 0.31),
        lh: 20,
      });
      textLeft(labelPeriodo, {
        size: 9,
        color: rgb(0.5, 0.55, 0.55),
        lh: 12,
      });
      textLeft("Resumo Financeiro do Periodo", {
        size: 9,
        color: rgb(0.5, 0.55, 0.55),
        lh: 16,
      });

      // cards resumo
      const cardW = (leftWidth - 8) / 3;
      const cardH = 36;
      ensureLeft(cardH + 12);
      const cards = [
        {
          label: "RECEITAS",
          value: `R$ ${formatoMoeda.format(resumo.entradas)}`,
          color: rgb(0.91, 0.96, 0.91),
        },
        {
          label: "DESPESAS",
          value: `R$ ${formatoMoeda.format(resumo.saidas)}`,
          color: rgb(1, 0.92, 0.93),
        },
        {
          label: "SALDO",
          value: `R$ ${formatoMoeda.format(resumo.saldo)}`,
          color: rgb(0.89, 0.95, 0.99),
        },
      ];

      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 4);
        page.drawRectangle({
          x,
          y: yLeft - cardH,
          width: cardW,
          height: cardH,
          color: c.color,
        });
        page.drawText(c.label, {
          x: x + 6,
          y: yLeft - 14,
          size: 8,
          font: fontBold,
          color: rgb(0.2, 0.28, 0.33),
        });
        page.drawText(safe(c.value), {
          x: x + 6,
          y: yLeft - 28,
          size: 9,
          font: fontBold,
          color: rgb(0.17, 0.24, 0.31),
          maxWidth: cardW - 10,
        });
      });

      yLeft -= cardH + 14;
    };

    const drawRightHeader = () => {
      textRight("Movimentacoes", {
        size: 11,
        bold: true,
        color: rgb(0.17, 0.24, 0.31),
        lh: 16,
      });
    };

    // ===== COLUNA ESQUERDA =====
    drawLeftHeader();

    const entradas = Object.entries(resumo.porTipoEntrada).sort(
      (a, b) => b[1] - a[1]
    );
    const saidas = Object.entries(resumo.porTipoSaida).sort(
      (a, b) => b[1] - a[1]
    );

    if (entradas.length > 0) {
      textLeft("Receitas", {
        size: 12,
        bold: true,
        color: rgb(0.17, 0.24, 0.31),
        lh: 16,
      });
      entradas.forEach(([tipo, total]) => {
        ensureLeft(12);
        page.drawText(safe(String(tipo).toUpperCase()), {
          x: margin,
          y: yLeft,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.29, 0.37),
          maxWidth: leftWidth * 0.6,
        });
        page.drawText(safe(`+ ${formatoMoeda.format(total)}`), {
          x: margin + leftWidth * 0.62,
          y: yLeft,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.53, 0.28),
        });
        yLeft -= 12;
      });
      yLeft -= 6;
    }

    if (saidas.length > 0) {
      textLeft("Despesas", {
        size: 12,
        bold: true,
        color: rgb(0.17, 0.24, 0.31),
        lh: 16,
      });
      saidas.forEach(([tipo, total]) => {
        ensureLeft(12);
        page.drawText(safe(String(tipo).toUpperCase()), {
          x: margin,
          y: yLeft,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.29, 0.37),
          maxWidth: leftWidth * 0.6,
        });
        page.drawText(safe(`- ${formatoMoeda.format(total)}`), {
          x: margin + leftWidth * 0.62,
          y: yLeft,
          size: 9,
          font: fontBold,
          color: rgb(0.75, 0.22, 0.17),
        });
        yLeft -= 12;
      });
      yLeft -= 8;
    }

    // linha divisória vertical
    page.drawLine({
      start: { x: rightX - gap / 2, y: margin },
      end: { x: rightX - gap / 2, y: pageHeight - margin },
      thickness: 0.6,
      color: rgb(0.88, 0.88, 0.88),
    });

    // ===== COLUNA DIREITA =====
    drawRightHeader();

    const lista = [...filtrados].sort((a, b) => (a.data || 0) - (b.data || 0));

    lista.forEach((item) => {
      const isEntrada = item.tipoMovimento === "entrada";
      const valor =
        item.valorRecebidoTotal ||
        item.valorPagoTotal ||
        item.valorTotal ||
        0;

      const dia = item.data
        ? String(new Date(item.data).getDate()).padStart(2, "0")
        : "--";

      // no app antigo, dízimo ficava mascarado
      const isDizimo =
        String(item.tipo || "").toLowerCase().includes("dizimo") ||
        String(item.tipo || "").toLowerCase().includes("dízimo");

      const desc = isDizimo
        ? "********"
        : item.descricao || item.tipo || "-";

      const linha = `${dia} - ${desc}`;
      const valorStr = `${isEntrada ? "+" : "-"} ${formatoMoeda.format(valor)}`;

      ensureRight(20);

      page.drawText(safe(linha), {
        x: rightX,
        y: yRight,
        size: 8,
        font,
        color: rgb(0.2, 0.29, 0.37),
        maxWidth: rightWidth * 0.62,
      });

      page.drawText(safe(valorStr), {
        x: rightX + rightWidth * 0.64,
        y: yRight,
        size: 8,
        font: fontBold,
        color: isEntrada ? rgb(0.1, 0.53, 0.28) : rgb(0.75, 0.22, 0.17),
        maxWidth: rightWidth * 0.36,
      });

      yRight -= 11;
    });

    // footer na coluna esquerda
    ensureLeft(24);
    yLeft -= 6;
    page.drawLine({
      start: { x: margin, y: yLeft },
      end: { x: margin + leftWidth, y: yLeft },
      thickness: 0.6,
      color: rgb(0.88, 0.88, 0.88),
    });
    yLeft -= 12;
    textLeft(
      `Relatorio de ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`,
      {
        size: 8,
        color: rgb(0.5, 0.55, 0.55),
        lh: 10,
      }
    );

    // salvar e compartilhar
    const base64 = await pdfDoc.saveAsBase64();
    if (!base64) throw new Error("Falha ao gerar o conteudo do PDF.");

    const fileName = `relatorio_${Date.now()}.pdf`;
    const cachePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
    await RNFS.writeFile(cachePath, base64, "base64");

    const fileUrl = cachePath.startsWith("file://")
      ? cachePath
      : `file://${cachePath}`;

    try {
      await Share.open({
        title: "Relatorio Financeiro",
        url: fileUrl,
        type: "application/pdf",
        showAppsToView: true,
        failOnCancel: false,
      });
    } catch (shareError) {
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.copyFile(cachePath, downloadPath);
      Alert.alert(
        "PDF salvo",
        `Arquivo salvo em Downloads:\n\n${fileName}`
      );
    }
  } catch (e) {
    console.log("ERRO PDF COMPLETO:", e);
    Alert.alert("Erro ao exportar PDF", e?.message || "Erro desconhecido");
  } finally {
    setGerando(false);
  }
}

  if (load && !(dadosFinancas || []).length) return <Load />;

  const listaEntradas = Object.entries(resumo.porTipoEntrada)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  const listaSaidas = Object.entries(resumo.porTipoSaida)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionTitle}>Periodo</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodosRow}
        >
          {PERIODOS.map((p) => {
            const ativo = periodoId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.periodoChip,
                  ativo && { backgroundColor: colors.principal },
                ]}
                onPress={() => setPeriodoId(p.id)}
              >
                <Text style={[styles.periodoText, ativo && { color: "#fff" }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {periodoId === "custom" && (
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
              <Text style={styles.dateLabel}>Ate</Text>
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

        <Text style={styles.periodoInfo}>{labelPeriodo}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entradas</Text>
            <Text style={[styles.summaryValue, { color: colors.principal }]}>
              R$ {formatoMoeda.format(resumo.entradas)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saidas</Text>
            <Text style={[styles.summaryValue, { color: colors.destaque }]}>
              R$ {formatoMoeda.format(resumo.saidas)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    resumo.saldo >= 0 ? colors.principal : colors.destaque,
                },
              ]}
            >
              R$ {formatoMoeda.format(resumo.saldo)}
            </Text>
          </View>
        </View>

        <Text style={styles.qtdText}>
          {resumo.quantidade} registro
          {resumo.quantidade !== 1 ? "s" : ""} no periodo
        </Text>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Entradas por tipo</Text>
          {listaEntradas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma entrada</Text>
          ) : (
            listaEntradas.map((item) => (
              <View key={item.tipo} style={styles.row}>
                <Text style={styles.rowLabel}>{item.tipo}</Text>
                <Text style={[styles.rowValue, { color: colors.principal }]}>
                  + R$ {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Saidas por tipo</Text>
          {listaSaidas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma saida</Text>
          ) : (
            listaSaidas.map((item) => (
              <View key={item.tipo} style={styles.row}>
                <Text style={styles.rowLabel}>{item.tipo}</Text>
                <Text style={[styles.rowValue, { color: colors.destaque }]}>
                  - R$ {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: colors.principal }]}
          onPress={exportarPDF}
          disabled={gerando}
        >
          <Text style={styles.pdfBtnText}>
            {gerando ? "Gerando PDF..." : "Exportar PDF"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#888",
    marginBottom: 10,
  },
  periodosRow: {
    gap: 8,
    paddingBottom: 4,
  },
  periodoChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 1,
  },
  periodoText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#444",
  },
  customRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  dateBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    elevation: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    color: "#888",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#222",
  },
  periodoInfo: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#777",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    color: "#777",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
  },
  qtdText: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#999",
    marginBottom: 16,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#333",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: "#444",
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  emptySection: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#999",
    paddingVertical: 8,
  },
  pdfBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  pdfBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
});
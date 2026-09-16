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
import { useNavigation, useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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

function calcularMes(mesIndex, ano) {
  return {
    inicio: new Date(ano, mesIndex, 1, 0, 0, 0, 0),
    fim: new Date(ano, mesIndex + 1, 0, 23, 59, 59, 999),
  };
}

export default function Relatorio() {
  const { dadosFinancas, load, HistoricoMovimentos, formatoMoeda } =
    useContext(AppContext);
  const { colors } = useTheme();
  const navigation = useNavigation();

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
    HistoricoMovimentos();
  }, []);

  const { inicio, fim } = useMemo(() => {
    if (modoFiltro === "mes") {
      return calcularMes(mesSelecionado, anoSelecionado);
    }
    return {
      inicio: inicioDoDia(dataDe),
      fim: fimDoDia(dataAte),
    };
  }, [modoFiltro, dataDe, dataAte, mesSelecionado, anoSelecionado]);

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
        item.valorRecebidoTotal || item.valorPagoTotal || item.valorTotal || 0;
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
    if (modoFiltro === "mes") {
      return `${MESES[mesSelecionado]} de ${anoSelecionado}`;
    }
    return `${inicio.toLocaleDateString("pt-BR")} até ${fim.toLocaleDateString("pt-BR")}`;
  }, [modoFiltro, mesSelecionado, anoSelecionado, inicio, fim]);

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
      }

      page.drawLine({
        start: { x: rightX - gap / 2, y: margin },
        end: { x: rightX - gap / 2, y: pageHeight - margin },
        thickness: 0.6,
        color: rgb(0.88, 0.88, 0.88),
      });

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

        const isDizimo =
          String(item.tipo || "").toLowerCase().includes("dizimo") ||
          String(item.tipo || "").toLowerCase().includes("dízimo");

        const desc = isDizimo
          ? "********"
          : item.descricao || item.tipo || "-";

        let origemTxt = "";
        if (!isEntrada) {
          if (item.origemPagamento === "caixinha") {
            origemTxt = ` [${item.caixinhaNome || "Caixinha"}]`;
          } else if (item.origemPagamento === "geral") {
            origemTxt = " [Caixa geral]";
          } else {
            const pagos = item.valoresPagos || [];
            const ultimo = pagos[pagos.length - 1];
            if (ultimo?.origemPagamento === "caixinha") {
              origemTxt = ` [${ultimo.caixinhaNome || "Caixinha"}]`;
            } else if (ultimo?.origemPagamento === "geral") {
              origemTxt = " [Caixa geral]";
            }
          }
        }

        const linha = `${dia} - ${desc}${origemTxt}`;
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
        { size: 8, color: rgb(0.5, 0.55, 0.55), lh: 10 }
      );

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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={exportarPDF}
          disabled={gerando}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          {gerando ? (
            <ActivityIndicator size="small" color={colors.principal} />
          ) : (
            <Ionicons name="receipt-outline" size={22} />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors, gerando, filtrados, resumo, labelPeriodo]);

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
        </View>

        <Text style={styles.sectionTitle}>Entradas por tipo</Text>
        <View style={styles.listCard}>
          {listaEntradas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma entrada no filtro</Text>
          ) : (
            listaEntradas.map((item, index) => (
              <View
                key={item.tipo}
                style={[
                  styles.itemRow,
                  index === listaEntradas.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}>
                  <Ionicons name="arrow-down-outline" size={16} color="#2E7D32" />
                </View>
                <Text style={styles.itemLabel}>{item.tipo}</Text>
                <Text style={[styles.itemValue, { color: "#2E7D32" }]}>
                  + {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Saídas por tipo</Text>
        <View style={styles.listCard}>
          {listaSaidas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma saída no filtro</Text>
          ) : (
            listaSaidas.map((item, index) => (
              <View
                key={item.tipo}
                style={[
                  styles.itemRow,
                  index === listaSaidas.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: "#FFEBEE" }]}>
                  <Ionicons name="arrow-up-outline" size={16} color="#C62828" />
                </View>
                <Text style={styles.itemLabel}>{item.tipo}</Text>
                <Text style={[styles.itemValue, { color: "#C62828" }]}>
                  − {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerBtn: {
    marginRight: 12,
    padding: 6,
  },
  balanceCard: {
    backgroundColor: "#1f2933",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa3ad",
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 30,
    fontFamily: "Roboto-Bold",
    color: "#fff",
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  balanceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  miniLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#8b949e",
    marginBottom: 3,
  },
  miniValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#e8eef4",
  },
  block: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
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
  customRow: {
    flexDirection: "row",
    gap: 10,
  },
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Roboto-Medium",
    color: "#222",
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 18,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  itemValue: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
  },
  emptySection: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    paddingVertical: 14,
    textAlign: "center",
  },
});
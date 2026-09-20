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
import { useAuth } from "../../context/AuthContext";
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

// Cores do app (suaves)
const C = {
  ink: rgb(0.12, 0.16, 0.2),       // #1f2933
  muted: rgb(0.55, 0.58, 0.62),    // cinza texto
  line: rgb(0.92, 0.93, 0.94),     // #ececec
  card: rgb(0.96, 0.96, 0.97),     // #f4f5f7
  green: rgb(0.18, 0.49, 0.2),     // entrada
  red: rgb(0.78, 0.16, 0.16),      // saída
  white: rgb(1, 1, 1),
};

export default function Relatorio() {
  const { dadosFinancas, load, HistoricoMovimentos, formatoMoeda } =
    useContext(AppContext);
  const { uid, authPronto } = useAuth();
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
    if (!authPronto || !uid) return;
    HistoricoMovimentos();
  }, [authPronto, uid]);

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
    return `${inicio.toLocaleDateString("pt-BR")} ate ${fim.toLocaleDateString("pt-BR")}`;
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
      const margin = 32;
      const colGap = 18;
      const leftW = 320;
      const rightX = margin + leftW + colGap;
      const rightW = pageWidth - rightX - margin;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let yL = pageHeight - margin;
      let yR = pageHeight - margin;

      const safe = (t) =>
        String(t ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const newPage = () => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yL = pageHeight - margin;
        yR = pageHeight - margin;
        drawDivider();
      };

      const drawDivider = () => {
        page.drawLine({
          start: { x: rightX - colGap / 2, y: margin },
          end: { x: rightX - colGap / 2, y: pageHeight - margin },
          thickness: 0.5,
          color: C.line,
        });
      };

      const needL = (h) => {
        if (yL - h < margin + 20) newPage();
      };
      const needR = (h) => {
        if (yR - h < margin + 20) newPage();
      };

      drawDivider();

      // ===== CABEÇALHO ESQUERDA =====
      page.drawText(safe("Relatorio Financeiro"), {
        x: margin,
        y: yL,
        size: 15,
        font: fontBold,
        color: C.ink,
      });
      yL -= 16;

      page.drawText(safe(labelPeriodo), {
        x: margin,
        y: yL,
        size: 9,
        font,
        color: C.muted,
      });
      yL -= 8;

      page.drawLine({
        start: { x: margin, y: yL },
        end: { x: margin + leftW, y: yL },
        thickness: 0.5,
        color: C.line,
      });
      yL -= 16;

      // Cards resumo
      const cardH = 40;
      const cardGap = 6;
      const cardW = (leftW - cardGap * 2) / 3;
      needL(cardH + 16);

      const cards = [
        { label: "Receitas", value: resumo.entradas, tone: C.green },
        { label: "Despesas", value: resumo.saidas, tone: C.red },
        { label: "Saldo", value: resumo.saldo, tone: C.ink },
      ];

      cards.forEach((c, i) => {
        const x = margin + i * (cardW + cardGap);
        page.drawRectangle({
          x,
          y: yL - cardH,
          width: cardW,
          height: cardH,
          color: C.card,
          borderColor: C.line,
          borderWidth: 0.5,
        });
        page.drawText(safe(c.label.toUpperCase()), {
          x: x + 8,
          y: yL - 14,
          size: 7,
          font,
          color: C.muted,
        });
        page.drawText(safe(`R$ ${formatoMoeda.format(c.value)}`), {
          x: x + 8,
          y: yL - 30,
          size: 9,
          font: fontBold,
          color: c.tone,
          maxWidth: cardW - 12,
        });
      });
      yL -= cardH + 18;

      // Seções por tipo
      const drawTipoSection = (titulo, lista, sinal, cor) => {
        if (!lista.length) return;
        needL(20);
        page.drawText(safe(titulo), {
          x: margin,
          y: yL,
          size: 11,
          font: fontBold,
          color: C.ink,
        });
        yL -= 14;

        lista.forEach(([tipo, total]) => {
          needL(14);
          page.drawText(safe(String(tipo)), {
            x: margin,
            y: yL,
            size: 9,
            font,
            color: C.ink,
            maxWidth: leftW * 0.55,
          });
          page.drawText(safe(`${sinal} R$ ${formatoMoeda.format(total)}`), {
            x: margin + leftW * 0.58,
            y: yL,
            size: 9,
            font: fontBold,
            color: cor,
            maxWidth: leftW * 0.42,
          });
          yL -= 13;
        });
        yL -= 10;
      };

      const entradas = Object.entries(resumo.porTipoEntrada).sort(
        (a, b) => b[1] - a[1]
      );
      const saidas = Object.entries(resumo.porTipoSaida).sort(
        (a, b) => b[1] - a[1]
      );

      drawTipoSection("Entradas por tipo", entradas, "+", C.green);
      drawTipoSection("Saidas por tipo", saidas, "-", C.red);

      // Rodapé esquerda
      needL(28);
      yL -= 4;
      page.drawLine({
        start: { x: margin, y: yL },
        end: { x: margin + leftW, y: yL },
        thickness: 0.5,
        color: C.line,
      });
      yL -= 12;
      page.drawText(
        safe(
          `Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`
        ),
        {
          x: margin,
          y: yL,
          size: 8,
          font,
          color: C.muted,
        }
      );
      yL -= 12;
      page.drawText(safe(`${resumo.quantidade} registro(s) no periodo`), {
        x: margin,
        y: yL,
        size: 8,
        font,
        color: C.muted,
      });

      // ===== COLUNA DIREITA: movimentações =====
      page.drawText(safe("Movimentacoes"), {
        x: rightX,
        y: yR,
        size: 12,
        font: fontBold,
        color: C.ink,
      });
      yR -= 8;
      page.drawLine({
        start: { x: rightX, y: yR },
        end: { x: rightX + rightW, y: yR },
        thickness: 0.5,
        color: C.line,
      });
      yR -= 14;

      const lista = [...filtrados].sort((a, b) => (a.data || 0) - (b.data || 0));

      lista.forEach((item) => {
        const isEntrada = item.tipoMovimento === "entrada";
        const valor =
          item.valorRecebidoTotal ||
          item.valorPagoTotal ||
          item.valorTotal ||
          0;

        const dataStr = item.data
          ? new Date(item.data).toLocaleDateString("pt-BR")
          : "--/--/----";

        const isDizimo = String(item.tipo || "")
          .toLowerCase()
          .includes("dizimo") ||
          String(item.tipo || "")
            .toLowerCase()
            .includes("dízimo");

        const desc = isDizimo
          ? "********"
          : item.descricao || item.tipo || "-";

        let origemTxt = "";
        if (!isEntrada) {
          if (item.origemPagamento === "caixinha") {
            origemTxt = ` · ${item.caixinhaNome || "Caixinha"}`;
          } else if (item.origemPagamento === "geral") {
            origemTxt = " · Caixa geral";
          } else {
            const pagos = item.valoresPagos || [];
            const ultimo = pagos[pagos.length - 1];
            if (ultimo?.origemPagamento === "caixinha") {
              origemTxt = ` · ${ultimo.caixinhaNome || "Caixinha"}`;
            } else if (ultimo?.origemPagamento === "geral") {
              origemTxt = " · Caixa geral";
            }
          }
        }

        needR(22);

        // data + tipo
        page.drawText(safe(`${dataStr}  ·  ${item.tipo || "-"}`), {
          x: rightX,
          y: yR,
          size: 7,
          font,
          color: C.muted,
          maxWidth: rightW,
        });
        yR -= 10;

        // descrição
        page.drawText(safe(`${desc}${origemTxt}`), {
          x: rightX,
          y: yR,
          size: 8,
          font,
          color: C.ink,
          maxWidth: rightW * 0.62,
        });

        // valor
        page.drawText(
          safe(`${isEntrada ? "+" : "-"} R$ ${formatoMoeda.format(valor)}`),
          {
            x: rightX + rightW * 0.64,
            y: yR,
            size: 8,
            font: fontBold,
            color: isEntrada ? C.green : C.red,
            maxWidth: rightW * 0.36,
          }
        );
        yR -= 8;

        page.drawLine({
          start: { x: rightX, y: yR },
          end: { x: rightX + rightW, y: yR },
          thickness: 0.4,
          color: C.line,
        });
        yR -= 8;
      });

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

  if ((!authPronto || load) && !(dadosFinancas || []).length) return <Load />;

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
              onValueChange={(e, selected) => {
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
              onValueChange={(e, selected) => {
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
    paddingBottom: 100,
  },
  headerBtn: {
    marginRight: 12,
    padding: 6,
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
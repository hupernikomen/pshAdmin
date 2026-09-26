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
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import Load from "../componentes/Load";
import { exportarRelatorioPDF } from "../utils/relatorioPdf";

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
    if (item.tipo === "Saldo inicial") return;
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
    quantidade: lista.filter((i) => i.tipo !== "Saldo inicial").length,
  };
}

/** Criação da igreja → agora; após 12 meses, últimos 12 (rolante) */
function montarJanelaMesesGrafico(createdAtTs) {
  const agora = new Date();
  const fimAno = agora.getFullYear();
  const fimMes = agora.getMonth();

  let iniAno = fimAno;
  let iniMes = fimMes;

  if (createdAtTs) {
    const criacao = new Date(Number(createdAtTs));
    if (!isNaN(criacao.getTime())) {
      iniAno = criacao.getFullYear();
      iniMes = criacao.getMonth();
    }
  }

  const totalMeses = (fimAno - iniAno) * 12 + (fimMes - iniMes) + 1;
  let startAno = iniAno;
  let startMes = iniMes;
  let qtd = Math.max(totalMeses, 1);

  if (totalMeses > 12) {
    qtd = 12;
    startMes = fimMes - 11;
    startAno = fimAno;
    while (startMes < 0) {
      startMes += 12;
      startAno -= 1;
    }
  }

  const pontos = [];
  let y = startAno;
  let m = startMes;
  for (let i = 0; i < qtd; i++) {
    pontos.push({ ano: y, mes: m, label: MESES_CURTO[m] });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return pontos;
}

function formatCompacto(v, formatoMoeda) {
  const n = Number(v) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return formatoMoeda.format(n);
}

/** Barras alinhadas à esquerda */
function ChartBarras({ dados, cor, formatoMoeda, altura = 140 }) {
  const max = Math.max(...dados.map((d) => d.value), 1);
  const barMaxH = altura - 36;
  const barSlot = Math.min(
    36,
    Math.max(24, Math.floor(300 / Math.max(dados.length, 1)))
  );

  return (
    <View style={[styles.chartBox, { height: altura + 8 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={dados.length > 8}
        contentContainerStyle={styles.barsRowStart}
      >
        {dados.map((d, i) => {
          const h = Math.max(4, (d.value / max) * barMaxH);
          return (
            <View
              key={`${d.label}-${i}`}
              style={[styles.barColFixed, { width: barSlot }]}
            >
              <Text style={styles.barValue} numberOfLines={1}>
                {d.value > 0 ? formatCompacto(d.value, formatoMoeda) : "—"}
              </Text>
              <View style={[styles.barTrack, { height: barMaxH }]}>
                <View
                  style={[styles.barFill, { height: h, backgroundColor: cor }]}
                />
              </View>
              <Text style={styles.barLabel}>{d.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Linhas a partir da esquerda (1 ponto no início) */
function ChartLinhas({ dados, corReceita, corDespesa, altura = 150 }) {
  const max = Math.max(
    ...dados.flatMap((d) => [d.receita, d.despesa]),
    1
  );
  const plotH = altura - 28;
  const n = dados.length;
  const plotW = Math.max(n * 28, 120);
  const stepX = n <= 1 ? 0 : plotW / (n - 1);

  const pts = (key) =>
    dados.map((d, i) => ({
      x: i * stepX,
      y: plotH - (Number(d[key]) / max) * plotH,
    }));

  const rec = pts("receita");
  const des = pts("despesa");

  return (
    <View style={[styles.chartBox, { height: altura + 24 }]}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: corReceita }]} />
          <Text style={styles.legendText}>Receitas</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: corDespesa }]} />
          <Text style={styles.legendText}>Despesas</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={n > 8}
        contentContainerStyle={{ minWidth: plotW + 16 }}
      >
        <View style={{ height: plotH, width: plotW, marginTop: 4 }}>
          <View style={[styles.axisBase, { top: plotH - 1 }]} />

          {rec.slice(0, -1).map((p, i) => {
            const n2 = rec[i + 1];
            const dx = n2.x - p.x;
            const dy = n2.y - p.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <View
                key={`r-${i}`}
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  width: len,
                  height: 2,
                  backgroundColor: corReceita,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                }}
              />
            );
          })}
          {des.slice(0, -1).map((p, i) => {
            const n2 = des[i + 1];
            const dx = n2.x - p.x;
            const dy = n2.y - p.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <View
                key={`d-${i}`}
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  width: len,
                  height: 2,
                  backgroundColor: corDespesa,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                }}
              />
            );
          })}

          {rec.map((p, i) => (
            <View
              key={`rp-${i}`}
              style={[
                styles.lineDot,
                {
                  left: p.x - 3,
                  top: p.y - 3,
                  backgroundColor: corReceita,
                },
              ]}
            />
          ))}
          {des.map((p, i) => (
            <View
              key={`dp-${i}`}
              style={[
                styles.lineDot,
                {
                  left: p.x - 3,
                  top: p.y - 3,
                  backgroundColor: corDespesa,
                },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.lineLabels, { minWidth: plotW + 16 }]}
      >
        {dados.map((d, i) => (
          <Text
            key={i}
            style={[styles.barLabel, { width: n <= 1 ? 40 : stepX || 28 }]}
          >
            {d.label}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
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
        if (item.tipo === "Saldo inicial") return false;
        const ts = item.data || item.createdAt || item.reg;
        if (!ts) return false;
        return ts >= ini && ts <= fim;
      });
    }
    return lista.filter((item) => {
      if (item.tipo === "Saldo inicial") return false;
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

  const historicoPeriodo = useMemo(
    () =>
      [...filtrados].sort(
        (a, b) => (a.data || a.reg || 0) - (b.data || b.reg || 0)
      ),
    [filtrados]
  );

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
    const janela = montarJanelaMesesGrafico(igrejaAtiva?.createdAt);
    return janela.map(({ ano, mes, label }) => {
      let receita = 0;
      let despesa = 0;
      let dizimo = 0;
      lista.forEach((item) => {
        if (item.tipo === "Saldo inicial") return;
        const ts = item.data || item.createdAt || item.reg;
        if (!ts) return;
        const d = new Date(ts);
        if (d.getFullYear() !== ano || d.getMonth() !== mes) return;
        if (item.tipoMovimento === "entrada") {
          const v = valorEntrada(item);
          receita += v;
          if (isDizimo(item)) dizimo += v;
        } else if (item.tipoMovimento === "saida") {
          despesa += valorSaida(item);
        }
      });
      return {
        label,
        receita: arred(receita),
        despesa: arred(despesa),
        dizimo: arred(dizimo),
      };
    });
  }, [dadosFinancas, igrejaAtiva?.createdAt]);

  const labelJanelaGrafico = useMemo(() => {
    if (!seriesGraficos.length) return "";
    if (seriesGraficos.length === 1) return seriesGraficos[0].label;
    return `${seriesGraficos[0].label} – ${
      seriesGraficos[seriesGraficos.length - 1].label
    }`;
  }, [seriesGraficos]);

  const labelPeriodo = useMemo(() => {
    if (modoFiltro === "periodo") {
      return `${inicioDoDia(dataDe).toLocaleDateString("pt-BR")} até ${fimDoDia(
        dataAte
      ).toLocaleDateString("pt-BR")}`;
    }
    return `${MESES[mesSelecionado]} de ${anoSelecionado}`;
  }, [modoFiltro, dataDe, dataAte, mesSelecionado, anoSelecionado]);

  const corPrincipal = colors.principal || "#65C556";
  const corDespesa = "#C62828";

  async function onExportar() {
    if (filtrados.length === 0) {
      Alert.alert("Aviso", "Não há registros neste período.");
      return;
    }
    setGerando(true);
    try {
      await exportarRelatorioPDF({
        nomeIgreja: igrejaAtiva?.nome || "Tesouraria",
        labelPeriodo,
        labelJanelaGrafico,
        resumo,
        projecao,
        seriesGraficos,
        historicoPeriodo,
        formatoMoeda,
      });
    } catch (e) {
      console.log("ERRO PDF:", e);
      Alert.alert("Erro ao exportar PDF", e?.message || "Erro desconhecido");
    } finally {
      setGerando(false);
    }
  }

  if ((!authPronto || load) && !(dadosFinancas || []).length) return <Load />;

  const dadosBarrasDizimo = seriesGraficos.map((s) => ({
    label: s.label,
    value: s.dizimo,
  }));

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
              { backgroundColor: corPrincipal },
              gerando && { opacity: 0.75 },
            ]}
            onPress={onExportar}
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

        <View style={styles.block}>
          <Text style={styles.previewTitle}>Dízimos</Text>
          <Text style={styles.previewSub}>{labelJanelaGrafico}</Text>
          <ChartBarras
            dados={dadosBarrasDizimo}
            cor={corPrincipal}
            formatoMoeda={formatoMoeda}
            altura={150}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.previewTitle}>Receitas e despesas</Text>
          <Text style={styles.previewSub}>{labelJanelaGrafico}</Text>
          <ChartLinhas
            dados={seriesGraficos}
            corReceita={corPrincipal}
            corDespesa={corDespesa}
            altura={150}
          />
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
    paddingHorizontal: 14,
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
  previewTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  previewSub: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  chartBox: { width: "100%" },
  barsRowStart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingRight: 8,
  },
  barColFixed: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  barValue: {
    fontSize: 9,
    fontFamily: "Roboto-Medium",
    color: "#555",
    marginBottom: 4,
  },
  barTrack: {
    width: "70%",
    maxWidth: 28,
    justifyContent: "flex-end",
    backgroundColor: "#f4f5f7",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 6,
    minHeight: 3,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "Roboto-Regular",
    color: "#888",
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#666",
  },
  axisBase: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ececec",
  },
  lineDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lineLabels: {
    flexDirection: "row",
    marginTop: 8,
  },
});
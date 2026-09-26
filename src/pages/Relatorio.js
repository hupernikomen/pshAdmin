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
import GrafBarras from "../componentes/GrafBarras";
import GrafLinhas from "../componentes/GrafLinhas";
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

function tsItem(item) {
  return Number(item?.data || item?.createdAt || item?.reg || 0) || 0;
}

function hojeFimTs() {
  return fimDoDia(new Date()).getTime();
}

function itemNoFuturo(item) {
  const ts = tsItem(item);
  return ts > hojeFimTs();
}

function seedSaldoInicial(lista, igreja) {
  const item = (lista || []).find((i) => i.tipo === "Saldo inicial");
  if (item) {
    return arred(
      Number(item.valorTotal) || Number(item.valorRecebidoTotal) || 0
    );
  }
  return arred(Number(igreja?.saldoInicial) || 0);
}

/** Só o que já aconteceu (data até hoje) dentro do intervalo */
function realizadoNoIntervalo(lista, iniTs, fimTs) {
  const teto = Math.min(fimTs, hojeFimTs());
  let entradas = 0;
  let saidas = 0;
  let dizimos = 0;
  const porTipoEntrada = {};
  const porTipoSaida = {};
  let quantidade = 0;

  (lista || []).forEach((item) => {
    if (item.tipo === "Saldo inicial") return;
    const ts = tsItem(item);
    if (!ts || ts < iniTs || ts > teto) return;

    quantidade += 1;
    const tipo = item.tipo || "Outros";

    if (item.tipoMovimento === "entrada") {
      const v = valorEntrada(item);
      entradas += v;
      porTipoEntrada[tipo] = (porTipoEntrada[tipo] || 0) + v;
      if (isDizimo(item)) dizimos += v;
      return;
    }

    if (item.tipoMovimento === "saida") {
      const v = valorSaida(item);
      saidas += v;
      porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
    }
  });

  return {
    entradas: arred(entradas),
    saidas: arred(saidas),
    dizimos: arred(dizimos),
    porTipoEntrada,
    porTipoSaida,
    quantidade,
  };
}

/** Saldo fechado até ateTs: inicial + receitas − despesas, mês a mês */
function acumuladoAte(lista, seed, ateTs) {
  const mov = realizadoNoIntervalo(lista, 0, ateTs);
  return arred(seed + mov.entradas - mov.saidas);
}

function valorAReceberItem(item) {
  if (item.tipoMovimento !== "entrada") return 0;
  if (item.tipo === "Saldo inicial") return 0;

  const total = Number(item.valorTotal) || 0;
  const recebido = Number(item.valorRecebidoTotal) || 0;
  const falta = arred(total - recebido);
  const futuro = itemNoFuturo(item);

  if (futuro) return falta > 0 ? falta : arred(total || recebido);
  if (item.status === "quitada") return 0;
  return falta > 0 ? falta : 0;
}

function valorAPagarItem(item) {
  if (item.tipoMovimento !== "saida") return 0;

  const hoje = hojeFimTs();
  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];

  if (parcelas.length > 0) {
    return arred(
      parcelas.reduce((acc, p) => {
        const pts = Number(p.data || p.vencimento || 0) || 0;
        const aberta = p.status === "aberta" || !p.status;
        const futura = pts > hoje;
        if (aberta || futura) return acc + (Number(p.valor) || 0);
        return acc;
      }, 0)
    );
  }

  const total = Number(item.valorTotal) || 0;
  const pago = Number(item.valorPagoTotal) || 0;
  const falta = arred(total - pago);
  const futuro = itemNoFuturo(item);

  if (futuro) return falta > 0 ? falta : arred(total || pago);
  if (item.status === "quitada") return 0;
  return falta > 0 ? falta : 0;
}

function pontoOuNulo(isFuturo, valor) {
  const n = arred(valor);
  if (isFuturo && n <= 0) return null;
  return n;
}

function montarJanelaMesesGrafico() {
  const TOTAL = 12;
  const FUTUROS = 3;
  const PASSADOS = TOTAL - 1 - FUTUROS;

  const agora = new Date();
  let y = agora.getFullYear();
  let m = agora.getMonth() - PASSADOS;
  while (m < 0) {
    m += 12;
    y -= 1;
  }

  const pontos = [];
  for (let i = 0; i < TOTAL; i++) {
    pontos.push({
      ano: y,
      mes: m,
      label: MESES_CURTO[m],
      isAtual: i === PASSADOS,
      isFuturo: i > PASSADOS,
      isPassado: i < PASSADOS,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return pontos;
}

export default function Relatorio() {
  const {
    dadosFinancas,
    load,
    HistoricoMovimentos,
    formatoMoeda,
    igrejaAtiva,
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

  const intervalo = useMemo(() => {
    if (modoFiltro === "periodo") {
      return {
        ini: inicioDoDia(dataDe).getTime(),
        fim: fimDoDia(dataAte).getTime(),
      };
    }
    return {
      ini: new Date(anoSelecionado, mesSelecionado, 1, 0, 0, 0, 0).getTime(),
      fim: new Date(
        anoSelecionado,
        mesSelecionado + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime(),
    };
  }, [modoFiltro, dataDe, dataAte, mesSelecionado, anoSelecionado]);

  const filtrados = useMemo(() => {
    const lista = dadosFinancas || [];
    return lista.filter((item) => {
      if (item.tipo === "Saldo inicial") return false;
      const ts = tsItem(item);
      if (!ts) return false;
      return ts >= intervalo.ini && ts <= intervalo.fim;
    });
  }, [dadosFinancas, intervalo]);

  const historicoPeriodo = useMemo(
    () =>
      [...filtrados].sort(
        (a, b) => (a.data || a.reg || 0) - (b.data || b.reg || 0)
      ),
    [filtrados]
  );

  const resumo = useMemo(() => {
    const lista = dadosFinancas || [];
    const seed = seedSaldoInicial(lista, igrejaAtiva);
    const saldoAnterior = acumuladoAte(lista, seed, intervalo.ini - 1);
    const mov = realizadoNoIntervalo(lista, intervalo.ini, intervalo.fim);
    const saldoAtual = arred(saldoAnterior + mov.entradas - mov.saidas);

    return {
      ...mov,
      saldoAnterior,
      saldoAtual,
      saldo: arred(mov.entradas - mov.saidas),
    };
  }, [dadosFinancas, igrejaAtiva, intervalo]);

  const projecao = useMemo(() => {
    const lista = dadosFinancas || [];
    let aReceber = 0;
    let aPagar = 0;

    lista.forEach((i) => {
      aReceber += valorAReceberItem(i);
      aPagar += valorAPagarItem(i);
    });

    aReceber = arred(aReceber);
    aPagar = arred(aPagar);

    return {
      aReceber,
      aPagar,
      saldoProjetado: arred(resumo.saldoAtual + aReceber - aPagar),
    };
  }, [dadosFinancas, resumo.saldoAtual]);

  const seriesGraficos = useMemo(() => {
    const lista = dadosFinancas || [];
    const janela = montarJanelaMesesGrafico();

    return janela.map((slot) => {
      let receita = 0;
      let despesa = 0;
      let dizimo = 0;

      lista.forEach((item) => {
        if (item.tipo === "Saldo inicial") return;

        if (item.tipoMovimento === "entrada") {
          const ts = tsItem(item);
          if (!ts) return;
          const d = new Date(ts);
          if (d.getFullYear() !== slot.ano || d.getMonth() !== slot.mes) return;

          const v = slot.isFuturo
            ? Number(item.valorTotal) || valorEntrada(item) || 0
            : valorEntrada(item);
          receita += v;
          if (isDizimo(item)) dizimo += v;
          return;
        }

        if (item.tipoMovimento !== "saida") return;

        const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
        if (parcelas.length > 0) {
          parcelas.forEach((p) => {
            const pts = Number(p.data || p.vencimento || 0) || 0;
            if (!pts) return;
            const d = new Date(pts);
            if (d.getFullYear() !== slot.ano || d.getMonth() !== slot.mes)
              return;
            const val = Number(p.valor) || 0;
            if (slot.isFuturo) {
              if (p.status === "aberta" || !p.status) despesa += val;
            } else {
              despesa += val;
            }
          });
          return;
        }

        const ts = tsItem(item);
        if (!ts) return;
        const d = new Date(ts);
        if (d.getFullYear() !== slot.ano || d.getMonth() !== slot.mes) return;

        if (slot.isFuturo) {
          despesa += Number(item.valorTotal) || valorSaida(item) || 0;
        } else {
          despesa += valorSaida(item);
        }
      });

      return {
        ...slot,
        receita: pontoOuNulo(slot.isFuturo, receita),
        despesa: pontoOuNulo(slot.isFuturo, despesa),
        dizimo: pontoOuNulo(slot.isFuturo, dizimo),
      };
    });
  }, [dadosFinancas]);

  const dadosBarrasDizimo = useMemo(
    () =>
      seriesGraficos.map((s) => ({
        label: s.label,
        value: s.dizimo,
        isAtual: s.isAtual,
      })),
    [seriesGraficos]
  );

  const labelJanelaGrafico = useMemo(() => {
    if (!seriesGraficos.length) return "";
    const a = seriesGraficos[0];
    const b = seriesGraficos[seriesGraficos.length - 1];
    const centro = seriesGraficos.find((s) => s.isAtual);
    return `${a.label} – ${b.label}${
      centro ? `  ·  centro: ${centro.label}` : ""
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
          <Text style={styles.previewSub}>Evolução das Coletas</Text>
          <GrafBarras
            dados={dadosBarrasDizimo}
            cor={corPrincipal}
            altura={150}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.previewTitle}>Receitas e despesas</Text>
          <GrafLinhas
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
});
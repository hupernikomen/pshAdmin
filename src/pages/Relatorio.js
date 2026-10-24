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
import { montarComentarioRelatorio } from "../utils/comentarioRelatorioOffline";

import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  valorAPagarItem,
} from "../utils/financeiro";

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

function isDizimo(item) {
  const t = String(item.tipo || "").toLowerCase();
  return t.includes("dizimo") || t.includes("dízimo");
}

function tsItem(item) {
  return dataDoItem(item);
}

function hojeFimTs() {
  return fimDoDiaTs();
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
    const tipo = item.tipo || "Outros";

    if (item.tipoMovimento === "entrada") {
      const recebidos = Array.isArray(item.valoresRecebidos)
        ? item.valoresRecebidos
        : [];

      if (recebidos.length > 0) {
        recebidos.forEach((r) => {
          const ts = Number(r.data || 0);
          if (!ts || ts < iniTs || ts > teto) return;
          const v = Number(r.valor) || 0;
          entradas += v;
          porTipoEntrada[tipo] = (porTipoEntrada[tipo] || 0) + v;
          if (isDizimo(item)) dizimos += v;
          quantidade += 1;
        });
        return;
      }

      const ts = tsItem(item);
      if (!ts || ts < iniTs || ts > teto) return;
      const v = Number(item.valorRecebidoTotal) || 0;
      entradas += v;
      porTipoEntrada[tipo] = (porTipoEntrada[tipo] || 0) + v;
      if (isDizimo(item)) dizimos += v;
      quantidade += 1;
      return;
    }

    if (item.tipoMovimento !== "saida") return;

    const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
    if (pagos.length > 0) {
      pagos.forEach((p) => {
        const ts = Number(p.data || 0);
        if (!ts || ts < iniTs || ts > teto) return;
        const v = Number(p.valor) || 0;
        saidas += v;
        porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
        quantidade += 1;
      });
      return;
    }

    const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
    const pagas = parcelas.filter(
      (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
    );
    if (pagas.length > 0) {
      pagas.forEach((p) => {
        const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
        if (!ts || ts < iniTs || ts > teto) return;
        const v = Number(p.valor) || 0;
        saidas += v;
        porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
        quantidade += 1;
      });
      return;
    }

    const ts = tsItem(item);
    if (!ts || ts < iniTs || ts > teto) return;
    const v = Number(item.valorPagoTotal) || 0;
    saidas += v;
    porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
    quantidade += 1;
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

function acumuladoAte(lista, seed, ateTs) {
  if (ateTs < 0) return arred(seed);
  const mov = realizadoNoIntervalo(lista, 0, ateTs);
  return arred(seed + mov.entradas - mov.saidas);
}

function montarHistoricoPeriodo(lista, iniTs, fimTs) {
  const teto = Math.min(fimTs, hojeFimTs());
  const rows = [];

  (lista || []).forEach((item) => {
    if (item.tipo === "Saldo inicial") return;
    const baseDesc = item.descricao || item.tipo || "Movimento";
    const tipo = item.tipo || "Outros";

    if (item.tipoMovimento === "entrada") {
      const recebidos = Array.isArray(item.valoresRecebidos)
        ? item.valoresRecebidos
        : [];
      if (recebidos.length > 0) {
        recebidos.forEach((r, idx) => {
          const ts = Number(r.data || 0);
          if (!ts || ts < iniTs || ts > teto) return;
          rows.push({
            id: `${item.id}_r_${idx}`,
            tipoMovimento: "entrada",
            tipo,
            descricao: baseDesc,
            data: ts,
            valorRecebidoTotal: Number(r.valor) || 0,
            valorPagoTotal: 0,
          });
        });
        return;
      }
      const ts = tsItem(item);
      if (!ts || ts < iniTs || ts > teto) return;
      rows.push({
        id: item.id,
        tipoMovimento: "entrada",
        tipo,
        descricao: baseDesc,
        data: ts,
        valorRecebidoTotal: Number(item.valorRecebidoTotal) || 0,
        valorPagoTotal: 0,
      });
      return;
    }

    if (item.tipoMovimento !== "saida") return;

    const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
    if (pagos.length > 0) {
      pagos.forEach((p, idx) => {
        const ts = Number(p.data || 0);
        if (!ts || ts < iniTs || ts > teto) return;
        const parc =
          p.parcelaNumero != null ? ` (${p.parcelaNumero}ª parc.)` : "";
        rows.push({
          id: `${item.id}_p_${idx}`,
          tipoMovimento: "saida",
          tipo,
          descricao: `${baseDesc}${parc}`,
          data: ts,
          valorRecebidoTotal: 0,
          valorPagoTotal: Number(p.valor) || 0,
        });
      });
      return;
    }

    const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
    const pagas = parcelas.filter(
      (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
    );
    if (pagas.length > 0) {
      pagas.forEach((p, idx) => {
        const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
        if (!ts || ts < iniTs || ts > teto) return;
        rows.push({
          id: `${item.id}_parc_${p.numero || idx}`,
          tipoMovimento: "saida",
          tipo,
          descricao: `${baseDesc} (${p.numero || "?"}ª parc.)`,
          data: ts,
          valorRecebidoTotal: 0,
          valorPagoTotal: Number(p.valor) || 0,
        });
      });
      return;
    }

    const ts = tsItem(item);
    if (!ts || ts < iniTs || ts > teto) return;
    rows.push({
      id: item.id,
      tipoMovimento: "saida",
      tipo,
      descricao: baseDesc,
      data: ts,
      valorRecebidoTotal: 0,
      valorPagoTotal: Number(item.valorPagoTotal) || 0,
    });
  });

  return rows.sort((a, b) => (a.data || 0) - (b.data || 0));
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

function noMes(ts, ano, mes) {
  if (!ts) return false;
  const d = new Date(ts);
  return d.getFullYear() === ano && d.getMonth() === mes;
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
  const { colors, dark } = useTheme();

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

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const border = colors.border || (dark ? "#333" : "#ececec");
  const corDespesa = dark ? "#E57373" : "#C62828";

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

  const historicoPeriodo = useMemo(
    () =>
      montarHistoricoPeriodo(
        dadosFinancas || [],
        intervalo.ini,
        intervalo.fim
      ),
    [dadosFinancas, intervalo]
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
    const limite = hojeFimTs();

    return janela.map((slot) => {
      let receita = 0;
      let despesa = 0;
      let dizimo = 0;

      lista.forEach((item) => {
        if (item.tipo === "Saldo inicial") return;

        if (item.tipoMovimento === "entrada") {
          const recebidos = Array.isArray(item.valoresRecebidos)
            ? item.valoresRecebidos
            : [];

          if (slot.isFuturo) {
            const ts = tsItem(item);
            if (!ts || !noMes(ts, slot.ano, slot.mes)) return;
            if (ts <= limite) return;
            const v =
              Number(item.valorTotal) ||
              Number(item.valorRecebidoTotal) ||
              0;
            receita += v;
            if (isDizimo(item)) dizimo += v;
            return;
          }

          if (recebidos.length > 0) {
            recebidos.forEach((r) => {
              const ts = Number(r.data || 0);
              if (!ts || ts > limite) return;
              if (!noMes(ts, slot.ano, slot.mes)) return;
              const v = Number(r.valor) || 0;
              receita += v;
              if (isDizimo(item)) dizimo += v;
            });
            return;
          }

          const ts = tsItem(item);
          if (!ts || ts > limite) return;
          if (!noMes(ts, slot.ano, slot.mes)) return;
          const v = Number(item.valorRecebidoTotal) || 0;
          receita += v;
          if (isDizimo(item)) dizimo += v;
          return;
        }

        if (item.tipoMovimento !== "saida") return;

        const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
        const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];

        if (slot.isFuturo) {
          if (parcelas.length > 0) {
            parcelas.forEach((p) => {
              if (p.status !== "aberta" && p.status) return;
              const pts = Number(p.vencimento || p.data || 0) || 0;
              if (!pts || !noMes(pts, slot.ano, slot.mes)) return;
              despesa += Number(p.valor) || 0;
            });
            return;
          }
          const ts = tsItem(item);
          if (!ts || ts <= limite) return;
          if (!noMes(ts, slot.ano, slot.mes)) return;
          despesa +=
            Number(item.valorTotal) || Number(item.valorPagoTotal) || 0;
          return;
        }

        if (pagos.length > 0) {
          pagos.forEach((p) => {
            const ts = Number(p.data || 0);
            if (!ts || ts > limite) return;
            if (!noMes(ts, slot.ano, slot.mes)) return;
            despesa += Number(p.valor) || 0;
          });
          return;
        }

        if (parcelas.length > 0) {
          parcelas.forEach((p) => {
            if (p.status === "aberta" || !p.status) return;
            const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
            if (!ts || ts > limite) return;
            if (!noMes(ts, slot.ano, slot.mes)) return;
            despesa += Number(p.valor) || 0;
          });
          return;
        }

        const ts = tsItem(item);
        if (!ts || ts > limite) return;
        if (!noMes(ts, slot.ano, slot.mes)) return;
        despesa += Number(item.valorPagoTotal) || 0;
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

  async function onExportar() {
    setGerando(true);
    try {
      const comentario = montarComentarioRelatorio({
        labelPeriodo,
        resumo,
        projecao,
        formatoMoeda,
      });

      await exportarRelatorioPDF({
        nomeIgreja: igrejaAtiva?.nome || "Tesouraria",
        labelPeriodo,
        labelJanelaGrafico,
        resumo,
        projecao,
        seriesGraficos,
        historicoPeriodo,
        formatoMoeda,
        comentario,
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
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.block, { backgroundColor: card }]}>
          <View style={[styles.segment, { backgroundColor: surface }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modoFiltro === "mes" && { backgroundColor: principal },
              ]}
              onPress={() => setModoFiltro("mes")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: muted },
                  modoFiltro === "mes" && { color: "#fff" },
                ]}
              >
                Por mês
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modoFiltro === "periodo" && { backgroundColor: principal },
              ]}
              onPress={() => setModoFiltro("periodo")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: muted },
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
                  style={[styles.anoBtn, { backgroundColor: surface }]}
                  onPress={() => setAnoSelecionado((a) => a - 1)}
                >
                  <Ionicons name="chevron-back" size={18} color={text} />
                </TouchableOpacity>
                <Text style={[styles.anoText, { color: text }]}>
                  {anoSelecionado}
                </Text>
                <TouchableOpacity
                  style={[styles.anoBtn, { backgroundColor: surface }]}
                  onPress={() => setAnoSelecionado((a) => a + 1)}
                >
                  <Ionicons name="chevron-forward" size={18} color={text} />
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
                        { backgroundColor: surface },
                        ativo && { backgroundColor: principal },
                      ]}
                      onPress={() => setMesSelecionado(index)}
                    >
                      <Text
                        style={[
                          styles.mesText,
                          { color: text },
                          ativo && { color: "#fff" },
                        ]}
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
                style={[styles.dateBox, { backgroundColor: surface }]}
                onPress={() => setShowDe(true)}
              >
                <Text style={[styles.dateLabel, { color: muted }]}>De</Text>
                <Text style={[styles.dateValue, { color: text }]}>
                  {dataDe.toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateBox, { backgroundColor: surface }]}
                onPress={() => setShowAte(true)}
              >
                <Text style={[styles.dateLabel, { color: muted }]}>Até</Text>
                <Text style={[styles.dateValue, { color: text }]}>
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

          <View style={[styles.filtroAtivo, { borderTopColor: border }]}>
            <Ionicons name="calendar-outline" size={14} color={muted} />
            <Text style={[styles.filtroAtivoText, { color: muted }]}>
              {labelPeriodo}
            </Text>
            <Text style={[styles.filtroQtd, { color: muted }]}>
              {resumo.quantidade} reg.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pdfBtn,
              { backgroundColor: principal },
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

        <View style={[styles.block, { backgroundColor: card }]}>
          <Text style={[styles.previewTitle, { color: text }]}>Dízimos</Text>
          <Text style={[styles.previewSub, { color: muted }]}>
            Evolução das Coletas
          </Text>
          <GrafBarras
            dados={dadosBarrasDizimo}
            cor={principal}
            altura={150}
          />
        </View>

        <View style={[styles.block, { backgroundColor: card }]}>
          <Text style={[styles.previewTitle, { color: text }]}>
            Receitas e despesas
          </Text>
          <GrafLinhas
            dados={seriesGraficos}
            corReceita={principal}
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
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  segment: {
    flexDirection: "row",
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
    alignItems: "center",
    justifyContent: "center",
  },
  anoText: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
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
  },
  mesText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
  },
  customRow: { flexDirection: "row", gap: 10 },
  dateBox: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  filtroAtivo: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filtroAtivoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },
  filtroQtd: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
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
  },
  previewSub: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
  },
});
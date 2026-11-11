import { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import Load from "../componentes/Load";
import SeletorMesAno from "../componentes/SeletorMesAno";
import { exportarRelatorioPDF } from "../utils/relatorioPdf";
import { montarComentarioRelatorio } from "../utils/comentarioRelatorioOffline";
import { verificarStatusAssinatura } from "../utils/assinatura";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberAte,
  valorAPagarAte,
} from "../utils/financeiro";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

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

function nomeMinisterio(item) {
  const m = String(item?.ministerio || "").trim();
  return m || "Sem ministério";
}

function realizadoNoIntervalo(lista, iniTs, fimTs) {
  const teto = Math.min(fimTs, hojeFimTs());
  let entradas = 0;
  let saidas = 0;
  let dizimos = 0;
  const porTipoEntrada = {};
  const porTipoSaida = {};
  const porMinisterioSaida = {};
  let quantidade = 0;

  function addSaida(item, tipo, v) {
    saidas += v;
    porTipoSaida[tipo] = (porTipoSaida[tipo] || 0) + v;
    const min = nomeMinisterio(item);
    porMinisterioSaida[min] = (porMinisterioSaida[min] || 0) + v;
    quantidade += 1;
  }

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
        addSaida(item, tipo, v);
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
        addSaida(item, tipo, v);
      });
      return;
    }

    const ts = tsItem(item);
    if (!ts || ts < iniTs || ts > teto) return;
    const v = Number(item.valorPagoTotal) || 0;
    addSaida(item, tipo, v);
  });

  return {
    entradas: arred(entradas),
    saidas: arred(saidas),
    dizimos: arred(dizimos),
    porTipoEntrada,
    porTipoSaida,
    porMinisterioSaida,
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

export default function Relatorio({ navigation }) {
  const {
    dadosFinancas,
    financasProntas,
    formatoMoeda,
    igrejaAtiva,
    ocultarNomesDoadores,
  } = useContext(AppContext);
  const { showAlert } = useAppAlert();
  const { user, authPronto } = useAuth();
  const { colors, dark } = useTheme();

  const agora = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(agora.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(agora.getFullYear());
  const [gerando, setGerando] = useState(false);

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const border = colors.border || (dark ? "#333" : "#ececec");

  // Verifica se a assinatura está ativa
  const statusAssinatura = verificarStatusAssinatura(igrejaAtiva);

  const intervalo = useMemo(() => {
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
  }, [mesSelecionado, anoSelecionado]);

  const historicoPeriodo = useMemo(
    () =>
      montarHistoricoPeriodo(dadosFinancas || [], intervalo.ini, intervalo.fim),
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
    const fim = intervalo.fim;
    let aReceber = 0;
    let aPagar = 0;
    lista.forEach((i) => {
      aReceber += valorAReceberAte(i, fim);
      aPagar += valorAPagarAte(i, fim);
    });
    aReceber = arred(aReceber);
    aPagar = arred(aPagar);
    return {
      aReceber,
      aPagar,
      saldoProjetado: arred(resumo.saldoAtual + aReceber - aPagar),
    };
  }, [dadosFinancas, resumo.saldoAtual, intervalo.fim]);

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
              Number(item.valorTotal) || Number(item.valorRecebidoTotal) || 0;
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
          if (isDizimo(item)) dizimos += v;
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
          despesa += Number(item.valorTotal) || Number(item.valorPagoTotal) || 0;
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
    return `${MESES[mesSelecionado]} de ${anoSelecionado}`;
  }, [mesSelecionado, anoSelecionado]);

  async function onExportar() {
    if (!statusAssinatura.isPremium) {
      navigation.navigate("Paywall");
      return;
    }

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
        dadosFinancas,
        formatoMoeda,
        comentario,
        nomeTesoureiro: user?.displayName || user?.email || "Tesoureiro",
        ocultarNomesDoadores: ocultarNomesDoadores !== false,
      });
    } catch (e) {
      console.log("ERRO PDF:", e);
      showAlert({
        title: "Erro ao exportar PDF",
        message: e?.message || "Erro desconhecido",
      });
    } finally {
      setGerando(false);
    }
  }

  if (!authPronto) return <Load />;
  if (!financasProntas && !(dadosFinancas || []).length) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.block, { backgroundColor: card }]}>
          <SeletorMesAno
            mes={mesSelecionado}
            ano={anoSelecionado}
            onChangeMes={setMesSelecionado}
            onChangeAno={setAnoSelecionado}
          />

          <View style={[styles.filtroAtivo, { borderTopColor: border }]}>
            <Ionicons name="calendar-outline" size={14} color={muted} />
            <Text style={[styles.filtroAtivoText, { color: muted }]}>
              {labelPeriodo}
            </Text>
            <Text style={[styles.filtroQtd, { color: muted }]}>
              {resumo.quantidade} reg.
            </Text>
          </View>

          {/* Botão original de Gerar Relatório */}
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

          {/* Timer sutil abaixo do botão caso o usuário esteja no plano Premium */}
          {statusAssinatura.isPremium && (
            <Text style={styles.textoTimer}>{statusAssinatura.tempoRestanteTexto}</Text>
          )}
        </View>

        {/* Texto chamativo posicionado FORA do bloco de cima, logo abaixo de tudo */}
        <View style={styles.containerChamativo}>
          <Ionicons name="sparkles-outline" size={18} color={'#FFB74D'} />
          <Text style={[styles.textoChamativo, { color: muted }]}>
            Gere relatórios incríveis e completos com os principais dados financeiros registrados para a sua igreja.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 100,
    paddingHorizontal: 14,
  },
  block: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
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
  textoTimer: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#64748b",
    textAlign: "center",
    marginTop: 10,
  },
  containerChamativo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  textoChamativo: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    lineHeight: 18,
  },
});
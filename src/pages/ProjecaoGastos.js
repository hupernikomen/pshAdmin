import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebaseConnection";
import { AppContext } from "../context/AppContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  valorAPagarItem,
} from "../utils/financeiro";

function parseNumero(txt) {
  if (txt === null || txt === undefined) return 0;
  let s = String(txt).trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (!(parts.length === 2 && parts[1].length <= 2)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function chaveMes(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesesEntre(anoIni, mesIni, anoFim, mesFim) {
  const list = [];
  let a = anoIni;
  let m = mesIni;
  while (a < anoFim || (a === anoFim && m <= mesFim)) {
    list.push({
      ano: a,
      mes: m,
      key: `${a}-${String(m + 1).padStart(2, "0")}`,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      a += 1;
    }
  }
  return list;
}

function inicioMediaDizimos(createdAt) {
  const d = new Date(Number(createdAt) || 0);
  if (!createdAt || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

function calcularMediaDizimos(lista, igrejaAtiva) {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const limiteHoje = fimDoDiaTs(agora);

  const inicioMedia = inicioMediaDizimos(igrejaAtiva?.createdAt);

  if (inicioMedia) {
    const siAno = inicioMedia.getFullYear();
    const siMes = inicioMedia.getMonth();
    const idxInicio = siAno * 12 + siMes;
    const idxAtual = anoAtual * 12 + mesAtual;
    let meses = idxAtual - idxInicio + 1;

    if (meses < 1) return 0;

    const totalDizimosPeriodo = (lista || [])
      .filter((i) => i.tipoMovimento === "entrada" && i.tipo === "Dízimo")
      .reduce((acc, i) => {
        const recebidos = Array.isArray(i.valoresRecebidos)
          ? i.valoresRecebidos
          : [];

        if (recebidos.length > 0) {
          return (
            acc +
            recebidos.reduce((s, r) => {
              const ts = Number(r.data || 0);
              if (!ts || ts > limiteHoje) return s;
              if (ts < inicioMedia.getTime()) return s;
              const d = new Date(ts);
              const idx = d.getFullYear() * 12 + d.getMonth();
              if (idx >= idxInicio && idx <= idxAtual) {
                return s + (Number(r.valor) || 0);
              }
              return s;
            }, 0)
          );
        }

        const ts = dataDoItem(i);
        if (!ts || ts > limiteHoje || ts < inicioMedia.getTime()) return acc;
        const d = new Date(ts);
        const idx = d.getFullYear() * 12 + d.getMonth();
        if (idx >= idxInicio && idx <= idxAtual) {
          return acc + (Number(i.valorRecebidoTotal) || 0);
        }
        return acc;
      }, 0);

    return arred(totalDizimosPeriodo / meses);
  }

  const totalDizimosAno = (lista || [])
    .filter((i) => i.tipoMovimento === "entrada" && i.tipo === "Dízimo")
    .reduce((acc, i) => {
      let s = 0;
      for (let m = 0; m <= mesAtual; m++) {
        const recebidos = Array.isArray(i.valoresRecebidos)
          ? i.valoresRecebidos
          : [];
        if (recebidos.length > 0) {
          s += recebidos.reduce((sum, r) => {
            const ts = Number(r.data || 0);
            if (!ts || ts > limiteHoje) return sum;
            const d = new Date(ts);
            if (d.getMonth() === m && d.getFullYear() === anoAtual) {
              return sum + (Number(r.valor) || 0);
            }
            return sum;
          }, 0);
        } else {
          const ts = dataDoItem(i);
          if (ts && ts <= limiteHoje) {
            const d = new Date(ts);
            if (d.getMonth() === m && d.getFullYear() === anoAtual) {
              s += Number(i.valorRecebidoTotal) || 0;
            }
          }
        }
      }
      return acc + s;
    }, 0);

  return arred(mesAtual + 1 > 0 ? totalDizimosAno / (mesAtual + 1) : 0);
}

function simularViabilidade({
  saldoProjetadoInicial,
  mediaDizimos,
  gastosExistentes,
  novoGasto,
}) {
  const agora = new Date();
  const mesIni = agora.getMonth();
  const anoIni = agora.getFullYear();

  const todos = [...(gastosExistentes || [])];
  if (novoGasto) {
    todos.push({
      id: "__novo__",
      data: Number(novoGasto.data),
      valor: Number(novoGasto.valor) || 0,
      descricao: novoGasto.descricao || "",
    });
  }

  const porItem = {};

  if (!todos.length) {
    return {
      ok: true,
      saldoFinal: arred(saldoProjetadoInicial),
      detalheMeses: [],
      porItem,
      motivo: "",
    };
  }

  todos.sort((a, b) => (a.data || 0) - (b.data || 0));

  const ultima = new Date(todos[todos.length - 1].data);
  const meses = mesesEntre(
    anoIni,
    mesIni,
    ultima.getFullYear(),
    ultima.getMonth()
  );

  const porMes = {};
  todos.forEach((g) => {
    const k = chaveMes(g.data);
    if (!porMes[k]) porMes[k] = [];
    porMes[k].push(g);
  });

  let saldo = arred(saldoProjetadoInicial);
  const detalheMeses = [];
  let okGeral = true;
  let motivo = "";

  for (const m of meses) {
    saldo = arred(saldo + mediaDizimos);

    const listaMes = porMes[m.key] || [];
    listaMes.sort((a, b) => (a.data || 0) - (b.data || 0));

    for (const g of listaMes) {
      const valor = arred(Number(g.valor) || 0);
      const saldoAntes = saldo;
      const cabe = saldo + 0.001 >= valor;

      if (!cabe) {
        okGeral = false;
        if (!motivo) {
          motivo = `Sem saldo suficiente em ${String(m.mes + 1).padStart(
            2,
            "0"
          )}/${m.ano} para "${g.descricao || "gasto"}" (R$ ${valor
            .toFixed(2)
            .replace(".", ",")}). Disponível: R$ ${saldo
            .toFixed(2)
            .replace(".", ",")}.`;
        }
        porItem[g.id] = {
          ok: false,
          saldoAntes,
          saldoApos: saldoAntes,
        };
        continue;
      }

      saldo = arred(saldo - valor);
      porItem[g.id] = {
        ok: true,
        saldoAntes,
        saldoApos: saldo,
      };
    }

    detalheMeses.push({
      key: m.key,
      ano: m.ano,
      mes: m.mes,
      saldoApos: saldo,
      gastos: listaMes.length,
    });
  }

  return {
    ok: okGeral,
    saldoFinal: saldo,
    detalheMeses,
    porItem,
    motivo,
  };
}

export default function ProjecaoGastos() {
  const {
    dadosFinancas,
    saldo,
    load,
    HistoricoMovimentos,
    formatoMoeda,
    igrejaAtiva,
    getIgrejaId,
    podeEditarFinanceiro,
  } = useContext(AppContext);

  const { colors, dark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lista, setLista] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);

  const [modal, setModal] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTxt, setValorTxt] = useState("");
  const [dataPag, setDataPag] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [openId, setOpenId] = useState(null);

  const podeEditar = podeEditarFinanceiro?.() !== false;

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const border = colors.border || (dark ? "#333" : "#ececec");
  const inputBg = dark ? "#2a2a2a" : "#f4f5f7";
  const danger = dark ? "#E57373" : "#C62828";
  const okGreen = dark ? "#81C784" : "#2E7D32";
  const tintOk = dark ? "#1B3D2F" : "#E8F5E9";
  const tintBad = dark ? "#3D1B1B" : "#FFEBEE";

  const indicadores = useMemo(() => {
    const listaFin = dadosFinancas || [];
    const limite = fimDoDiaTs();

    let aReceber = 0;
    let aPagar = 0;
    listaFin.forEach((item) => {
      aReceber += valorAReceberItem(item, limite) || 0;
      aPagar += valorAPagarItem(item, limite) || 0;
    });

    const saldoAtual = Number(saldo) || 0;
    const saldoProjetado = arred(saldoAtual + aReceber - aPagar);
    const mediaDizimos = calcularMediaDizimos(listaFin, igrejaAtiva);

    return {
      saldoAtual,
      aReceber: arred(aReceber),
      aPagar: arred(aPagar),
      saldoProjetado,
      mediaDizimos,
    };
  }, [dadosFinancas, saldo, igrejaAtiva]);

  const simulacao = useMemo(() => {
    return simularViabilidade({
      saldoProjetadoInicial: indicadores.saldoProjetado,
      mediaDizimos: indicadores.mediaDizimos,
      gastosExistentes: lista,
      novoGasto: null,
    });
  }, [indicadores.saldoProjetado, indicadores.mediaDizimos, lista]);

  const carregarGastos = useCallback(async () => {
    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      setLista([]);
      setCarregandoLista(false);
      return;
    }
    try {
      const q = query(
        collection(db, "gastosProjetados"),
        where("igrejaId", "==", igrejaId),
        orderBy("data", "asc")
      );
      const snap = await getDocs(q);
      setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log("Erro gastosProjetados:", e);
      try {
        const q2 = query(
          collection(db, "gastosProjetados"),
          where("igrejaId", "==", igrejaId)
        );
        const snap2 = await getDocs(q2);
        const arr = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (a.data || 0) - (b.data || 0));
        setLista(arr);
      } catch (e2) {
        console.log("Erro fallback gastosProjetados:", e2);
        setLista([]);
      }
    } finally {
      setCarregandoLista(false);
    }
  }, [getIgrejaId]);

  useEffect(() => {
    carregarGastos();
  }, [carregarGastos, igrejaAtiva?.id]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos?.(), carregarGastos()]);
    setRefreshing(false);
  }

  function abrirModal() {
    setDescricao("");
    setValorTxt("");
    setDataPag(new Date());
    setModal(true);
  }

  async function salvar() {
    if (!podeEditar) {
      Alert.alert("Aviso", "Você não tem permissão para registrar.");
      return;
    }
    const nome = String(descricao || "").trim();
    const valor = parseNumero(valorTxt);
    if (!nome) {
      Alert.alert("Atenção", "Informe o nome do gasto.");
      return;
    }
    if (!(valor > 0)) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }

    const dataTs = new Date(dataPag).setHours(12, 0, 0, 0);

    const mediaAgora = indicadores.mediaDizimos;
    const projetadoAgora = indicadores.saldoProjetado;

    const teste = simularViabilidade({
      saldoProjetadoInicial: projetadoAgora,
      mediaDizimos: mediaAgora,
      gastosExistentes: lista,
      novoGasto: { data: dataTs, valor, descricao: nome },
    });

    if (!teste.ok) {
      Alert.alert("Não é viável", teste.motivo || "Saldo futuro insuficiente.");
      return;
    }

    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      Alert.alert("Erro", "Nenhuma igreja selecionada.");
      return;
    }

    try {
      setSalvando(true);
      await addDoc(collection(db, "gastosProjetados"), {
        igrejaId,
        descricao: nome,
        valor: arred(valor),
        data: dataTs,
        mediaDizimosUsada: mediaAgora,
        saldoProjetadoBase: projetadoAgora,
        createdAt: Date.now(),
        ficticio: true,
      });
      setModal(false);
      await carregarGastos();
      Alert.alert(
        "Registrado",
        "Gasto projetado salvo para consulta. Não altera o caixa real."
      );
    } catch (e) {
      console.log("Erro salvar gasto projetado:", e);
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item) {
    Alert.alert("Excluir", `Remover "${item.descricao}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "gastosProjetados", item.id));
            await carregarGastos();
          } catch (e) {
            Alert.alert("Erro", "Não foi possível excluir.");
          }
        },
      },
    ]);
  }

  if ((load || carregandoLista) && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: card }]}>
                <Text style={[styles.kpiLabel, { color: muted }]}>
                  Saldo projetado
                </Text>
                <Text style={[styles.kpiValue, { color: text }]}>
                  R$ {formatoMoeda.format(indicadores.saldoProjetado)}
                </Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: card }]}>
                <Text style={[styles.kpiLabel, { color: muted }]}>
                  Média de dízimos
                </Text>
                <Text style={[styles.kpiValue, { color: text }]}>
                  R$ {formatoMoeda.format(indicadores.mediaDizimos)}
                </Text>
              </View>
            </View>

            {podeEditar && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: principal }]}
                onPress={abrirModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Novo gasto projetado</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.sectionTitle, { color: text }]}>
              Gastos projetados
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={muted} />
            <Text style={[styles.emptyTitle, { color: muted }]}>
              Nenhum gasto projetado
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              Registre despesas futuras fictícias para testar a viabilidade com
              o saldo projetado e a média de dízimos.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dataStr = item.data
            ? new Date(item.data).toLocaleDateString("pt-BR")
            : "—";

          const det = simulacao.porItem?.[item.id];
          const okItem = det ? !!det.ok : true;
          const saldoAposItem = det
            ? det.saldoApos
            : indicadores.saldoProjetado;

          const situacaoTxt = okItem ? "Viável" : "Sem saldo";
          const situacaoCor = okItem ? okGreen : danger;

          const subtitle = `${dataStr}  ·  ${situacaoTxt}\nSaldo restante: R$ ${formatoMoeda.format(
            saldoAposItem
          )}`;

          return (
            <SwipeCard
              icon={
                okItem ? "checkmark-circle-outline" : "alert-circle-outline"
              }
              iconColor={situacaoCor}
              tint={okItem ? tintOk : tintBad}
              title={item.descricao || "Gasto"}
              subtitle={subtitle}
              value={`R$ ${formatoMoeda.format(item.valor || 0)}`}
              open={openId === item.id}
              onOpenChange={(v) => setOpenId(v ? item.id : null)}
              actions={
                podeEditar
                  ? [
                      {
                        key: "del",
                        icon: "trash-outline",
                        backgroundColor: danger,
                        onPress: () => excluir(item),
                      },
                    ]
                  : []
              }
            />
          );
        }}
        ListFooterComponent={
          <View style={styles.footerBox}>
            <Text style={[styles.calcText, { color: muted }]}>
              A projeção de gastos analisa o saldo projetado somado à média de
              dízimos (dados reais), para verificação da viabilidade dos gastos
              (fictícios).
            </Text>
          </View>
        }
      />

      <Modal visible={modal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModal(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: card }]}>
            <Text style={[styles.modalTitle, { color: text }]}>
              Novo gasto projetado
            </Text>
            <Text style={[styles.modalSub, { color: muted }]}>
              Não entra no caixa real · viabilidade com saldo projetado + média
              de dízimos
            </Text>

            <Text style={[styles.inputLabel, { color: muted }]}>Nome</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, color: text, borderColor: border },
              ]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Ex: Reforma do salão"
              placeholderTextColor={muted}
            />

            <Text style={[styles.inputLabel, { color: muted }]}>Valor</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, color: text, borderColor: border },
              ]}
              value={valorTxt}
              onChangeText={setValorTxt}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={muted}
            />

            <Text style={[styles.inputLabel, { color: muted }]}>
              Data do pagamento
            </Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: inputBg }]}
              onPress={() => setShowDate(true)}
            >
              <Text
                style={{
                  fontFamily: "Roboto-Regular",
                  fontSize: 15,
                  color: text,
                }}
              >
                {dataPag.toLocaleDateString("pt-BR")}
              </Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={dataPag}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onValueChange={(_, d) => {
                  setShowDate(Platform.OS === "ios");
                  if (d) setDataPag(d);
                }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnCancel, { backgroundColor: inputBg }]}
                onPress={() => setModal(false)}
              >
                <Text style={[styles.btnCancelText, { color: muted }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnOk,
                  { backgroundColor: principal },
                  salvando && { opacity: 0.7 },
                ]}
                onPress={salvar}
                disabled={salvando}
              >
                <Text style={styles.btnOkText}>
                  {salvando ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop:14,
    paddingHorizontal: 14,
    paddingBottom: 100,
    gap: 8,
  },
  headerBlock: { marginBottom: 8 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  addBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    marginBottom: 8,
  },
  empty: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: "Roboto-Medium",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
  footerBox: {
    marginTop: 12,
    paddingBottom: 24,
  },
  calcText: {
    fontSize: 13,
    fontFamily: "Roboto-Light",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
  },
  modalSub: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  btnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOkText: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#fff",
  },
});
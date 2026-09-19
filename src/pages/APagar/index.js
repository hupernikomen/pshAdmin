import { useContext, useEffect, useMemo, useState } from "react";
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
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../../context/AppContext";
import { db } from "../../firebaseConnection";
import { doc, updateDoc } from "firebase/firestore";
import Load from "../../componentes/Load";

import { useAuth } from "../../context/AuthContext"; // caminho do seu projeto

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

export default function APagar() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
    caixinhas,
    saldoDisponivel,
    RetirarDaCaixinha,
    CarregarCaixinhas,
    ResumoFinanceiro,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorPago, setValorPago] = useState("");
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const { uid } = useAuth();

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoad(true);
    await HistoricoMovimentos();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  const pendentes = useMemo(() => {
    return (dadosFinancas || [])
      .filter((i) => {
        if (i.tipoMovimento !== "saida") return false;
        if (i.status === "quitada") return false;
        const total = Number(i.valorTotal) || 0;
        const pago = Number(i.valorPagoTotal) || 0;
        return total > pago;
      })
      .map((i) => {
        const total = Number(i.valorTotal) || 0;
        const pago = Number(i.valorPagoTotal) || 0;
        const falta = Math.round((total - pago) * 100) / 100;
        return { ...i, falta };
      })
      .sort((a, b) => (a.data || 0) - (b.data || 0));
  }, [dadosFinancas]);

  const totalAPagar = useMemo(
    () => pendentes.reduce((acc, i) => acc + (i.falta || 0), 0),
    [pendentes]
  );

  function abrirPagar(item) {
    setItemSel(item);
    setValorPago(String(item.falta).replace(".", ","));
    setOrigemPagamento("geral");
    setCaixinhaId(null);
    setModalVisible(true);
  }

  function fecharModal() {
    setModalVisible(false);
    setItemSel(null);
    setValorPago("");
    setCaixinhaId(null);
  }

  async function confirmarPagamento() {
    if (!uid) {
      Alert.alert("Atenção", "Faça login novamente.");
      return;
    }

    if (!itemSel) return;

    const valor = parseNumero(valorPago);
    if (valor <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }
    if (valor > itemSel.falta + 0.001) {
      Alert.alert(
        "Atenção",
        `O valor não pode ser maior que R$ ${formatoMoeda.format(itemSel.falta)}`
      );
      return;
    }

    if (origemPagamento === "geral") {
      if (valor > (Number(saldoDisponivel) || 0) + 0.001) {
        Alert.alert(
          "Saldo insuficiente",
          `Caixa geral: R$ ${formatoMoeda.format(saldoDisponivel || 0)}`
        );
        return;
      }
    } else {
      if (!caixinhaId) {
        Alert.alert("Atenção", "Selecione a caixinha.");
        return;
      }
      const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
      if (!cx || valor > (Number(cx.valor) || 0) + 0.001) {
        Alert.alert("Saldo insuficiente", "Valor maior que o da caixinha.");
        return;
      }
    }

    setSalvando(true);
    try {
      const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
      const listaAtual = itemSel.valoresPagos || [];
      const novoTotal =
        Math.round(((Number(itemSel.valorPagoTotal) || 0) + valor) * 100) / 100;

      const novoPagamento = {
        valor,
        data: Date.now(),
        id: Date.now().toString(),
        origemPagamento,
        caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
        caixinhaNome:
          origemPagamento === "caixinha" ? cx?.nome || null : null,
      };

      await updateDoc(doc(db, "registros", itemSel.id), {
        valoresPagos: [...listaAtual, novoPagamento],
        valorPagoTotal: novoTotal,
        status: novoTotal >= (Number(itemSel.valorTotal) || 0) ? "quitada" : "aberta",
        origemPagamento,
        caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
        caixinhaNome:
          origemPagamento === "caixinha" ? cx?.nome || null : null,
      });

      if (origemPagamento === "caixinha" && caixinhaId) {
        await RetirarDaCaixinha(caixinhaId, valor);
      }

      await Promise.all([
        HistoricoMovimentos(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);

      fecharModal();
      Alert.alert("Sucesso", "Pagamento registrado.");
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível pagar.");
    } finally {
      setSalvando(false);
    }
  }

  const caixinhasComSaldo = (caixinhas || []).filter(
    (c) => (Number(c.valor) || 0) > 0
  );

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={pendentes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.principal]}
          />
        }

        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#9aa3ad" />
            </View>
            <Text style={styles.emptyTitle}>Nada pendente</Text>
            <Text style={styles.emptyText}>
              Quando houver despesas em aberto, elas aparecem aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const pago = Number(item.valorPagoTotal) || 0;
          const total = Number(item.valorTotal) || 0;
          const pct = total > 0 ? Math.min(pago / total, 1) : 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconCircle}>
                  <Ionicons name="arrow-up-outline" size={18} color="#C62828" />
                </View>
                <View style={styles.cardCenter}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.descricao || "Sem descrição"}
                  </Text>
                  <Text style={styles.cardSub}>
                    {item.tipo || "Saída"}
                    {"  ·  "}
                    {item.data
                      ? new Date(item.data).toLocaleDateString("pt-BR")
                      : "-"}
                  </Text>
                </View>
                <Text style={styles.cardFalta}>
                  R$ {formatoMoeda.format(item.falta)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Pago R$ {formatoMoeda.format(pago)} de{" "}
                  {formatoMoeda.format(total)}
                </Text>
              </View>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${pct * 100}%`,
                      backgroundColor: colors.principal,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[styles.payBtn, { backgroundColor: colors.principal }]}
                onPress={() => abrirPagar(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.payBtnText}>Registrar pagamento</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={<View style={{ height: 28 }} />}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <Pressable style={styles.modalOverlay} onPress={fecharModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.modalCard} onPress={() => { }}>
              <Text style={styles.modalTitle}>Registrar pagamento</Text>
              <Text style={styles.modalSub}>
                {itemSel?.descricao || ""} · falta R${" "}
                {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              <Text style={styles.inputLabel}>Valor</Text>
              <TextInput
                style={styles.input}
                value={valorPago}
                onChangeText={setValorPago}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.inputLabel}>Pagar com</Text>
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    origemPagamento === "geral" && {
                      backgroundColor: colors.principal,
                    },
                  ]}
                  onPress={() => {
                    setOrigemPagamento("geral");
                    setCaixinhaId(null);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      origemPagamento === "geral" && { color: "#fff" },
                    ]}
                  >
                    Caixa geral
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    origemPagamento === "caixinha" && {
                      backgroundColor: colors.principal,
                    },
                  ]}
                  onPress={() => setOrigemPagamento("caixinha")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      origemPagamento === "caixinha" && { color: "#fff" },
                    ]}
                  >
                    Caixinha
                  </Text>
                </TouchableOpacity>
              </View>

              {origemPagamento === "geral" ? (
                <Text style={styles.hint}>
                  Disponível: R$ {formatoMoeda.format(saldoDisponivel || 0)}
                </Text>
              ) : caixinhasComSaldo.length === 0 ? (
                <Text style={styles.hint}>Nenhuma caixinha com saldo</Text>
              ) : (
                caixinhasComSaldo.map((cx) => (
                  <TouchableOpacity
                    key={cx.id}
                    style={[
                      styles.cxItem,
                      caixinhaId === cx.id && {
                        borderColor: colors.principal,
                      },
                    ]}
                    onPress={() => setCaixinhaId(cx.id)}
                  >
                    <Text style={styles.cxNome}>{cx.nome}</Text>
                    <Text style={styles.cxValor}>
                      R$ {formatoMoeda.format(cx.valor || 0)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancel} onPress={fecharModal}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnOk,
                    { backgroundColor: colors.principal },
                    salvando && { opacity: 0.7 },
                  ]}
                  onPress={confirmarPagamento}
                  disabled={salvando}
                >
                  <Text style={styles.btnOkText}>
                    {salvando ? "Salvando..." : "Confirmar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f5f7" },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },
  balanceCard: {
    backgroundColor: "#1f2933",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa3ad",
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 30,
    fontFamily: "Roboto-Bold",
    color: "#fff",
    letterSpacing: -0.8,
  },
  balanceSub: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#8b949e",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardCenter: { flex: 1, paddingRight: 8 },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  cardSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  cardFalta: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#C62828",
  },
  metaRow: { marginTop: 10 },
  metaText: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
  },
  barTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#eef1f4",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 6 },
  payBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Roboto-Bold",
  },
  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: "Roboto-Medium",
    color: "#666",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#999",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
  },
  modalSub: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#888",
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#777",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
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
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
    marginBottom: 10,
  },
  cxItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f4f5f7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  cxNome: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  cxValor: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#666",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#f4f5f7",
    alignItems: "center",
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#555",
  },
  btnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOkText: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#fff",
  },
});
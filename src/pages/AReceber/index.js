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
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../../context/AppContext";
import { db } from "../../firebaseConnection";
import { doc, updateDoc } from "firebase/firestore";
import Load from "../../componentes/Load";
import { useAuth } from "../../context/AuthContext";

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

function arred(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export default function AReceber() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
    ResumoFinanceiro,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const { uid, authPronto } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!authPronto || !uid) return;
    carregar();
  }, [authPronto, uid]);

  async function carregar() {
    setLoad(true);
    await HistoricoMovimentos();
    setLoad(false);
  }

  const onRefresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  const pendentes = useMemo(() => {
    const lista = [];

    (dadosFinancas || []).forEach((i) => {
      if (i.tipoMovimento !== "entrada") return;
      if (i.status === "quitada") return;
      if (i.tipo === "Saldo inicial") return;

      const total = Number(i.valorTotal) || 0;
      const recebido = Number(i.valorRecebidoTotal) || 0;
      if (total > recebido) {
        lista.push({
          ...i,
          rowId: i.id,
          falta: arred(total - recebido),
        });
      }
    });

    return lista.sort((a, b) => (b.data || 0) - (a.data || 0));
  }, [dadosFinancas]);

  const totalAReceber = useMemo(
    () => pendentes.reduce((acc, i) => acc + (i.falta || 0), 0),
    [pendentes]
  );

  function abrirReceber(item) {
    setItemSel(item);
    setValorRecebido(String(item.falta).replace(".", ","));
    setModalVisible(true);
  }

  function fecharModal() {
    setModalVisible(false);
    setItemSel(null);
    setValorRecebido("");
  }

  async function confirmarRecebimento() {
    if (!uid) {
      Alert.alert("Atenção", "Faça login novamente.");
      return;
    }
    if (!itemSel) return;

    const valor = parseNumero(valorRecebido);

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

    setSalvando(true);
    try {
      const listaAtual = itemSel.valoresRecebidos || [];
      const novoTotal = arred((Number(itemSel.valorRecebidoTotal) || 0) + valor);

      await updateDoc(doc(db, "registros", itemSel.id), {
        valoresRecebidos: [
          ...listaAtual,
          {
            valor,
            data: Date.now(),
            id: Date.now().toString(),
          },
        ],
        valorRecebidoTotal: novoTotal,
        status:
          novoTotal >= (Number(itemSel.valorTotal) || 0) ? "quitada" : "aberta",
      });

      await Promise.all([HistoricoMovimentos(), ResumoFinanceiro?.()]);

      fecharModal();
      Alert.alert("Sucesso", "Recebimento registrado.");
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  }

  if ((!authPronto || load) && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={pendentes}
        keyExtractor={(item) => item.rowId}
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
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color="#9aa3ad"
              />
            </View>
            <Text style={styles.emptyTitle}>Nada a receber</Text>
            <Text style={styles.emptyText}>
              {!uid
                ? "Faça login para ver os valores."
                : "Quando houver entradas em aberto, elas aparecem aqui."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dataStr = item.data
            ? new Date(item.data).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })
            : "--/--/--";

          return (
            <View style={styles.card}>
              <View style={styles.linha1}>
                <Text style={styles.meta}>
                  {item.tipo || "Entrada"}
                  {"  "}
                  {dataStr}
                </Text>
                <Text style={styles.valor}>
                  R$ {formatoMoeda.format(item.falta)}
                </Text>
              </View>

              <Text style={styles.nome} numberOfLines={1}>
                {item.descricao || "Sem descrição"}
              </Text>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.principal }]}
                onPress={() => abrirReceber(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Registrar recebimento</Text>
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
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Registrar recebimento</Text>
              <Text style={styles.modalSub}>
                {itemSel?.descricao || ""} · R${" "}
                {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              <Text style={styles.inputLabel}>Valor recebido</Text>
              <TextInput
                style={styles.input}
                value={valorRecebido}
                onChangeText={setValorRecebido}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#aaa"
              />

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
                  onPress={confirmarRecebimento}
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
    backgroundColor: "#fff",
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
    color: "#1f2933",
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
    borderRadius: 14,
    padding: 12,
  },
  linha1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#8a8f98",
  },
  valor: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#2E7D32",
  },
  nome: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
    marginBottom: 10,
  },
  btn: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Roboto-Medium",
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
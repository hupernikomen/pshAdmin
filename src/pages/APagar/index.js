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
    podeEditarFinanceiro,
    igrejaAtiva,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const { uid, authPronto } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorPago, setValorPago] = useState("");
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;

  useEffect(() => {
    if (!authPronto || !uid) return;
    carregar();
  }, [authPronto, uid, igrejaAtiva?.id]);

  async function carregar() {
    setLoad(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setLoad(false);
  }

  const onRefresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setRefreshing(false);
  };

  const pendentes = useMemo(() => {
    const lista = [];

    (dadosFinancas || []).forEach((i) => {
      if (i.tipoMovimento !== "saida") return;
      if (i.status === "quitada") return;

      const parcelas = Array.isArray(i.parcelas) ? i.parcelas : [];

      if (parcelas.length > 0) {
        parcelas.forEach((p) => {
          if (p.status !== "aberta") return;
          lista.push({
            ...i,
            isParcela: true,
            rowId: `${i.id}_p${p.numero}`,
            parcelaNumero: p.numero,
            parcelaTotal: i.quantidadeParcelas || parcelas.length,
            falta: arred(p.valor),
            vencimento: p.vencimento,
            parcelaRef: p,
          });
        });
        return;
      }

      const total = Number(i.valorTotal) || 0;
      const pago = Number(i.valorPagoTotal) || 0;
      if (total > pago) {
        lista.push({
          ...i,
          isParcela: false,
          rowId: i.id,
          falta: arred(total - pago),
        });
      }
    });

    return lista.sort((a, b) => {
      const da = a.vencimento || a.data || 0;
      const db_ = b.vencimento || b.data || 0;
      return da - db_;
    });
  }, [dadosFinancas]);

  const totalAPagar = useMemo(
    () => pendentes.reduce((acc, i) => acc + (i.falta || 0), 0),
    [pendentes]
  );

  function abrirPagar(item) {
    if (!podeEditar) {
      Alert.alert(
        "Somente leitura",
        "Seu perfil não permite registrar pagamentos."
      );
      return;
    }
    setItemSel(item);
    setValorPago(
      item.isParcela
        ? String(item.falta).replace(".", ",")
        : String(item.falta).replace(".", ",")
    );
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
    if (!podeEditar) {
      Alert.alert("Somente leitura", "Sem permissão para pagar.");
      return;
    }
    if (!itemSel) return;

    const valor = itemSel.isParcela
      ? arred(itemSel.falta)
      : parseNumero(valorPago);

    if (valor <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }
    if (!itemSel.isParcela && valor > itemSel.falta + 0.001) {
      Alert.alert(
        "Atenção",
        `Máximo: R$ ${formatoMoeda.format(itemSel.falta)}`
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
        Alert.alert("Saldo insuficiente na caixinha.");
        return;
      }
    }

    const cxSel = (caixinhas || []).find((c) => c.id === caixinhaId);

    setSalvando(true);
    try {
      if (itemSel.isParcela) {
        const parcelas = (itemSel.parcelas || []).map((p) => {
          if (p.numero !== itemSel.parcelaNumero) return p;
          return {
            ...p,
            status: "paga",
            pagoEm: Date.now(),
            origemPagamento,
            caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
            caixinhaNome:
              origemPagamento === "caixinha" ? cxSel?.nome || null : null,
          };
        });

        const listaAtual = itemSel.valoresPagos || [];
        const novoTotal = arred((Number(itemSel.valorPagoTotal) || 0) + valor);
        const todasPagas = parcelas.every((p) => p.status === "paga");

        await updateDoc(doc(db, "registros", itemSel.id), {
          parcelas,
          valoresPagos: [
            ...listaAtual,
            {
              valor,
              data: Date.now(),
              id: Date.now().toString(),
              parcelaNumero: itemSel.parcelaNumero,
              origemPagamento,
              caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
              caixinhaNome:
                origemPagamento === "caixinha" ? cxSel?.nome || null : null,
            },
          ],
          valorPagoTotal: novoTotal,
          status: todasPagas ? "quitada" : "aberta",
        });
      } else {
        const listaAtual = itemSel.valoresPagos || [];
        const novoTotal = arred((Number(itemSel.valorPagoTotal) || 0) + valor);

        await updateDoc(doc(db, "registros", itemSel.id), {
          valoresPagos: [
            ...listaAtual,
            {
              valor,
              data: Date.now(),
              id: Date.now().toString(),
              origemPagamento,
              caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
              caixinhaNome:
                origemPagamento === "caixinha" ? cxSel?.nome || null : null,
            },
          ],
          valorPagoTotal: novoTotal,
          status:
            novoTotal >= (Number(itemSel.valorTotal) || 0)
              ? "quitada"
              : "aberta",
        });
      }

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
      Alert.alert("Erro", e?.message || "Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  }

  const caixinhasComSaldo = (caixinhas || []).filter(
    (c) => (Number(c.valor) || 0) > 0
  );

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
            <Text style={styles.emptyTitle}>Nada a pagar</Text>
            <Text style={styles.emptyText}>
              {!uid
                ? "Faça login para ver os valores."
                : "Quando houver despesas em aberto, elas aparecem aqui."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dataRef = item.vencimento || item.data;
          const dataStr = dataRef
            ? new Date(dataRef).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })
            : "--/--/--";

          const esquerda = item.isParcela
            ? `${item.parcelaNumero}/${item.parcelaTotal}`
            : item.tipo || "Saída";

          return (
            <View style={styles.card}>
              <View style={styles.linha1}>
                <Text style={styles.meta}>
                  {esquerda}
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

              {podeEditar ? (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.principal }]}
                  onPress={() => abrirPagar(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>
                    {item.isParcela ? "Pagar parcela" : "Registrar pagamento"}
                  </Text>
                </TouchableOpacity>
              ) : null}
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
              <Text style={styles.modalTitle}>
                {itemSel?.isParcela ? "Pagar parcela" : "Registrar pagamento"}
              </Text>
              <Text style={styles.modalSub}>
                {itemSel?.descricao || ""}
                {itemSel?.isParcela
                  ? ` · Parcela ${itemSel.parcelaNumero}/${itemSel.parcelaTotal}`
                  : ""}{" "}
                · R$ {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              {!itemSel?.isParcela && (
                <>
                  <Text style={styles.inputLabel}>Valor</Text>
                  <TextInput
                    style={styles.input}
                    value={valorPago}
                    onChangeText={setValorPago}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#aaa"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Pagar com</Text>
              <View style={styles.segment}>
                {[
                  { id: "geral", label: "Caixa geral" },
                  { id: "caixinha", label: "Caixinha" },
                ].map((opt) => {
                  const ativo = origemPagamento === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.segmentBtn,
                        ativo && { backgroundColor: colors.principal },
                      ]}
                      onPress={() => {
                        setOrigemPagamento(opt.id);
                        if (opt.id === "geral") setCaixinhaId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          ativo && { color: "#fff" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {origemPagamento === "geral" ? (
                <Text style={styles.hint}>
                  Disponível: R$ {formatoMoeda.format(saldoDisponivel || 0)}
                </Text>
              ) : (
                <>
                  {caixinhasComSaldo.length === 0 ? (
                    <Text style={styles.hint}>Nenhuma caixinha com saldo</Text>
                  ) : (
                    caixinhasComSaldo.map((cx) => {
                      const ativo = caixinhaId === cx.id;
                      return (
                        <TouchableOpacity
                          key={cx.id}
                          style={[
                            styles.cxItem,
                            ativo && { borderColor: colors.principal },
                          ]}
                          onPress={() => setCaixinhaId(cx.id)}
                        >
                          <Text style={styles.cxNome}>{cx.nome}</Text>
                          <Text style={styles.cxValor}>
                            R$ {formatoMoeda.format(cx.valor || 0)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
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
    color: "#C62828",
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
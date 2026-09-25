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
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import { doc, updateDoc } from "firebase/firestore";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { useAuth } from "../context/AuthContext";

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

function fimDoDiaTs(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function dataDoItem(item) {
  return Number(item?.data || item?.createdAt || item?.reg || 0) || 0;
}

export default function AReceber() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
    ResumoFinanceiro,
    podeEditarFinanceiro,
    igrejaAtiva,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const { uid, authPronto } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;
  const limiteHoje = fimDoDiaTs();

  useEffect(() => {
    if (!authPronto || !uid) return;
    carregar();
  }, [authPronto, uid, igrejaAtiva?.id]);

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

  /**
   * Lista alinhada com o card da Home:
   * 1) Entrada em aberto com falta (data <= hoje ou qualquer)
   * 2) Entrada com DATA FUTURA (mesmo quitada no cadastro) —
   *    valor ainda não entra no saldo, então aparece aqui
   */
  const pendentes = useMemo(() => {
    const lista = [];

    (dadosFinancas || []).forEach((i) => {
      if (i.tipoMovimento !== "entrada") return;
      if (i.tipo === "Saldo inicial") return;

      const ts = dataDoItem(i);
      if (!ts) return;

      const total = Number(i.valorTotal) || 0;
      const recebido = Number(i.valorRecebidoTotal) || 0;
      const isFuturo = ts > limiteHoje;

      if (isFuturo) {
        // O que ainda não pode ir para o saldo (recebido “agendado” ou total)
        const valor =
          recebido > 0.001 ? recebido : total > 0.001 ? total : 0;
        if (valor <= 0.001) return;

        lista.push({
          ...i,
          rowId: i.id,
          falta: arred(valor),
          isFuturo: true,
        });
        return;
      }

      // Data até hoje: só se ainda houver valor a receber
      if (i.status === "quitada") return;
      if (total > recebido + 0.001) {
        lista.push({
          ...i,
          rowId: i.id,
          falta: arred(total - recebido),
          isFuturo: false,
        });
      }
    });

    return lista.sort((a, b) => (a.data || 0) - (b.data || 0));
  }, [dadosFinancas, limiteHoje]);

  function abrirReceber(item) {
    if (!podeEditar) {
      Alert.alert(
        "Somente leitura",
        "Seu perfil não permite registrar recebimentos."
      );
      return;
    }
    setItemSel(item);
    setValorRecebido(String(item.falta).replace(".", ","));
    setModalVisible(true);
    setAbertoId(null);
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
    if (!podeEditar) {
      Alert.alert("Somente leitura", "Sem permissão.");
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
        `Máximo: R$ ${formatoMoeda.format(itemSel.falta)}`
      );
      return;
    }

    setSalvando(true);
    try {
      const listaAtual = itemSel.valoresRecebidos || [];
      const agora = Date.now();

      if (itemSel.isFuturo) {
        /**
         * Entrada com data futura: ao “receber/baixar”,
         * a data vira hoje para o valor entrar no saldo.
         */
        const total = Number(itemSel.valorTotal) || Number(itemSel.falta) || 0;
        const novoRecebido = arred(valor);

        await updateDoc(doc(db, "registros", itemSel.id), {
          data: agora,
          valoresRecebidos: [
            ...listaAtual,
            {
              valor: novoRecebido,
              data: agora,
              id: agora.toString(),
            },
          ],
          valorRecebidoTotal: novoRecebido,
          valorTotal: total > 0 ? total : novoRecebido,
          status:
            novoRecebido >= (total > 0 ? total : novoRecebido) - 0.001
              ? "quitada"
              : "aberta",
          updatedAt: agora,
        });
      } else {
        const novoTotal = arred(
          (Number(itemSel.valorRecebidoTotal) || 0) + valor
        );

        await updateDoc(doc(db, "registros", itemSel.id), {
          valoresRecebidos: [
            ...listaAtual,
            {
              valor,
              data: agora,
              id: agora.toString(),
            },
          ],
          valorRecebidoTotal: novoTotal,
          status:
            novoTotal >= (Number(itemSel.valorTotal) || 0) - 0.001
              ? "quitada"
              : "aberta",
          updatedAt: agora,
        });
      }

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
                : "Quando houver entradas em aberto ou com data futura, elas aparecem aqui."}
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

          const meta = item.isFuturo
            ? `${item.tipo || "Entrada"} · ${dataStr} · Data futura`
            : `${item.tipo || "Entrada"} · ${dataStr}`;

          const actions = podeEditar
            ? [
                {
                  key: "receber",
                  icon: item.isFuturo ? "calendar-outline" : "download-outline",
                  label: item.isFuturo ? "Baixar" : "Receber",
                  backgroundColor: colors.principal,
                  onPress: () => abrirReceber(item),
                },
              ]
            : [];

          return (
            <SwipeCard
              icon={item.isFuturo ? "time-outline" : "arrow-down-outline"}
              iconColor={item.isFuturo ? "#EF6C00" : "#2E7D32"}
              tint={item.isFuturo ? "#FFF3E0" : "#E8F5E9"}
              title={item.descricao || "Sem descrição"}
              subtitle={meta}
              value={`R$ ${formatoMoeda.format(item.falta)}`}
              actions={actions}
              open={abertoId === item.rowId}
              onOpenChange={(isOpen) =>
                setAbertoId(isOpen ? item.rowId : null)
              }
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
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
                {itemSel?.isFuturo
                  ? "Baixar entrada futura"
                  : "Registrar recebimento"}
              </Text>
              <Text style={styles.modalSub}>
                {itemSel?.descricao || ""} · R${" "}
                {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              {!!itemSel?.isFuturo && (
                <Text style={styles.hintFuturo}>
                  Esta entrada tem data futura. Ao confirmar, a data passa a ser
                  hoje e o valor entra no saldo atual.
                </Text>
              )}

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
  container: { flex: 1, paddingHorizontal: 14 },
  content: { paddingTop: 12, paddingBottom: 20 },
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
    marginBottom: 10,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#888",
  },
  hintFuturo: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#EF6C00",
    marginBottom: 12,
    lineHeight: 18,
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
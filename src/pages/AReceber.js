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
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import { doc, updateDoc } from "firebase/firestore";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { useAuth } from "../context/AuthContext";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  isEntradaFutura,
  tsDoDia,
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

  const { colors, dark } = useTheme();
  const { uid, authPronto } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;
  const limiteHoje = fimDoDiaTs();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const border = colors.border || (dark ? "#333" : "#ececec");
  const okGreen = dark ? "#81C784" : "#2E7D32";
  const warnOrange = dark ? "#FFB74D" : "#EF6C00";
  const tintOk = dark ? "#1B3D2F" : "#E8F5E9";
  const tintWarn = dark ? "#3D2A14" : "#FFF3E0";

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

  const pendentes = useMemo(() => {
    const lista = [];

    (dadosFinancas || []).forEach((i) => {
      const valor = valorAReceberItem(i);
      if (valor <= 0.001) return;

      lista.push({
        ...i,
        rowId: i.id,
        falta: arred(valor),
        isFuturo: isEntradaFutura(i, limiteHoje),
      });
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
    setDataRecebimento(new Date());
    setShowDatePicker(false);
    setModalVisible(true);
    setAbertoId(null);
  }

  function fecharModal() {
    setModalVisible(false);
    setItemSel(null);
    setValorRecebido("");
    setShowDatePicker(false);
  }

  function onChangeData(event, selected) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed") return;
    if (selected) setDataRecebimento(selected);
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

    const listaAtual = itemSel.valoresRecebidos || [];
    const dataRecTs = tsDoDia(dataRecebimento);
    const idRec = `${dataRecTs}_${Date.now()}`;
    const novoTotal = arred(
      (Number(itemSel.valorRecebidoTotal) || 0) + valor
    );
    const totalDoc = Number(itemSel.valorTotal) || 0;
    const status =
      totalDoc > 0 && novoTotal >= totalDoc - 0.001 ? "quitada" : "aberta";

    setSalvando(true);
    try {
      const payload = {
        valoresRecebidos: [
          ...listaAtual,
          {
            valor,
            data: dataRecTs,
            id: idRec,
          },
        ],
        valorRecebidoTotal: novoTotal,
        status,
        updatedAt: Date.now(),
      };

      if (itemSel.isFuturo) {
        payload.data = dataRecTs;
        if (!(totalDoc > 0)) {
          payload.valorTotal = novoTotal;
        }
      }

      await updateDoc(doc(db, "registros", itemSel.id), payload);

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
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={pendentes}
        keyExtractor={(item) => item.rowId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIcon, { backgroundColor: card }]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color={muted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: muted }]}>
              Nada a receber
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
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
                  backgroundColor: principal,
                  onPress: () => abrirReceber(item),
                },
              ]
            : [];

          return (
            <SwipeCard
              icon={item.isFuturo ? "time-outline" : "arrow-down-outline"}
              iconColor={item.isFuturo ? warnOrange : okGreen}
              tint={item.isFuturo ? tintWarn : tintOk}
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
            <Pressable
              style={[styles.modalCard, { backgroundColor: card }]}
              onPress={() => {}}
            >
              <Text style={[styles.modalTitle, { color: text }]}>
                {itemSel?.isFuturo
                  ? "Baixar entrada futura"
                  : "Registrar recebimento"}
              </Text>
              <Text style={[styles.modalSub, { color: muted }]}>
                {itemSel?.descricao || ""} · R${" "}
                {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              {!!itemSel?.isFuturo && (
                <Text style={[styles.hintFuturo, { color: warnOrange }]}>
                  Esta entrada tem data futura. Ao confirmar, a data do registro
                  passa a ser a data do recebimento e o valor entra no caixa
                  nessa data.
                </Text>
              )}

              <Text style={[styles.inputLabel, { color: muted }]}>
                Data do recebimento
              </Text>
              <TouchableOpacity
                style={[styles.dateBox, { backgroundColor: surface }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={muted} />
                <Text style={[styles.dateText, { color: text }]}>
                  {dataRecebimento.toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dataRecebimento}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={onChangeData}
                />
              )}

              {Platform.OS === "ios" && showDatePicker && (
                <TouchableOpacity
                  style={styles.dateOk}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={[styles.dateOkText, { color: principal }]}>
                    OK
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.inputLabel, { color: muted }]}>
                Valor recebido
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: surface,
                    color: text,
                    borderColor: border,
                  },
                ]}
                value={valorRecebido}
                onChangeText={setValorRecebido}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={muted}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btnCancel, { backgroundColor: surface }]}
                  onPress={fecharModal}
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
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: "Roboto-Medium",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 22,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
  },
  modalSub: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },
  hintFuturo: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 4,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  dateOk: {
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dateOkText: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
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
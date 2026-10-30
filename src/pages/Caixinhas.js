import { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";

function parseValor(txt) {
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

export default function Caixinhas() {
  const {
    caixinhas,
    saldoDisponivel,
    load,
    setLoad,
    CarregarCaixinhas,
    CriarCaixinha,
    DepositarNaCaixinha,
    RetirarDaCaixinha,
    ExcluirCaixinha,
    formatoMoeda,
    podeEditarFinanceiro,
    igrejaAtiva,
  } = useContext(AppContext);

  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modoModal, setModoModal] = useState("criar"); // criar | depositar | retirar
  const [cxSel, setCxSel] = useState(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const border = colors.border || (dark ? "#333" : "#ececec");
  const danger = dark ? "#E57373" : "#C62828";
  const okGreen = dark ? "#81C784" : "#2E7D32";
  const warnOrange = dark ? "#FFB74D" : "#E65100";
  const iconMuted = dark ? "#9aa0a6" : "#555";
  const tintCard = dark ? "#2c2c2c" : "#f0f0f0";

  useEffect(() => {
    navigation.setOptions({
      title: "Caixinhas",
    });
  }, [navigation]);

  useEffect(() => {
    carregar();
  }, [igrejaAtiva?.id]);

  async function carregar() {
    setLoad(true);
    await CarregarCaixinhas?.();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await CarregarCaixinhas?.();
    setRefreshing(false);
  };

  function abrirCriar() {
    if (!podeEditar) {
      Alert.alert(
        "Somente leitura",
        "Seu perfil não permite alterar caixinhas."
      );
      return;
    }
    setModoModal("criar");
    setCxSel(null);
    setNome("");
    setValor("");
    setModalVisible(true);
  }

  function abrirDepositar(cx) {
    if (!podeEditar) {
      Alert.alert("Somente leitura", "Seu perfil não permite depositar.");
      return;
    }
    setModoModal("depositar");
    setCxSel(cx);
    setNome(cx.nome);
    setValor("");
    setModalVisible(true);
  }

  function abrirRetirar(cx) {
    if (!podeEditar) {
      Alert.alert("Somente leitura", "Seu perfil não permite retirar.");
      return;
    }
    setModoModal("retirar");
    setCxSel(cx);
    setNome(cx.nome);
    setValor("");
    setModalVisible(true);
  }

  function confirmarExcluir(cx) {
    if (!podeEditar) {
      Alert.alert("Somente leitura", "Seu perfil não permite excluir.");
      return;
    }
    Alert.alert(
      "Excluir caixinha",
      `Excluir "${cx.nome}"? O valor volta a contar só no caixa livre (não gera lançamento automático).`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await ExcluirCaixinha(cx.id);
            } catch (e) {
              Alert.alert("Erro", e?.message || "Não foi possível excluir.");
            }
          },
        },
      ]
    );
  }

  async function confirmarModal() {
    const v = parseValor(valor);

    try {
      setSalvando(true);

      if (modoModal === "criar") {
        const n = String(nome || "").trim();
        if (!n) {
          Alert.alert("Atenção", "Informe o nome da caixinha.");
          return;
        }
        if (v < 0) {
          Alert.alert("Atenção", "Valor inválido.");
          return;
        }
        if (v > (Number(saldoDisponivel) || 0) + 0.001) {
          Alert.alert(
            "Saldo insuficiente",
            `Caixa livre disponível: R$ ${formatoMoeda.format(
              saldoDisponivel || 0
            )}`
          );
          return;
        }
        await CriarCaixinha(n, v);
      } else if (modoModal === "depositar") {
        if (v <= 0) {
          Alert.alert("Atenção", "Informe um valor válido.");
          return;
        }
        if (v > (Number(saldoDisponivel) || 0) + 0.001) {
          Alert.alert(
            "Saldo insuficiente",
            `Caixa livre disponível: R$ ${formatoMoeda.format(
              saldoDisponivel || 0
            )}`
          );
          return;
        }
        await DepositarNaCaixinha(cxSel.id, v);
      } else if (modoModal === "retirar") {
        if (v <= 0) {
          Alert.alert("Atenção", "Informe um valor válido.");
          return;
        }
        await RetirarDaCaixinha(cxSel.id, v);
      }

      setModalVisible(false);
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const tituloModal =
    modoModal === "criar"
      ? "Nova caixinha"
      : modoModal === "depositar"
      ? "Reservar na caixinha"
      : "Retirar da caixinha";

  if (load && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={caixinhas || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
              <Ionicons name="wallet-outline" size={26} color={muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: muted }]}>
              Nenhuma caixinha
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              Reserve valores do caixa livre para ministérios ou projetos.
            </Text>
            {podeEditar && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: principal }]}
                onPress={abrirCriar}
              >
                <Text style={styles.emptyBtnText}>Criar caixinha</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const actions = podeEditar
            ? [
                {
                  key: "reservar",
                  icon: "arrow-down-outline",
                  label: "Reservar",
                  backgroundColor: okGreen,
                  onPress: () => abrirDepositar(item),
                },
                {
                  key: "retirar",
                  icon: "arrow-up-outline",
                  label: "Retirar",
                  backgroundColor: warnOrange,
                  onPress: () => abrirRetirar(item),
                },
                {
                  key: "excluir",
                  icon: "trash-outline",
                  label: "Excluir",
                  backgroundColor: danger,
                  onPress: () => confirmarExcluir(item),
                },
              ]
            : [];

          return (
            <SwipeCard
              icon="wallet-outline"
              iconColor={iconMuted}
              tint={tintCard}
              title={item.nome}
              subtitle="Reservado"
              value={`R$ ${formatoMoeda.format(item.valor || 0)}`}
              actions={actions}
              open={abertoId === item.id}
              onOpenChange={(isOpen) => setAbertoId(isOpen ? item.id : null)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {podeEditar && (caixinhas || []).length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: principal }]}
          onPress={abrirCriar}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Nova caixinha</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable
              style={[styles.modal, { backgroundColor: card }]}
              onPress={() => {}}
            >
              <Text style={[styles.modalTitle, { color: text }]}>
                {tituloModal}
              </Text>

              {modoModal === "criar" && (
                <>
                  <Text style={[styles.label, { color: muted }]}>Nome</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: surface,
                        color: text,
                        borderColor: border,
                      },
                    ]}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Missões, Jovens..."
                    placeholderTextColor={muted}
                  />
                </>
              )}

              {modoModal !== "criar" && (
                <Text style={[styles.modalSub, { color: muted }]}>
                  {cxSel?.nome}
                </Text>
              )}

              <Text style={[styles.label, { color: muted }]}>
                {modoModal === "retirar" ? "Valor a retirar" : "Valor"}
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
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={muted}
              />

              {modoModal !== "retirar" && (
                <Text style={[styles.hint, { color: muted }]}>
                  Disponível no caixa livre: R${" "}
                  {formatoMoeda.format(saldoDisponivel || 0)}
                </Text>
              )}
              {modoModal === "retirar" && (
                <Text style={[styles.hint, { color: muted }]}>
                  Na caixinha: R$ {formatoMoeda.format(cxSel?.valor || 0)}
                </Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btnCancel, { backgroundColor: surface }]}
                  onPress={() => setModalVisible(false)}
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
                  onPress={confirmarModal}
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
  container: { flex: 1, paddingTop: 14, paddingHorizontal: 14 },
  list: { paddingBottom: 20 },
  emptyBox: {
    marginTop: 48,
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
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Roboto-Bold",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    left: 18,
    right: 18,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fabText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    marginBottom: 10,
  },
  label: {
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", gap: 10 },
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
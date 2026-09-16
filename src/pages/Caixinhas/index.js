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
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

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
    saldo,
    saldoDisponivel,
    totalReservado,
    load,
    setLoad,
    CarregarCaixinhas,
    CriarCaixinha,
    DepositarNaCaixinha,
    RetirarDaCaixinha,
    ExcluirCaixinha,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modoModal, setModoModal] = useState("criar");
  const [caixinhaSel, setCaixinhaSel] = useState(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [meta, setMeta] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      title: "Caixinhas",
      headerRight: () => (
        <TouchableOpacity
          onPress={abrirCriar}
          style={{ marginRight: 12, padding: 6 }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color="#1f2933" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function carregar() {
    setLoad(true);
    await CarregarCaixinhas();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await CarregarCaixinhas();
    setRefreshing(false);
  };

  function abrirCriar() {
    setModoModal("criar");
    setCaixinhaSel(null);
    setNome("");
    setValor("");
    setMeta("");
    setModalVisible(true);
  }

  function abrirDepositar(item) {
    setModoModal("depositar");
    setCaixinhaSel(item);
    setValor("");
    setModalVisible(true);
  }

  function abrirRetirar(item) {
    setModoModal("retirar");
    setCaixinhaSel(item);
    setValor("");
    setModalVisible(true);
  }

  function fecharModal() {
    setModalVisible(false);
    setCaixinhaSel(null);
    setNome("");
    setValor("");
    setMeta("");
  }

  async function confirmar() {
    const valorNum = parseValor(valor);
    const metaNum = parseValor(meta);

    try {
      setSalvando(true);

      if (modoModal === "criar") {
        await CriarCaixinha({ nome, valor: valorNum, meta: metaNum });
      }
      if (modoModal === "depositar") {
        await DepositarNaCaixinha(caixinhaSel.id, valorNum);
      }
      if (modoModal === "retirar") {
        await RetirarDaCaixinha(caixinhaSel.id, valorNum);
      }

      fecharModal();
    } catch (e) {
      Alert.alert("Atenção", e?.message || "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExcluir(item) {
    Alert.alert(
      "Excluir caixinha",
      `Excluir "${item.nome}"? O valor volta para o caixa geral.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await ExcluirCaixinha(item.id);
            } catch (e) {
              Alert.alert("Erro", e?.message || "Não foi possível excluir");
            }
          },
        },
      ]
    );
  }

  const tituloModal =
    modoModal === "criar"
      ? "Nova caixinha"
      : modoModal === "depositar"
      ? `Guardar em ${caixinhaSel?.nome || ""}`
      : `Retirar de ${caixinhaSel?.nome || ""}`;

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={caixinhas || []}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.principal]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Card escuro de resumo */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo total</Text>
              <Text style={styles.balanceValue}>
                R$ {formatoMoeda.format(saldo || 0)}
              </Text>

              <View style={styles.balanceBottom}>
                <View>
                  <Text style={styles.miniLabel}>Caixa geral</Text>
                  <Text style={styles.miniValue}>
                    R$ {formatoMoeda.format(saldoDisponivel || 0)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.miniLabel}>Nas caixinhas</Text>
                  <Text style={styles.miniValue}>
                    R$ {formatoMoeda.format(totalReservado || 0)}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Ministérios</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={26} color="#9aa3ad" />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma caixinha</Text>
            <Text style={styles.emptyText}>
              Separe valores do caixa geral para cada ministério.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.principal }]}
              onPress={abrirCriar}
            >
              <Text style={styles.emptyBtnText}>Criar caixinha</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const valorItem = Number(item.valor) || 0;
          const metaItem = Number(item.meta) || 0;
          const progresso =
            metaItem > 0 ? Math.min(valorItem / metaItem, 1) : 0;

          return (
            <View style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.iconCircle}>
                  <Ionicons name="wallet-outline" size={18} color="#1f2933" />
                </View>

                <View style={styles.itemCenter}>
                  <Text style={styles.itemTitle}>{item.nome}</Text>
                  {metaItem > 0 ? (
                    <Text style={styles.itemSub}>
                      Meta R$ {formatoMoeda.format(metaItem)}
                    </Text>
                  ) : (
                    <Text style={styles.itemSub}>Sem meta definida</Text>
                  )}
                </View>

                <View style={styles.itemRight}>
                  <Text style={styles.itemValue}>
                    R$ {formatoMoeda.format(valorItem)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => confirmarExcluir(item)}
                    hitSlop={10}
                    style={{ marginTop: 6 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#c4c4c4" />
                  </TouchableOpacity>
                </View>
              </View>

              {metaItem > 0 && (
                <View style={styles.metaBox}>
                  <View style={styles.metaTrack}>
                    <View
                      style={[
                        styles.metaFill,
                        {
                          width: `${progresso * 100}%`,
                          backgroundColor: colors.principal,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => abrirDepositar(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="arrow-down-outline"
                    size={16}
                    color={colors.principal}
                  />
                  <Text style={styles.actionText}>Guardar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => abrirRetirar(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="arrow-up-outline"
                    size={16}
                    color={colors.destaque || "#d7a184"}
                  />
                  <Text style={styles.actionText}>Retirar</Text>
                </TouchableOpacity>
              </View>
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
              <Text style={styles.modalTitle}>{tituloModal}</Text>

              {modoModal === "criar" && (
                <>
                  <Text style={styles.inputLabel}>Nome do ministério</Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Louvor, Missões..."
                    placeholderTextColor="#aaa"
                  />

                  <Text style={styles.inputLabel}>Valor inicial (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={valor}
                    onChangeText={setValor}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#aaa"
                  />

                  <Text style={styles.inputLabel}>Meta (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={meta}
                    onChangeText={setMeta}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#aaa"
                  />
                </>
              )}

              {(modoModal === "depositar" || modoModal === "retirar") && (
                <>
                  <Text style={styles.inputLabel}>Valor</Text>
                  <TextInput
                    style={styles.input}
                    value={valor}
                    onChangeText={setValor}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#aaa"
                  />
                  <Text style={styles.hint}>
                    {modoModal === "depositar"
                      ? `Disponível no caixa geral: R$ ${formatoMoeda.format(
                          saldoDisponivel || 0
                        )}`
                      : `Na caixinha: R$ ${formatoMoeda.format(
                          Number(caixinhaSel?.valor) || 0
                        )}`}
                  </Text>
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
                  onPress={confirmar}
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
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
  },

  balanceCard: {
    backgroundColor: "#1f2933",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa3ad",
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 30,
    fontFamily: "Roboto-Bold",
    color: "#fff",
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  balanceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  miniLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#8b949e",
    marginBottom: 3,
  },
  miniValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#e8eef4",
  },

  sectionTitle: {
    fontSize: 16,
    fontFamily: "Roboto-Medium",
    color: "#222",
    marginBottom: 12,
  },

  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#eef1f4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemCenter: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemValue: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
  },

  metaBox: {
    marginTop: 12,
  },
  metaTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "#eef1f4",
    overflow: "hidden",
  },
  metaFill: {
    height: "100%",
    borderRadius: 6,
  },

  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#f4f5f7",
  },
  actionText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#333",
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
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Roboto-Bold",
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
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#777",
    marginBottom: 4,
  },
  input: {
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#222",
    marginBottom: 12,
    backgroundColor: "#f4f5f7",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
    marginTop: -4,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
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
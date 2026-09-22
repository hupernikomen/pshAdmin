import { useContext, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

const PAPEIS = [
  { id: "admin", label: "Admin" },
  { id: "tesoureiro", label: "Tesoureiro" },
  { id: "leitura", label: "Leitura" },
];

export default function Membros() {
  const {
    igrejaAtiva,
    listarMembros,
    adicionarMembro,
    atualizarPapelMembro,
    removerMembro,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const [membros, setMembros] = useState([]);
  const [load, setLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("tesoureiro");
  const [salvando, setSalvando] = useState(false);

  const isAdmin = igrejaAtiva?.papel === "admin";

  const carregar = useCallback(async () => {
    try {
      const lista = await listarMembros();
      setMembros(lista || []);
    } catch (e) {
      console.log("Erro listarMembros:", e);
      Alert.alert("Erro", "Não foi possível carregar os membros.");
    } finally {
      setLoad(false);
      setRefreshing(false);
    }
  }, [listarMembros]);

  useEffect(() => {
    carregar();
  }, [igrejaAtiva?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    carregar();
  };

  function abrirNovo() {
    if (!isAdmin) {
      Alert.alert("Sem permissão", "Apenas administradores.");
      return;
    }
    setEmail("");
    setPapel("tesoureiro");
    setModalVisible(true);
  }

  async function salvarMembro() {
    try {
      setSalvando(true);
      await adicionarMembro({ email, papel });
      setModalVisible(false);
      await carregar();
      Alert.alert("Sucesso", "Membro cadastrado.");
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarRemover(item) {
    if (!isAdmin) return;
    if (item.id === igrejaAtiva?.membroId) {
      Alert.alert("Atenção", "Você não pode remover a si mesmo por aqui.");
      return;
    }
    Alert.alert(
      "Remover membro",
      `Remover ${item.email} desta igreja?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await removerMembro(item.id);
              await carregar();
            } catch (e) {
              Alert.alert("Erro", e?.message || "Falha ao remover.");
            }
          },
        },
      ]
    );
  }

  function alterarPapel(item) {
    if (!isAdmin) return;
    if (item.id === igrejaAtiva?.membroId) {
      Alert.alert("Atenção", "Altere o papel de outro admin com cuidado.");
    }

    Alert.alert(
      "Alterar papel",
      item.email,
      PAPEIS.map((p) => ({
        text: p.label + (item.papel === p.id ? " ✓" : ""),
        onPress: async () => {
          try {
            await atualizarPapelMembro(item.id, p.id);
            await carregar();
          } catch (e) {
            Alert.alert("Erro", e?.message || "Falha ao atualizar.");
          }
        },
      })).concat([{ text: "Cancelar", style: "cancel" }])
    );
  }

  function labelPapel(p) {
    return PAPEIS.find((x) => x.id === p)?.label || p || "—";
  }

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.igrejaNome}>{igrejaAtiva?.nome || "Igreja"}</Text>
        <Text style={styles.igrejaSub}>
          {membros.length} membro{membros.length === 1 ? "" : "s"}
        </Text>
      </View>

      <FlatList
        data={membros}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.principal]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum membro cadastrado.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.papel}>{labelPapel(item.papel)}</Text>
              {!item.uid && (
                <Text style={styles.pendente}>Ainda não entrou no app</Text>
              )}
            </View>

            {isAdmin && (
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => alterarPapel(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="shield-outline" size={20} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmarRemover(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#C62828" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.principal }]}
          onPress={abrirNovo}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add-outline" size={22} color="#fff" />
          <Text style={styles.fabText}>Cadastrar e-mail</Text>
        </TouchableOpacity>
      )}

      {!isAdmin && (
        <Text style={styles.somenteLeitura}>
          Apenas administradores gerenciam membros.
        </Text>
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
            <Pressable style={styles.modal} onPress={() => {}}>
              <Text style={styles.modalTitle}>Novo membro</Text>
              <Text style={styles.modalSub}>
                Use o mesmo e-mail da conta Google da pessoa.
              </Text>

              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@gmail.com"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.label}>Papel</Text>
              <View style={styles.segment}>
                {PAPEIS.map((p) => {
                  const ativo = papel === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.segmentBtn,
                        ativo && { backgroundColor: colors.principal },
                      ]}
                      onPress={() => setPapel(p.id)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          ativo && { color: "#fff" },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnOk,
                    { backgroundColor: colors.principal },
                    salvando && { opacity: 0.7 },
                  ]}
                  onPress={salvarMembro}
                  disabled={salvando}
                >
                  <Text style={styles.btnOkText}>
                    {salvando ? "Salvando..." : "Salvar"}
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
  headerInfo: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  igrejaNome: {
    fontSize: 18,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
  },
  igrejaSub: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#888",
  },
  list: { paddingHorizontal: 18, paddingBottom: 100 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  email: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  papel: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#666",
  },
  pendente: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#e6a23c",
  },
  actions: { flexDirection: "row", gap: 16, marginLeft: 12 },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
    fontFamily: "Roboto-Regular",
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
  somenteLeitura: {
    textAlign: "center",
    padding: 16,
    color: "#888",
    fontFamily: "Roboto-Regular",
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
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
  label: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#777",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f4f5f7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f4f5f7",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
    color: "#555",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
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
    borderRadius: 12,
    alignItems: "center",
  },
  btnOkText: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#fff",
  },
});
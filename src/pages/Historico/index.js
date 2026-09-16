import { useContext, useEffect, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  StyleSheet,
  Image,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
  Platform,
  PermissionsAndroid,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import RNFS from "react-native-fs";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

function normalizarUri(uri) {
  if (!uri) return null;
  if (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("http")
  ) {
    return uri;
  }
  return `file://${uri}`;
}

function caminhoSemPrefixo(uri) {
  if (!uri) return null;
  return uri.replace("file://", "");
}

function textoOrigem(item) {
  if (item.tipoMovimento !== "saida") return null;

  if (item.origemPagamento === "caixinha") {
    return item.caixinhaNome || "Caixinha";
  }
  if (item.origemPagamento === "geral") {
    return "Caixa geral";
  }

  const pagos = item.valoresPagos || [];
  if (pagos.length > 0) {
    const ultimo = pagos[pagos.length - 1];
    if (ultimo?.origemPagamento === "caixinha") {
      return ultimo.caixinhaNome || "Caixinha";
    }
    if (ultimo?.origemPagamento === "geral") {
      return "Caixa geral";
    }
  }

  return null;
}

export default function Historico() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoad(true);
    await HistoricoMovimentos();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  async function pedirPermissaoLeitura() {
    if (Platform.OS !== "android") return true;

    try {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }

  async function abrirRecibo(reciboUrl) {
    if (!reciboUrl) return;

    const ok = await pedirPermissaoLeitura();
    if (!ok) {
      Alert.alert(
        "Permissão negada",
        "Precisamos de acesso às imagens para abrir o recibo."
      );
      return;
    }

    const uri = normalizarUri(reciboUrl);
    const path = caminhoSemPrefixo(uri);

    try {
      const existe = await RNFS.exists(path);
      if (!existe) {
        Alert.alert(
          "Recibo não encontrado",
          "O arquivo da foto não está mais neste aparelho."
        );
        return;
      }
      setFotoSelecionada(uri);
    } catch (e) {
      setFotoSelecionada(uri);
    }
  }

  const sortedRegistros = dadosFinancas
    ? [...dadosFinancas].sort((a, b) => (b.reg || 0) - (a.reg || 0))
    : [];

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedRegistros}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={28} color="#9aa3ad" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum registro</Text>
            <Text style={styles.emptyText}>
              Quando houver movimentações, elas aparecem aqui.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.principal]}
          />
        }
        renderItem={({ item }) => {
          const isEntrada = item.tipoMovimento === "entrada";
          const valor =
            item.valorRecebidoTotal ||
            item.valorPagoTotal ||
            item.valorTotal ||
            0;

          const temParcial =
            item.valorTotal &&
            (item.valorRecebidoTotal || item.valorPagoTotal) &&
            item.valorTotal !==
              (item.valorRecebidoTotal || item.valorPagoTotal);

          const quitado = item.status === "quitada";
          const temRecibo = !!item.reciboUrl;
          const origem = textoOrigem(item);

          const tint = isEntrada ? "#E8F5E9" : "#FFEBEE";
          const iconColor = isEntrada ? "#2E7D32" : "#C62828";
          const iconName = isEntrada
            ? "arrow-down-outline"
            : "arrow-up-outline";

          return (
            <View style={styles.itemCard}>
              <View style={[styles.iconCircle, { backgroundColor: tint }]}>
                <Ionicons name={iconName} size={18} color={iconColor} />
              </View>

              <View style={styles.itemCenter}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.descricao || "Sem descrição"}
                </Text>

                <Text style={styles.itemSub} numberOfLines={1}>
                  {item.data
                    ? new Date(item.data).toLocaleDateString("pt-BR")
                    : "-"}
                  {"  ·  "}
                  {item.tipo || "Sem tipo"}
                  {"  ·  "}
                  {quitado ? "Quitado" : "Aberto"}
                </Text>

                {!!origem && (
                  <Text style={styles.itemOrigem}>Pago com: {origem}</Text>
                )}

                {temParcial && (
                  <Text style={styles.itemParcial}>
                    Total {formatoMoeda.format(item.valorTotal)} · Pago{" "}
                    {formatoMoeda.format(
                      item.valorRecebidoTotal || item.valorPagoTotal || 0
                    )}
                  </Text>
                )}
              </View>

              <View style={styles.itemRight}>
                <Text
                  style={[
                    styles.itemValue,
                    { color: isEntrada ? "#2E7D32" : "#C62828" },
                  ]}
                >
                  {isEntrada ? "+" : "−"} {formatoMoeda.format(valor)}
                </Text>

                {temRecibo && (
                  <TouchableOpacity
                    style={styles.reciboBtn}
                    onPress={() => abrirRecibo(item.reciboUrl)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="image-outline" size={14} color="#6b7280" />
                    <Text style={styles.reciboText}>Recibo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={!!fotoSelecionada}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoSelecionada(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFotoSelecionada(null)}
        >
          <View style={styles.modalContent}>
            {!!fotoSelecionada && (
              <Image
                source={{ uri: fotoSelecionada }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.principal }]}
              onPress={() => setFotoSelecionada(null)}
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 36,
  },

  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemCenter: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  itemOrigem: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "Roboto-Medium",
    color: "#6b7280",
  },
  itemParcial: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemValue: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
  },
  reciboBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reciboText: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#6b7280",
  },

  emptyContainer: {
    marginTop: 80,
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
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "75%",
    borderRadius: 12,
  },
  closeBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Roboto-Bold",
  },
});
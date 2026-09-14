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
import RNFS from "react-native-fs";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

function normalizarUri(uri) {
  if (!uri) return null;
  if (uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("http")) {
    return uri;
  }
  return `file://${uri}`;
}

function caminhoSemPrefixo(uri) {
  if (!uri) return null;
  return uri.replace("file://", "");
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
      console.log("Erro permissão leitura:", e);
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
      console.log("Erro ao abrir recibo:", e);
      // tenta abrir mesmo assim
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
            <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
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

          const temRecibo = !!item.reciboUrl;
          const reciboUri = normalizarUri(item.reciboUrl);

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeWrap}>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: isEntrada
                          ? colors.principal
                          : colors.destaque,
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {item.tipo?.toUpperCase() || "SEM TIPO"}
                    </Text>
                  </View>

                  <Text style={styles.movimentoLabel}>
                    {isEntrada ? "Entrada" : "Saída"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.valor,
                    {
                      color: isEntrada ? colors.principal : colors.destaque,
                    },
                  ]}
                >
                  {isEntrada ? "+" : "-"} R$ {formatoMoeda.format(valor)}
                </Text>
              </View>

              <Text style={styles.descricao} numberOfLines={2}>
                {item.descricao || "Sem descrição"}
              </Text>

              {!!item.observacao && (
                <Text style={styles.observacao} numberOfLines={2}>
                  {item.observacao}
                </Text>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.data}>
                  {item.data
                    ? new Date(item.data).toLocaleDateString("pt-BR")
                    : "-"}
                </Text>

                <Text
                  style={[
                    styles.status,
                    {
                      color:
                        item.status === "quitada"
                          ? colors.principal
                          : colors.destaque,
                    },
                  ]}
                >
                  {item.status === "quitada" ? "Quitado" : "Aberto"}
                </Text>
              </View>

              {temParcial && (
                <Text style={styles.parcial}>
                  Total: R$ {formatoMoeda.format(item.valorTotal)} · Pago: R${" "}
                  {formatoMoeda.format(
                    item.valorRecebidoTotal || item.valorPagoTotal || 0
                  )}
                </Text>
              )}

              {temRecibo && (
                <TouchableOpacity
                  style={styles.reciboBtn}
                  onPress={() => abrirRecibo(item.reciboUrl)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: reciboUri }}
                    style={styles.reciboThumb}
                  />
                  <Text style={[styles.reciboText, { color: colors.principal }]}>
                    Ver recibo
                  </Text>
                </TouchableOpacity>
              )}
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
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Roboto-Bold",
  },
  movimentoLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    color: "#888",
  },
  valor: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  descricao: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#222",
    marginBottom: 4,
  },
  observacao: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#777",
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  data: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#999",
  },
  status: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
  },
  parcial: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#666",
  },
  reciboBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reciboThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#f2f2f0",
  },
  reciboText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#888",
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
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
});
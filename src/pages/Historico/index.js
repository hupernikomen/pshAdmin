import { useContext, useEffect, useMemo, useState } from "react";
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
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import RNFS from "react-native-fs";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";
import { podeEditarRegistro } from "../../utils/registroEdit";

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
  if (item.tipoMovimento !== "saida" && item.kind !== "pagamento") return null;

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

function montarLinhasHistorico(dadosFinancas) {
  const linhas = [];

  (dadosFinancas || []).forEach((item) => {
    const sortBase = item.reg || item.data || item.createdAt || 0;

    linhas.push({
      ...item,
      kind: "registro",
      rowId: item.id,
      sortKey: sortBase,
    });

    (item.valoresPagos || []).forEach((p, idx) => {
      linhas.push({
        kind: "pagamento",
        rowId: `${item.id}_pag_${p.id || idx}`,
        id: item.id,
        tipoMovimento: "saida",
        tipo: item.tipo || "Pagamento",
        descricao: item.descricao || item.tipo || "Despesa",
        data: p.data || sortBase,
        valorTotal: p.valor,
        valorPagoTotal: p.valor,
        status: "quitada",
        origemPagamento: p.origemPagamento || item.origemPagamento || null,
        caixinhaNome: p.caixinhaNome || item.caixinhaNome || null,
        caixinhaId: p.caixinhaId || item.caixinhaId || null,
        registroPaiId: item.id,
        reg: p.data || sortBase,
        sortKey: p.data || sortBase,
        createdAt: p.data || sortBase,
        reciboUrl: null,
      });
    });

    (item.valoresRecebidos || []).forEach((p, idx) => {
      linhas.push({
        kind: "recebimento",
        rowId: `${item.id}_rec_${p.id || idx}`,
        id: item.id,
        tipoMovimento: "entrada",
        tipo: item.tipo || "Recebimento",
        descricao: item.descricao || item.tipo || "Receita",
        data: p.data || sortBase,
        valorTotal: p.valor,
        valorRecebidoTotal: p.valor,
        status: "quitada",
        registroPaiId: item.id,
        reg: p.data || sortBase,
        sortKey: p.data || sortBase,
        createdAt: p.data || sortBase,
        reciboUrl: null,
      });
    });
  });

  return linhas.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
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
  const navigation = useNavigation();
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

  const linhas = useMemo(
    () => montarLinhasHistorico(dadosFinancas),
    [dadosFinancas]
  );

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={linhas}
        keyExtractor={(item) => item.rowId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
          const isPagamento = item.kind === "pagamento";
          const isRecebimento = item.kind === "recebimento";
          const isParcela = isPagamento || isRecebimento;
          const isEntrada = item.tipoMovimento === "entrada";

          const valor =
            item.valorRecebidoTotal ||
            item.valorPagoTotal ||
            item.valorTotal ||
            0;

          const temParcial =
            !isParcela &&
            item.valorTotal &&
            (item.valorRecebidoTotal || item.valorPagoTotal) &&
            item.valorTotal !==
              (item.valorRecebidoTotal || item.valorPagoTotal);

          const quitado = item.status === "quitada";
          const temRecibo = !!item.reciboUrl && !isParcela;
          const origem = textoOrigem(item);
          const editavel = !isParcela && podeEditarRegistro(item);

          const badgeLabel = isPagamento
            ? "Pagamento"
            : isRecebimento
            ? "Recebimento"
            : isEntrada
            ? "Entrada"
            : "Saída";

          const badgeBg = isEntrada ? "#E8F5E9" : "#FFEBEE";
          const badgeColor = isEntrada ? "#2E7D32" : "#C62828";

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={editavel ? 0.75 : 1}
              disabled={!editavel}
              onPress={() => {
                if (editavel) {
                  navigation.navigate("EditarRegistro", { id: item.id });
                }
              }}
            >
              {/* Linha 1: badge + valor */}
              <View style={styles.topRow}>
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.badgeText, { color: badgeColor }]}>
                    {badgeLabel}
                  </Text>
                </View>

                <Text style={[styles.valor, { color: badgeColor }]}>
                  {isEntrada ? "+" : "−"} {formatoMoeda.format(valor)}
                </Text>
              </View>

              {/* Linha 2: descrição */}
              <Text style={styles.descricao} numberOfLines={2}>
                {item.descricao || "Sem descrição"}
              </Text>

              {/* Linha 3: meta */}
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {item.data
                    ? new Date(item.data).toLocaleDateString("pt-BR")
                    : "-"}
                </Text>

                {!isParcela && (
                  <>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.meta}>{item.tipo || "Sem tipo"}</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text
                      style={[
                        styles.meta,
                        { color: quitado ? colors.principal : "#e6a23c" },
                      ]}
                    >
                      {quitado ? "Quitado" : "Aberto"}
                    </Text>
                  </>
                )}

                {isParcela && item.tipo ? (
                  <>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.meta}>{item.tipo}</Text>
                  </>
                ) : null}
              </View>

              {/* Extras só se existirem */}
              {!!origem && (
                <Text style={styles.extra}>Pago com: {origem}</Text>
              )}

              {temParcial && (
                <Text style={styles.extra}>
                  Total {formatoMoeda.format(item.valorTotal)} · Pago{" "}
                  {formatoMoeda.format(
                    item.valorRecebidoTotal || item.valorPagoTotal || 0
                  )}
                </Text>
              )}

              {/* Ações */}
              {(temRecibo || editavel) && (
                <View style={styles.actions}>
                  {temRecibo && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => abrirRecibo(item.reciboUrl)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="image-outline" size={15} color="#666" />
                      <Text style={styles.actionText}>Recibo</Text>
                    </TouchableOpacity>
                  )}

                  {editavel && (
                    <View style={styles.actionBtn}>
                      <Ionicons
                        name="create-outline"
                        size={15}
                        color={colors.principal}
                      />
                      <Text
                        style={[styles.actionText, { color: colors.principal }]}
                      >
                        Editar
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Roboto-Medium",
  },
  valor: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },

  descricao: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
    marginBottom: 6,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#8a8f98",
  },
  dot: {
    marginHorizontal: 6,
    color: "#ccc",
    fontSize: 12,
  },

  extra: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#6b7280",
  },

  actions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    flexDirection: "row",
    gap: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
    color: "#666",
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
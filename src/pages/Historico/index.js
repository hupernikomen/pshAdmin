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
  ScrollView,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import RNFS from "react-native-fs";
import { AppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import Load from "../../componentes/Load";
import { podeEditarRegistro } from "../../utils/registroEdit";

const LIMITES = [30, 60, 90, 150];

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
    const pagos = item.valoresPagos || [];
    const recebidos = item.valoresRecebidos || [];

    linhas.push({
      ...item,
      kind: "registro",
      rowId: item.id,
      sortKey: sortBase,
    });

    if (pagos.length > 1) {
      const totalParcelas =
        item.quantidadeParcelas ||
        (Array.isArray(item.parcelas) ? item.parcelas.length : null);

      pagos.slice(1).forEach((p, idx) => {
        linhas.push({
          kind: "pagamento",
          rowId: `${item.id}_pag_${p.id || idx + 1}`,
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
          parcelaNumero: p.parcelaNumero || null,
          parcelaTotal: totalParcelas,
          registroPaiId: item.id,
          reg: p.data || sortBase,
          sortKey: p.data || sortBase,
          createdAt: p.data || sortBase,
          reciboUrl: null,
        });
      });
    }

    if (recebidos.length > 1) {
      recebidos.slice(1).forEach((p, idx) => {
        linhas.push({
          kind: "recebimento",
          rowId: `${item.id}_rec_${p.id || idx + 1}`,
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
    }
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
    podeEditarFinanceiro,
  } = useContext(AppContext);

  const { uid, authPronto } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);
  const [limite, setLimite] = useState(30);

  useEffect(() => {
    if (!authPronto) return;
    if (!uid) return;
    carregarDados();
  }, [authPronto, uid]);

  async function carregarDados() {
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

  const linhasLimitadas = useMemo(
    () => linhas.slice(0, limite),
    [linhas, limite]
  );

  const podeEditarPapel = podeEditarFinanceiro?.() !== false;

  if ((!authPronto || load) && !refreshing) return <Load />

  return (
    <View style={styles.container}>

      <FlatList
        data={linhasLimitadas}
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
              {!uid
                ? "Faça login para ver seus registros."
                : "Quando houver movimentações, elas aparecem aqui."}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.filtroWrap}>
            <Text style={styles.filtroLabel}>Mostrar</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtroRow}
            >
              {LIMITES.map((n) => {
                const ativo = limite === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.filtroChip,
                      ativo && { backgroundColor: colors.principal },
                    ]}
                    onPress={() => setLimite(n)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filtroChipText,
                        ativo && { color: "#fff" },
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

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
          const isParcelaLinha = isPagamento || isRecebimento;
          const isEntrada = item.tipoMovimento === "entrada";

          const textoParcela =
            item.parcelaNumero != null
              ? item.parcelaTotal
                ? `Parcela ${item.parcelaNumero}/${item.parcelaTotal}`
                : `Parcela ${item.parcelaNumero}`
              : null;

          const isParcela = isPagamento || isRecebimento;

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

          const temRecibo = !!item.reciboUrl && !isParcela;
          const origem = textoOrigem(item);

          const editavel =
            podeEditarPapel && !isParcela && podeEditarRegistro(item);


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
              <View style={styles.topRow}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                  }}
                >

                  <Text style={styles.meta}>
                    {item.data
                      ? new Date(item.data).toLocaleDateString("pt-BR")
                      : "-"}
                  </Text>
                </View>

                <Text style={[styles.valor, { color: badgeColor }]}>
                  {isEntrada ? "+" : "-"} {formatoMoeda.format(valor)}
                </Text>
              </View>

              <Text style={styles.descricao} numberOfLines={2}>
                {item.descricao || "Sem descrição"}
              </Text>

              <View style={styles.metaRow}>
                {isParcelaLinha && (
                  <Text style={styles.meta}>
                    {textoParcela || item.tipo || "Pagamento"}
                  </Text>
                )}
              </View>

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
                      <Ionicons name="create-outline" size={15} />
                      <Text style={styles.actionText}>Editar</Text>
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
  filtroWrap: {
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#f4f5f7",
  },
  filtroLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 8,
  },
  filtroRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  filtroChipText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#333",
  },
  filtroInfo: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: "Roboto-Regular",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
    marginBottom: 7,
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
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  descricao: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 13,
    fontFamily: "Roboto-Light",
    color: '#000'
  },
  extra: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Roboto-Light",
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
    fontFamily: "Roboto-Light",
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
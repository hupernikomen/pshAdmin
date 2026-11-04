import { useContext, useMemo, useState } from "react";
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
  ScrollView,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import RNFS from "react-native-fs";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { podeEditarRegistro } from "../utils/registroEdit";

const LIMITES = [5, 30, 100, 150];

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
    return "Caixa livre";
  }

  const pagos = item.valoresPagos || [];
  if (pagos.length > 0) {
    const ultimo = pagos[pagos.length - 1];
    if (ultimo?.origemPagamento === "caixinha") {
      return ultimo.caixinhaNome || "Caixinha";
    }
    if (ultimo?.origemPagamento === "geral") {
      return "Caixa livre";
    }
  }

  return null;
}

function ehSaidaParcelada(item, parcelas) {
  if (item?.tipoMovimento !== "saida") return false;
  if (Array.isArray(parcelas) && parcelas.length > 1) return true;
  if ((Number(item.quantidadeParcelas) || 0) > 1) return true;
  return false;
}

function montarLinhasHistorico(dadosFinancas) {
  const linhas = [];

  (dadosFinancas || []).forEach((item) => {
    if (item.tipo === "Saldo inicial") return;

    const sortBase = Number(item.data || item.reg || item.createdAt || 0) || 0;
    const createdAtPai = Number(item.createdAt || item.reg || sortBase) || 0;
    const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
    const recebidos = Array.isArray(item.valoresRecebidos)
      ? item.valoresRecebidos
      : [];
    const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];

    const totalParcelasRaw =
      Number(item.quantidadeParcelas) ||
      (parcelas.length > 0 ? parcelas.length : 0);
    const isParcelada = totalParcelasRaw > 1;
    const totalParcelas = isParcelada ? totalParcelasRaw : null;

    if (item.tipoMovimento === "saida" && pagos.length > 0) {
      pagos.forEach((p, idx) => {
        const tsPag = Number(p.data || sortBase) || sortBase;
        const nParc = isParcelada
          ? p.parcelaNumero != null
            ? p.parcelaNumero
            : idx + 1
          : null;

        linhas.push({
          kind: "pagamento",
          rowId: `${item.id}_pag_${p.id || idx}`,
          id: item.id,
          tipoMovimento: "saida",
          tipo: item.tipo || "Pagamento",
          descricao: item.descricao || item.tipo || "Despesa",
          data: tsPag,
          valorTotal: Number(p.valor) || 0,
          valorPagoTotal: Number(p.valor) || 0,
          status: "quitada",
          observacao: item.observacao || null,
          origemPagamento: p.origemPagamento || item.origemPagamento || null,
          caixinhaNome: p.caixinhaNome || item.caixinhaNome || null,
          caixinhaId: p.caixinhaId || item.caixinhaId || null,
          parcelaNumero: nParc,
          parcelaTotal: totalParcelas,
          registroPaiId: item.id,
          reg: createdAtPai,
          sortKey: tsPag,
          createdAt: createdAtPai,
          reciboUrl: item.reciboUrl || null,
        });
      });
      return;
    }

    if (item.tipoMovimento === "saida" && parcelas.length > 0) {
      const pagas = parcelas.filter(
        (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
      );
      if (pagas.length > 0) {
        pagas.forEach((p, idx) => {
          const tsPag =
            Number(p.dataPagamento || p.pagoEm || p.data || sortBase) ||
            sortBase;
          linhas.push({
            kind: "pagamento",
            rowId: `${item.id}_parc_${p.numero || p.id || idx}`,
            id: item.id,
            tipoMovimento: "saida",
            tipo: item.tipo || "Pagamento",
            descricao: item.descricao || item.tipo || "Despesa",
            data: tsPag,
            valorTotal: Number(p.valor) || 0,
            valorPagoTotal: Number(p.valor) || 0,
            status: "quitada",
            observacao: item.observacao || null,
            origemPagamento: p.origemPagamento || item.origemPagamento || null,
            caixinhaNome: p.caixinhaNome || item.caixinhaNome || null,
            caixinhaId: p.caixinhaId || item.caixinhaId || null,
            parcelaNumero: isParcelada
              ? p.numero != null
                ? p.numero
                : idx + 1
              : null,
            parcelaTotal: totalParcelas,
            registroPaiId: item.id,
            reg: createdAtPai,
            sortKey: tsPag,
            createdAt: createdAtPai,
            reciboUrl: item.reciboUrl || null,
          });
        });
        return;
      }
    }

    if (ehSaidaParcelada(item, parcelas)) {
      return;
    }

    if (item.tipoMovimento === "entrada" && recebidos.length > 0) {
      recebidos.forEach((p, idx) => {
        const tsRec = Number(p.data || sortBase) || sortBase;
        linhas.push({
          kind: "recebimento",
          rowId: `${item.id}_rec_${p.id || idx}`,
          id: item.id,
          tipoMovimento: "entrada",
          tipo: item.tipo || "Recebimento",
          descricao: item.descricao || item.tipo || "Receita",
          data: tsRec,
          observacao: item.observacao || null,
          valorTotal: Number(p.valor) || 0,
          valorRecebidoTotal: Number(p.valor) || 0,
          status: "quitada",
          registroPaiId: item.id,
          reg: createdAtPai,
          sortKey: tsRec,
          createdAt: createdAtPai,
          reciboUrl: item.reciboUrl || null,
        });
      });
      return;
    }

    linhas.push({
      ...item,
      kind: "registro",
      rowId: item.id,
      sortKey: sortBase,
      createdAt: createdAtPai,
      observacao: item.observacao || null,
      reg: createdAtPai,
      parcelaNumero: null,
      parcelaTotal: null,
    });
  });

  return linhas.sort((a, b) => {
    const da = Number(a.sortKey || a.data || a.reg || 0) || 0;
    const db = Number(b.sortKey || b.data || b.reg || 0) || 0;
    if (db !== da) return db - da;
    return String(b.rowId || "").localeCompare(String(a.rowId || ""));
  });
}

export default function Historico() {
  const {
    dadosFinancas,
    load,
    financasProntas,
    HistoricoMovimentos,
    formatoMoeda,
    podeEditarFinanceiro,
  } = useContext(AppContext);

  const { showAlert } = useAppAlert();
  const { uid, authPronto } = useAuth();
  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);
  const [limite, setLimite] = useState(5); // Iniciando em 5
  const [abertoId, setAbertoId] = useState(null);

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const border = colors.border;

  const onRefresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  async function abrirRecibo(reciboUrl) {
    if (!reciboUrl) return;
    const uri = normalizarUri(reciboUrl);
    const path = caminhoSemPrefixo(uri);
    try {
      const existe = await RNFS.exists(path);
      if (!existe) {
        showAlert({
          title: "Recibo não encontrado",
          message: "O arquivo da foto não está mais neste aparelho.",
        });
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

  if (!authPronto) return <Load />;
  if (!financasProntas && !refreshing) return <Load />;
  if (load && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={linhasLimitadas}
        keyExtractor={(item) => item.rowId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: card }]}>
              <Ionicons name="receipt-outline" size={28} color={muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: text }]}>
              Nenhum registro
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              {!uid
                ? "Faça login para ver seus registros."
                : "Quando houver movimentações, elas aparecem aqui."}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.filtroContainer}>
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
                      { backgroundColor: card, borderColor: border },
                      ativo && { backgroundColor: principal, borderColor: principal },
                    ]}
                    onPress={() => setLimite(n)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filtroChipText,
                        { color: text },
                        ativo && { color: "#fff", fontFamily: "Roboto-Bold" },
                      ]}
                    >
                      Últimos {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        // AVISO NO RODAPÉ: Só exibe se o limite atual for 7 e houver mais dados para mostrar
        ListFooterComponent={
          limite === 5 && linhas.length > 5 ? (
            <View style={styles.footerAviso}>
              <Text style={[styles.footerAvisoText, { color: text }]}>
                Exibindo apenas os 5 registros mais recentes. Selecione 30, 100 ou 150 acima para ver mais dados.
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        renderItem={({ item }) => {
          const isEntrada = item.tipoMovimento === "entrada";

          const textoParcela =
            item.parcelaNumero != null &&
            item.parcelaTotal != null &&
            item.parcelaTotal > 1
              ? `Parcela ${item.parcelaNumero}/${item.parcelaTotal}`
              : null;

          const valor =
            item.valorRecebidoTotal ||
            item.valorPagoTotal ||
            item.valorTotal ||
            0;

          const temRecibo = !!item.reciboUrl;
          const origem = textoOrigem(item);
          const editavel = podeEditarPapel && podeEditarRegistro(item);

          const dataStr = item.data
            ? new Date(item.data).toLocaleDateString("pt-BR")
            : "-";

          const obsLimpa = item.observacao
            ? String(item.observacao).trim().replace(/\n/g, " ")
            : null;

          const partesSub = [
            dataStr,
            item.tipo,
            textoParcela,
            origem ? `Pago: ${origem}` : null,
            obsLimpa ? `${obsLimpa}` : null,
          ].filter(Boolean);

          const actions = [];

          if (temRecibo) {
            actions.push({
              key: "recibo",
              icon: "image-outline",
              label: "Recibo",
              backgroundColor: "#6b7280",
              onPress: () => abrirRecibo(item.reciboUrl),
            });
          }

          if (editavel) {
            actions.push({
              key: "edit",
              icon: "create-outline",
              label: "Editar",
              backgroundColor: "#1976D2",
              onPress: () =>
                navigation.navigate("EditarRegistro", { id: item.id }),
            });
          }

          const tintEntrada = dark ? "#1B3D2F" : "#E8F5E9";
          const tintSaida = dark ? "#3D1B1B" : "#FFEBEE";
          const iconEntrada = dark ? "#81C784" : "#2E7D32";
          const iconSaida = dark ? "#E57373" : "#C62828";

          return (
            <SwipeCard
              hasRecibo={temRecibo}
              canEdit={editavel}
              icon={isEntrada ? "arrow-down-outline" : "arrow-up-outline"}
              iconColor={isEntrada ? iconEntrada : iconSaida}
              tint={isEntrada ? tintEntrada : tintSaida}
              title={item.descricao || "Sem descrição"}
              subtitle={partesSub.join(" · ")}
              value={`${isEntrada ? "+" : "-"} ${formatoMoeda.format(valor)}`}
              actions={actions}
              open={abertoId === item.rowId}
              onOpenChange={(isOpen) =>
                setAbertoId(isOpen ? item.rowId : null)
              }
            />
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
              style={[styles.closeBtn, { backgroundColor: principal }]}
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
    paddingHorizontal: 14,
  },
  filtroContainer: {
    paddingVertical: 10,
  },
  filtroRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filtroChipText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
  },
  footerAviso: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  footerAvisoText: {
    fontSize: 13,
    fontFamily: "Roboto-Light",
    textAlign: "center",
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 100,
    gap: 8,
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
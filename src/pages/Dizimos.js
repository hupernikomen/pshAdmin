import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { arred, dataDoItem } from "../utils/financeiro";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function isDizimo(item) {
  const t = String(item?.tipo || "").toLowerCase();
  return t.includes("dizimo") || t.includes("dízimo");
}

function montarDizimosDoMes(lista, mes, ano) {
  const linhas = [];

  (lista || []).forEach((item) => {
    if (item?.tipoMovimento !== "entrada") return;
    if (!isDizimo(item)) return;

    const recebidos = Array.isArray(item.valoresRecebidos)
      ? item.valoresRecebidos
      : [];

    if (recebidos.length > 0) {
      recebidos.forEach((r, idx) => {
        const ts = Number(r.data || item.data || 0);
        if (!ts) return;
        const d = new Date(ts);
        if (d.getMonth() !== mes || d.getFullYear() !== ano) return;
        linhas.push({
          rowId: `${item.id}_rec_${r.id || idx}`,
          id: item.id,
          descricao: item.descricao || "Dízimo",
          data: ts,
          valor: Number(r.valor) || 0,
        });
      });
      return;
    }

    const ts = dataDoItem(item);
    if (!ts) return;
    const d = new Date(ts);
    if (d.getMonth() !== mes || d.getFullYear() !== ano) return;

    linhas.push({
      rowId: item.id,
      id: item.id,
      descricao: item.descricao || "Dízimo",
      data: ts,
      valor: Number(item.valorRecebidoTotal || item.valorTotal) || 0,
    });
  });

  return linhas.sort((a, b) => (b.data || 0) - (a.data || 0));
}

export default function Dizimos() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth());
  const [ano, setAno] = useState(agora.getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoad(true);
    await HistoricoMovimentos();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  const linhas = useMemo(
    () => montarDizimosDoMes(dadosFinancas, mes, ano),
    [dadosFinancas, mes, ano]
  );

  const totalMes = arred(linhas.reduce((acc, i) => acc + (i.valor || 0), 0));

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        data={linhas}
        keyExtractor={(item) => item.rowId}
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
          <View style={styles.header}>
            <View style={styles.anoRow}>
              <TouchableOpacity
                onPress={() => setAno((a) => a - 1)}
                style={styles.anoBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.anoText}>{ano}</Text>
              <TouchableOpacity
                onPress={() => setAno((a) => a + 1)}
                style={styles.anoBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-forward" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.mesesGrid}>
              {MESES_CURTO.map((label, idx) => {
                const ativo = mes === idx;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.mesChip,
                      ativo && { backgroundColor: colors.principal },
                    ]}
                    onPress={() => setMes(idx)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.mesText, ativo && { color: "#fff" }]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                {MESES[mes]} {ano}
              </Text>
              <Text style={styles.totalValue}>
                R$ {formatoMoeda.format(totalMes)}
              </Text>
              <Text style={styles.totalQtd}>
                {linhas.length} {linhas.length === 1 ? "registro" : "registros"}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeCard
            icon="hand-left-outline"
            iconColor="#1565C0"
            tint="#E3F2FD"
            title={item.descricao}
            subtitle={new Date(item.data).toLocaleDateString("pt-BR")}
            value={`R$ ${formatoMoeda.format(item.valor)}`}
            actions={[]}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="hand-left-outline" size={28} color="#9aa3ad" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum dízimo</Text>
            <Text style={styles.emptyText}>
              Não há dízimos registrados em {MESES[mes]} de {ano}.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14 },
  listContent: {
    paddingTop: 10,
    paddingBottom: 40,
    gap: 8,
  },
  header: {
    marginBottom: 8,
  },
  anoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  anoBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  anoText: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
    minWidth: 64,
    textAlign: "center",
  },
  mesesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  mesChip: {
    width: "22%",
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  mesText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
    color: "#333",
  },
  totalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#888",
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 22,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
    letterSpacing: -0.4,
  },
  totalQtd: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  emptyContainer: {
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
});
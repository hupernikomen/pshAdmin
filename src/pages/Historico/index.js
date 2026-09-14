import { useContext, useEffect, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  StyleSheet,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

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

  const sortedRegistros = dadosFinancas
    ? [...dadosFinancas].sort((a, b) => (b.reg || 0) - (a.reg || 0))
    : [];

  if (load && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sortedRegistros}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
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

          return (
            <View style={[styles.card, { backgroundColor: colors.neutro }]}>
              <View style={styles.cardHeader}>
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

              {item.valorTotal &&
                (item.valorRecebidoTotal || item.valorPagoTotal) &&
                item.valorTotal !==
                  (item.valorRecebidoTotal || item.valorPagoTotal) && (
                  <Text style={styles.parcial}>
                    Total: R$ {formatoMoeda.format(item.valorTotal)} | Pago: R${" "}
                    {formatoMoeda.format(
                      item.valorRecebidoTotal || item.valorPagoTotal || 0
                    )}
                  </Text>
                )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 10,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  valor: {
    fontSize: 16,
    fontWeight: "700",
  },
  descricao: {
    fontSize: 15,
    color: "#333",
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  data: {
    fontSize: 13,
    color: "#777",
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
  },
  parcial: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#888",
  },
});
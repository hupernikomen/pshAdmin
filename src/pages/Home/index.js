import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";
import { useTabBarVisibility } from "../../context/TabBarVisibility";

export default function Home() {
  const {
    saldo,
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const navigation = useNavigation();
  const { onScroll } = useTabBarVisibility();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            // exemplo: ir para Registro
            navigation.navigate("Registro");
          }}
          style={{ marginRight: 12, padding: 6 }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={colors.principal} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

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

  const lista = dadosFinancas || [];
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const entradasMesAtual = lista
    .filter((i) => {
      if (i.tipoMovimento !== "entrada" || !i.data) return false;
      const d = new Date(i.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0), 0);

  const saidasMesAtual = lista
    .filter((i) => {
      if (i.tipoMovimento !== "saida" || !i.data) return false;
      const d = new Date(i.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, i) => acc + (i.valorPagoTotal || i.valorTotal || 0), 0);

  const saldoAtual = saldo || 0;
  const saldoAnterior = saldoAtual - entradasMesAtual + saidasMesAtual;

  const entradasFuturas = lista
    .filter((i) => i.tipoMovimento === "entrada" && i.status === "aberta")
    .reduce((acc, i) => {
      const falta = (i.valorTotal || 0) - (i.valorRecebidoTotal || 0);
      return acc + (falta > 0 ? falta : 0);
    }, 0);

  const despesasFuturas = lista
    .filter((i) => i.tipoMovimento === "saida" && i.status === "aberta")
    .reduce((acc, i) => {
      const falta = (i.valorTotal || 0) - (i.valorPagoTotal || 0);
      return acc + (falta > 0 ? falta : 0);
    }, 0);

  const projecaoFutura = saldoAtual + entradasFuturas - despesasFuturas;
  const abertos = lista.filter((i) => i.status === "aberta").length;

  const dizimosMes = lista.filter((i) => {
    if (i.tipoMovimento !== "entrada" || i.tipo !== "Dízimo" || !i.data) {
      return false;
    }
    const d = new Date(i.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalDizimosMes = dizimosMes.reduce(
    (acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0),
    0
  );

  const mediaDizimosMes =
    dizimosMes.length > 0 ? totalDizimosMes / dizimosMes.length : 0;

  const resumoItens = useMemo(
    () => [
      {
        id: "1",
        label: "A receber",
        value: `R$ ${formatoMoeda.format(entradasFuturas)}`,
      },
      {
        id: "2",
        label: "A pagar",
        value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
      },
      {
        id: "3",
        label: "Média de dízimos (mês)",
        value: `R$ ${formatoMoeda.format(mediaDizimosMes)}`,
      },
      {
        id: "4",
        label: "Dízimos no mês",
        value: `R$ ${formatoMoeda.format(totalDizimosMes)}`,
      },
      {
        id: "5",
        label: "Registros pendentes",
        value: `${abertos}`,
      },
    ],
    [
      entradasFuturas,
      despesasFuturas,
      mediaDizimosMes,
      totalDizimosMes,
      abertos,
      formatoMoeda,
    ]
  );

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={resumoItens}
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
            <View style={styles.saldoCard}>
              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>Saldo Anterior</Text>
                <Text style={styles.saldoValorSecundario}>
                  R$ {formatoMoeda.format(saldoAnterior)}
                </Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>Saldo Atual</Text>
                <Text style={styles.saldoValorPrincipal}>
                  R$ {formatoMoeda.format(saldoAtual)}
                </Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>Projeção Futura</Text>
                <Text
                  style={[
                    styles.saldoValorSecundario,
                    {
                      color:
                        projecaoFutura >= 0
                          ? colors.principal
                          : colors.destaque,
                    },
                  ]}
                >
                  R$ {formatoMoeda.format(projecaoFutura)}
                </Text>
              </View>
            </View>

            <Text style={styles.infoTitle}>Resumo geral</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.infoRow,
              index === resumoItens.length - 1 && styles.infoRowLast,
            ]}
          >
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 20 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  saldoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    elevation: 1,
  },
  saldoItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  divisorVertical: {
    width: 1,
    height: 36,
    backgroundColor: "#ececec",
  },
  saldoLabel: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: "center",
    fontFamily: "Roboto-Light",
    color: "#888",
  },
  saldoValorPrincipal: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
    color: "#222",
  },
  saldoValorSecundario: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    textAlign: "center",
    color: "#333",
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#333",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
  },
  infoRow: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Light",
    color: "#555",
    flex: 1,
    paddingRight: 12,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#222",
    textAlign: "right",
  },
});
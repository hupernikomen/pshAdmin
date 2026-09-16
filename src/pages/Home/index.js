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
    saldoDisponivel,
    totalReservado,
    caixinhas,
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    CarregarCaixinhas,
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
          onPress={() => navigation.navigate("Registro")}
          style={{ marginRight: 12, padding: 6 }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-outline" size={24} color="#222" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function carregar() {
    setLoad(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
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

  const saldoAtual = Number(saldo) || 0;
  const caixaGeral = Number(saldoDisponivel) || 0;
  const emCaixinhas = Number(totalReservado) || 0;
  const qtdCaixinhas = (caixinhas || []).length;
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
        sub: "Valores em aberto",
        value: `R$ ${formatoMoeda.format(entradasFuturas)}`,
        icon: "arrow-down-outline",
        tint: "#E8F5E9",
        iconColor: "#2E7D32",
      },
      {
        id: "2",
        label: "A pagar",
        sub: "Despesas pendentes",
        value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
        icon: "arrow-up-outline",
        tint: "#FFEBEE",
        iconColor: "#C62828",
      },
      {
        id: "3",
        label: "Dízimos no mês",
        sub: "Total arrecadado",
        value: `R$ ${formatoMoeda.format(totalDizimosMes)}`,
        icon: "hand-left-outline",
        tint: "#E3F2FD",
        iconColor: "#1565C0",
      },
      {
        id: "4",
        label: "Média de dízimos",
        sub: "Por lançamento no mês",
        value: `R$ ${formatoMoeda.format(mediaDizimosMes)}`,
        icon: "stats-chart-outline",
        tint: "#FFF3E0",
        iconColor: "#EF6C00",
      },
      {
        id: "5",
        label: "Registros pendentes",
        sub: "Ainda em aberto",
        value: `${abertos}`,
        icon: "time-outline",
        tint: "#F3E5F5",
        iconColor: "#6A1B9A",
      },
    ],
    [
      entradasFuturas,
      despesasFuturas,
      totalDizimosMes,
      mediaDizimosMes,
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
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.principal]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Card de saldo */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo atual</Text>

              <Text style={styles.balanceValue}>
                R$ {formatoMoeda.format(saldoAtual)}
              </Text>

              <View style={styles.balanceBottom}>
                <View>
                  <Text style={styles.miniLabel}>Caixa geral</Text>
                  <Text style={styles.miniValue}>
                    R$ {formatoMoeda.format(caixaGeral)}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("Caixinhas")}
                  style={styles.caixinhasBtn}
                >
                  <View style={styles.caixinhasTitleRow}>
                    <Text style={styles.miniLabel}>Caixinhas</Text>
                    <Ionicons name="chevron-forward" size={14} color="#9aa3ad" />
                  </View>
                  <Text style={styles.miniValue}>
                    R$ {formatoMoeda.format(emCaixinhas)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chips secundários */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Anterior</Text>
                <Text style={styles.chipValue}>
                  R$ {formatoMoeda.format(saldoAnterior)}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Projeção</Text>
                <Text style={styles.chipValue}>
                  R$ {formatoMoeda.format(projecaoFutura)}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Ministérios</Text>
                <Text style={styles.chipValue}>{qtdCaixinhas}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Resumo geral</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={[styles.iconCircle, { backgroundColor: item.tint }]}>
              <Ionicons name={item.icon} size={18} color={item.iconColor} />
            </View>

            <View style={styles.itemCenter}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              <Text style={styles.itemSub}>{item.sub}</Text>
            </View>

            <Text style={styles.itemValue}>{item.value}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={<View style={{ height: 68 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },

  balanceCard: {
    backgroundColor: "#1f2933",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  balanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa3ad",
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

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  chipLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#8a8f98",
    marginBottom: 3,
  },
  chipValue: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#222",
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
    paddingVertical: 14,
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
  itemValue: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa3ad",
    marginBottom: 8,
  },
  caixinhasBtn: {
    alignItems: "flex-end",
  },
  caixinhasTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 3,
  },
});
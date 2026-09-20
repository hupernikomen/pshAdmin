import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
} from "react-native";

import { useNavigation, useTheme } from "@react-navigation/native";
import { AppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";

import Ionicons from "react-native-vector-icons/Ionicons";
import Load from "../../componentes/Load";
import Saldo from "../../componentes/Saldo";

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

  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const foto = user?.photoURL || null;
  const nome = user?.displayName || "Conta";
  const email = user?.email || "";

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuAberto(true)}
          style={{ marginRight: 16 }}
          activeOpacity={0.8}
        >
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, foto]);

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

  async function handleLogout() {
    setMenuAberto(false);
    try {
      await logout();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível sair.");
    }
  }

  const lista = dadosFinancas || [];
  const agora = new Date();
  const mesAtual = agora.getMonth(); // 0–11
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

  // Dízimos do mês vigente
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

  // Saldo inicial (início do período)
  const saldoInicialReg = lista.find(
    (i) => i.tipo === "Saldo inicial" && i.data
  );

  let mediaDizimosAnual = 0;

  if (saldoInicialReg) {
    const dSi = new Date(saldoInicialReg.data);
    const siAno = dSi.getFullYear();
    const siMes = dSi.getMonth(); // 0–11

    let meses =
      (anoAtual - siAno) * 12 + (mesAtual - siMes) + 1; // inclui mês atual

    if (meses < 1) meses = 1;

    const totalDizimosPeriodo = lista
      .filter((i) => {
        if (i.tipoMovimento !== "entrada" || i.tipo !== "Dízimo" || !i.data) {
          return false;
        }
        // dízimos a partir do mês do saldo inicial
        const d = new Date(i.data);
        const idx = d.getFullYear() * 12 + d.getMonth();
        const idxSi = siAno * 12 + siMes;
        return idx >= idxSi;
      })
      .reduce(
        (acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0),
        0
      );

    mediaDizimosAnual = totalDizimosPeriodo / meses;
  } else {
    // Sem saldo inicial: total do ano ÷ mês atual (1–12)
    const totalDizimosAno = lista
      .filter((i) => {
        if (i.tipoMovimento !== "entrada" || i.tipo !== "Dízimo" || !i.data) {
          return false;
        }
        const d = new Date(i.data);
        return d.getFullYear() === anoAtual;
      })
      .reduce(
        (acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0),
        0
      );

    const mesNumero = mesAtual + 1;
    mediaDizimosAnual = mesNumero > 0 ? totalDizimosAno / mesNumero : 0;
  }

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
        route: "AReceber",
      },
      {
        id: "2",
        label: "A pagar",
        sub: "Despesas pendentes",
        value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
        icon: "arrow-up-outline",
        tint: "#FFEBEE",
        iconColor: "#C62828",
        route: "APagar",
      },
      {
        id: "3",
        label: "Dízimos no mês",
        sub: "Arrecadado neste mês",
        value: `R$ ${formatoMoeda.format(totalDizimosMes)}`,
        icon: "hand-left-outline",
        tint: "#E3F2FD",
        iconColor: "#1565C0",
      },
      {
        id: "4",
        label: "Média de dízimos",
        sub: "Desde o saldo inicial",
        value: `R$ ${formatoMoeda.format(mediaDizimosAnual)}`,
        icon: "stats-chart-outline",
        tint: "#FFF3E0",
        iconColor: "#EF6C00",
      },
    ],
    [
      entradasFuturas,
      despesasFuturas,
      totalDizimosMes,
      mediaDizimosAnual,
      formatoMoeda,
    ]
  );

  if (load && !refreshing) return <Load />;

  return (
    <View style={styles.container}>
      <FlatList
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
          <Saldo
            caixaGeral={caixaGeral}
            saldoAtual={saldoAtual}
            saldoAnterior={saldoAnterior}
            projecaoFutura={projecaoFutura}
            qtdCaixinhas={qtdCaixinhas}
            emCaixinhas={emCaixinhas}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={item.route ? 0.75 : 1}
            disabled={!item.route}
            onPress={() => item.route && navigation.navigate(item.route)}
            style={styles.itemCard}
          >
            <View style={[styles.iconCircle, { backgroundColor: item.tint }]}>
              <Ionicons name={item.icon} size={18} color={item.iconColor} />
            </View>

            <View style={styles.itemCenter}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              <Text style={styles.itemSub}>{item.sub}</Text>
            </View>

            <Text style={styles.itemValue}>{item.value}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <Modal
        visible={menuAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuAberto(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuAberto(false)}
        >
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <View style={styles.menuUser}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.menuAvatar} />
              ) : (
                <View style={[styles.menuAvatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.menuNome} numberOfLines={1}>
                  {nome}
                </Text>
                {!!email && (
                  <Text style={styles.menuEmail} numberOfLines={1}>
                    {email}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} />
              <Text style={styles.menuSair}>Sair</Text>

            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7ff",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: "#ddd",
  },
  avatarFallback: {
    backgroundColor: "#66796b",
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: "Roboto-Regular",
    color: "#1f2933",
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
  },
  itemValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "flex-end",
    paddingTop: 56,
    paddingRight: 12,
  },
  menuCard: {
    width: 240,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    elevation: 6,
  },
  menuUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    marginBottom: 8,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
  },
  menuNome: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  menuEmail: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
    marginTop: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  menuSair: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
});
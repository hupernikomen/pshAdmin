import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useContext, useState } from "react";
import { useNavigation, useTheme } from "@react-navigation/native";
import ValorOculto from "./ValorOculto";

export default function Saldo({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  projecaoFutura,
  projecaoMeses = 1,
  qtdCaixinhas,
}) {
  const { colors } = useTheme();
  const { formatoMoeda, ocultarValores } = useContext(AppContext);
  const navigation = useNavigation();

  // Abas: 'saldo', 'caixinhas' ou 'projecao'
  const [abaAtiva, setAbaAtiva] = useState("saldo");

  const fmt = (v) => `R$ ${formatoMoeda.format(Number(v) || 0)}`;

  const meses = Math.max(1, Number(projecaoMeses) || 1);
  const labelProjecao = `Saldo Projetado`;

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            abaAtiva === "saldo" && [styles.tabActive, { backgroundColor: colors.card }],
          ]}
          onPress={() => setAbaAtiva("saldo")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.text },
              abaAtiva === "saldo" && styles.tabTextActive,
            ]}
          >
            Saldo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            abaAtiva === "projecao" && [styles.tabActive, { backgroundColor: colors.card }],
          ]}
          onPress={() => setAbaAtiva("projecao")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.text },
              abaAtiva === "projecao" && styles.tabTextActive,
            ]}
          >
            Projeção
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            abaAtiva === "caixinhas" && [styles.tabActive, { backgroundColor: colors.card }],
          ]}
          onPress={() => setAbaAtiva("caixinhas")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.text },
              abaAtiva === "caixinhas" && styles.tabTextActive,
            ]}
          >
            Caixinhas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo Dinâmico unificado ao bloco das abas */}
      {abaAtiva === "saldo" ? (
        <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.text }]}>
                Saldo atual
              </Text>
              {ocultarValores ? (
                <ValorOculto size="large" style={{ marginVertical: 6 }} />
              ) : (
                <Text style={[styles.balanceValue, { color: colors.text }]}>
                  {fmt(saldoAtual)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("Registro")}
              style={[styles.addBtn, { backgroundColor: colors.principal }]}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>


          <View style={styles.balanceMiddle}>
            <View>
              <Text style={[styles.miniLabel, { color: colors.text }]}>
                Caixa livre
              </Text>
              {ocultarValores ? (
                <ValorOculto size="medium" />
              ) : (
                <Text style={[styles.miniValue, { color: colors.text }]}>
                  {fmt(caixaGeral)}
                </Text>
              )}
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.miniLabel, { color: colors.text }]}>
                Saldo anterior
              </Text>
              {ocultarValores ? (
                <ValorOculto size="medium" style={{ alignSelf: "flex-end" }} />
              ) : (
                <Text style={[styles.miniValue, { color: colors.text }]}>
                  {fmt(saldoAnterior)}
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : abaAtiva === "caixinhas" ? (
        <View style={[styles.balanceCard, { backgroundColor: colors.card, height: 140, justifyContent: "space-between" }]}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.text }]}>
                Total em Caixinhas
              </Text>
              {ocultarValores ? (
                <ValorOculto size="large" style={{ marginVertical: 6 }} />
              ) : (
                <Text style={[styles.balanceValue, { color: colors.text }]}>
                  {fmt(emCaixinhas)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("Caixinhas")}
              style={[styles.addBtn, { backgroundColor: colors.principal }]}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceMiddle}>
            <View>
              <Text style={[styles.miniLabel, { color: colors.text }]}>
                Qtd. Caixinhas
              </Text>
              <Text style={[styles.miniValue, { color: colors.text }]}>
                {qtdCaixinhas || 0} ativas
              </Text>
            </View>


          </View>
        </View>
      ) : (
        <View style={[styles.balanceCard, { backgroundColor: colors.card, height: 140, justifyContent: "space-between" }]}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.text }]}>
                {labelProjecao}
              </Text>
              {ocultarValores ? (
                <ValorOculto size="large" style={{ marginVertical: 6 }} />
              ) : (
                <Text style={[styles.balanceValue, { color: colors.text }]}>
                  {fmt(projecaoFutura)}
                </Text>
              )}
            </View>

          </View>

          <View style={styles.balanceMiddle}>
            <View>
              <Text style={[styles.miniLabel, { color: colors.text }]}>
                Estimativa calculada
              </Text>
              <Text style={[styles.miniValue, { color: colors.text }]}>
                {meses} {meses === 1 ? "mês" : "meses"}
              </Text>
            </View>


          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    zIndex: 2,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "transparent",
  },
  tabActive: {
    shadowColor: "transparent",
    elevation: 0,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    opacity: 0.7,
  },
  tabTextActive: {
    fontFamily: "Roboto-Bold",
    opacity: 1,
  },
  balanceCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    padding: 18,
    zIndex: 1,
    justifyContent: "space-between",
  },
  balanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  balanceMiddle: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  divider: {
    height: 1,
    width: "100%",
    opacity: 0.2,
    marginVertical: 4,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
  },
  balanceValue: {
    fontSize: 22,
    fontFamily: "Roboto-Bold",
    letterSpacing: -1,
    marginTop: 2,
  },
  miniLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 3,
  },
  miniValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
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
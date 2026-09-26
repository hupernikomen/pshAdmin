import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useContext } from "react";
import { useNavigation, useTheme } from "@react-navigation/native";

export default function Saldo({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  projecaoFutura,
  qtdCaixinhas,
}) {
  const { colors } = useTheme();
  const { formatoMoeda, ocultarValores, toggleOcultarValores } =
    useContext(AppContext);
  const navigation = useNavigation();

  const mask = "000";
  const fmt = (v) =>
    ocultarValores ? mask : `R$ ${formatoMoeda.format(Number(v) || 0)}`;

  return (
    <View>
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View style={styles.labelRow}>
            <Text style={styles.balanceLabel}>Saldo atual</Text>
            <TouchableOpacity
              onPress={toggleOcultarValores}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ocultarValores ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#333"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Registro")}
            style={[styles.addBtn, { backgroundColor: colors.principal }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceValue}>{fmt(saldoAtual)}</Text>

        <View style={styles.balanceBottom}>
          <View>
            <Text style={styles.miniLabel}>Caixa geral</Text>
            <Text style={styles.miniValue}>{fmt(caixaGeral)}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Caixinhas")}
            style={styles.caixinhasBtn}
          >
            <View style={styles.caixinhasTitleRow}>
              <Text style={styles.miniLabel}>Caixinhas</Text>
              <Ionicons name="chevron-forward" size={14} color="#888" />
            </View>
            <Text style={styles.miniValue}>{fmt(emCaixinhas)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Saldo anterior</Text>
          <Text style={styles.chipValue}>{fmt(saldoAnterior)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Projeção</Text>
          <Text style={styles.chipValue}>{fmt(projecaoFutura)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  balanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: { padding: 2 },
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
    color: "#000",
  },
  balanceValue: {
    fontSize: 30,
    fontFamily: "Roboto-Bold",
    letterSpacing: -1,
    marginBottom: 16,
  },
  balanceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  miniLabel: {
    color: "#000",
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 3,
  },
  miniValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
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
    color: "#000",
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 3,
  },
  chipValue: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#222",
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
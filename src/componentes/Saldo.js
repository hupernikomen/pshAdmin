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

  const mask = "R$ ***";
  const fmt = (v) =>
    ocultarValores ? mask : `R$ ${formatoMoeda.format(Number(v) || 0)}`;

  return (
    <View>
      <View style={[styles.balanceCard, {backgroundColor: colors.card}]}>
        <View style={styles.balanceTop}>
          <View style={styles.labelRow}>
            <Text style={[styles.balanceLabel, {color: colors.text}]}>Saldo atual</Text>
            <TouchableOpacity
              onPress={toggleOcultarValores}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ocultarValores ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Registro")}
            style={[styles.addBtn, { backgroundColor: colors.principal }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={'#fff'} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.balanceValue, {color: colors.text}]}>{fmt(saldoAtual)}</Text>

        <View style={styles.balanceBottom}>
          <View>
            <Text style={[styles.miniLabel, {color: colors.text}]}>Caixa livre</Text>
            <Text style={[styles.miniValue, {color: colors.text}]}>{fmt(caixaGeral)}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Caixinhas")}
            style={styles.caixinhasBtn}
          >
            <View style={styles.caixinhasTitleRow}>
              <Text style={[styles.miniLabel, {color: colors.text}]}>Caixinhas</Text>
              <Ionicons name="chevron-forward" size={14} color="#888" />
            </View>
            <Text style={[styles.miniValue, {color: colors.text}]}>{fmt(emCaixinhas)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={[styles.chip, {backgroundColor: colors.card}]}>
          <Text style={[styles.chipLabel, {color: colors.text}]}>Saldo anterior</Text>
          <Text style={[styles.chipValue, {color: colors.text}]}>{fmt(saldoAnterior)}</Text>
        </View>
        <View style={[styles.chip, {backgroundColor: colors.card}]}>
          <Text style={[styles.chipLabel, {color: colors.text}]}>Projeção</Text>
          <Text style={[styles.chipValue, {color: colors.text}]}>{fmt(projecaoFutura)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
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
    paddingHorizontal: 18,
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
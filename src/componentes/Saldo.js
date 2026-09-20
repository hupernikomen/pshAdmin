import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from '../context/AppContext';
import { useContext } from 'react';
import { useNavigation, useTheme } from '@react-navigation/native';


export default function componentes({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  projecaoFutura,
  qtdCaixinhas

}) {

  const {colors} = useTheme()

  const {
    formatoMoeda,
  } = useContext(AppContext);

  const navigation = useNavigation()

  return (
    <View>
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Text style={styles.balanceLabel}>Saldo atual</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("Registro")}
            style={[styles.addBtn, {backgroundColor: colors.principal}]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

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
              <Ionicons name="chevron-forward" size={14} />
            </View>
            <Text style={styles.miniValue}>
              R$ {formatoMoeda.format(emCaixinhas)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <Text style={styles.chipLabel}>Caixinhas</Text>
          <Text style={styles.chipValue}>{qtdCaixinhas}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Resumo geral</Text>
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
    marginBottom: 8,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#000",
  },
  balanceValue: {
    fontSize: 30,
    fontFamily: "Roboto-Bold",
    letterSpacing: -0.8,
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
    paddingHorizontal: 10,
  },
  chipLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
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
    marginBottom: 12,
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
})
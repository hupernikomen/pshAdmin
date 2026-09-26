import { useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppContext } from "../context/AppContext";
import { useNavigation, useTheme } from "@react-navigation/native";

const KEY_SALDO_OCULTO = "@saldo_oculto";

export default function Saldo({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  projecaoFutura,
  qtdCaixinhas,
}) {
  const { colors } = useTheme();
  const { formatoMoeda, podeEditarFinanceiro } = useContext(AppContext);
  const navigation = useNavigation();
  const [oculto, setOculto] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;

  useEffect(() => {
    AsyncStorage.getItem(KEY_SALDO_OCULTO)
      .then((v) => {
        if (v === "1") setOculto(true);
        if (v === "0") setOculto(false);
      })
      .catch(() => {});
  }, []);

  async function alternarOculto() {
    const novo = !oculto;
    setOculto(novo);
    try {
      await AsyncStorage.setItem(KEY_SALDO_OCULTO, novo ? "1" : "0");
    } catch (e) {
      console.log("Erro ao salvar preferência de saldo:", e);
    }
  }

  function mask(valor) {
    if (oculto) return "R$ •••••";
    return `R$ ${formatoMoeda.format(valor)}`;
  }

  return (
    <View>
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View style={styles.labelRow}>
            <Text style={styles.balanceLabel}>Saldo atual</Text>
            <TouchableOpacity
              onPress={alternarOculto}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={oculto ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {podeEditar && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Registro")}
              style={[styles.addBtn, { backgroundColor: colors.principal }]}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.balanceValue}>{mask(saldoAtual)}</Text>

        <View style={styles.balanceBottom}>
          <View>
            <Text style={styles.miniLabel}>Caixa livre</Text>
            <Text style={styles.miniValue}>{mask(caixaGeral)}</Text>
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
            <Text style={styles.miniValue}>{mask(emCaixinhas)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Anterior</Text>
          <Text style={styles.chipValue}>{mask(saldoAnterior)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Projeção</Text>
          <Text style={styles.chipValue}>{mask(projecaoFutura)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Caixinhas</Text>
          <Text style={styles.chipValue}>{oculto ? "•" : qtdCaixinhas}</Text>
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
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: {
    padding: 2,
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
    color:'#000'
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
    color:'#000',
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
    color:'#000',
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
});
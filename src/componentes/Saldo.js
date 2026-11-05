import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect, useNavigation, useTheme } from "@react-navigation/native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import { calcularSaldoFinalProjecao } from "../pages/ProjecaoGastos";
import ValorOculto from "./ValorOculto";

const ABAS = ["saldo", "projecao", "caixinhas"];

export default function Saldo({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  qtdCaixinhas,
}) {
  const { colors } = useTheme();
  const {
    formatoMoeda,
    ocultarValores,
    dadosFinancas,
    saldo,
    igrejaAtiva,
    getIgrejaId,
  } = useContext(AppContext);
  const navigation = useNavigation();

  const [abaAtiva, setAbaAtiva] = useState("saldo");
  const [gastosProj, setGastosProj] = useState([]);
  const [largura, setLargura] = useState(0);

  const slide = useRef(new Animated.Value(0)).current;

  const fmt = (v) => `R$ ${formatoMoeda.format(Number(v) || 0)}`;

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const igrejaId = getIgrejaId?.();
      if (!igrejaId) {
        setGastosProj([]);
        return undefined;
      }
      (async () => {
        try {
          const snap = await getDocs(
            query(
              collection(db, "gastosProjetados"),
              where("igrejaId", "==", igrejaId)
            )
          );
          if (!ativo) return;
          setGastosProj(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
          if (ativo) setGastosProj([]);
        }
      })();
      return () => {
        ativo = false;
      };
    }, [getIgrejaId, igrejaAtiva?.id, saldo, dadosFinancas])
  );

  const saldoProjetadoTela = calcularSaldoFinalProjecao({
    dadosFinancas,
    saldo,
    igrejaAtiva,
    gastos: gastosProj,
  });

  useEffect(() => {
    if (!largura) return;
    const index = ABAS.indexOf(abaAtiva);
    Animated.spring(slide, {
      toValue: -index * largura,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [abaAtiva, largura, slide]);

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {ABAS.map((aba) => {
          const ativo = abaAtiva === aba;
          const label =
            aba === "saldo" ? "Saldo" : aba === "projecao" ? "Projeção" : "Caixinhas";
          return (
            <TouchableOpacity
              key={aba}
              style={[
                styles.tabItem,
                ativo && [styles.tabActive, { backgroundColor: colors.card }],
              ]}
              onPress={() => setAbaAtiva(aba)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.text },
                  ativo && styles.tabTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[styles.viewport, { backgroundColor: colors.card }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== largura) setLargura(w);
        }}
      >
        {largura > 0 && (
          <Animated.View
            style={{
              flexDirection: "row",
              width: largura * ABAS.length,
              transform: [{ translateX: slide }],
            }}
          >
            <View style={{ width: largura }}>
              <View style={styles.balanceCard}>
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
            </View>

            <View style={{ width: largura }}>
              <View style={[styles.balanceCard, styles.cardFixa]}>
                <View style={styles.balanceTop}>
                  <View>
                    <Text style={[styles.balanceLabel, { color: colors.text }]}>
                      Saldo projetado
                    </Text>
                    {ocultarValores ? (
                      <ValorOculto size="large" style={{ marginVertical: 6 }} />
                    ) : (
                      <Text style={[styles.balanceValue, { color: colors.text }]}>
                        {fmt(saldoProjetadoTela)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Projecao")}
                    style={[styles.addBtn, { backgroundColor: colors.principal }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.balanceMiddle}>
                  <View>
                    <Text style={[styles.miniLabel, { color: colors.text }]}>
                      Gastos projetados
                    </Text>
                    <Text style={[styles.miniValue, { color: colors.text }]}>
                      {gastosProj.length}{" "}
                      {gastosProj.length === 1 ? "lançamento" : "lançamentos"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ width: largura }}>
              <View style={[styles.balanceCard, styles.cardFixa]}>
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
            </View>
          </Animated.View>
        )}
      </View>
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
  viewport: {
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    zIndex: 1,
  },
  balanceCard: {
    padding: 18,
    justifyContent: "space-between",
  },
  cardFixa: {
    height: 140,
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
});
// src/componentes/Saldo.js
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect, useNavigation, useTheme } from "@react-navigation/native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import ValorOculto from "./ValorOculto";
import { verificarStatusAssinatura } from "../utils/assinatura";
import { PLAN_CONFIG } from "../constants/appConfig";

const ABAS = ["saldo", "caixinhas"];
const CARD_HEIGHT = 145;

export default function Saldo({
  saldoAtual,
  caixaGeral,
  emCaixinhas,
  saldoAnterior,
  qtdCaixinhas,
}) {
  const { colors, dark } = useTheme();
  const {
    formatoMoeda,
    ocultarValores,
    toggleOcultarValores,
    dadosFinancas,
    saldo,
    igrejaAtiva,
    getIgrejaId,
  } = useContext(AppContext);
  const navigation = useNavigation();

  const [abaAtiva, setAbaAtiva] = useState("saldo");
  const [largura, setLargura] = useState(0);

  const slide = useRef(new Animated.Value(0)).current;

  const fmt = (v) => `R$ ${formatoMoeda.format(Number(v) || 0)}`;

  const lockConfig = PLAN_CONFIG.PREMIUM_LOCK || {};
  const lockColor = dark ? lockConfig.colorDark : lockConfig.colorLight;

  const statusAssinatura = verificarStatusAssinatura(igrejaAtiva);
  const isCaixinhasBloqueado = !statusAssinatura.isPremium;

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
          const isCaixinhaAba = aba === "caixinhas";
          const mostrarBloqueio = isCaixinhaAba && isCaixinhasBloqueado;

          const label = aba === "saldo" ? "Saldo" : "Caixinhas";

          return (
            <TouchableOpacity
              key={aba}
              style={[
                styles.tabItem,
                ativo && [styles.tabActive, { backgroundColor: colors.card }],
              ]}
              onPress={() => {
                setAbaAtiva(aba);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.tabHeaderContent}>
                {mostrarBloqueio && (
                  <Ionicons
                    name={lockConfig.icon || "star"}
                    size={lockConfig.size || 11}
                    color={lockColor}
                  />
                )}
                <Text
                  style={[
                    styles.tabText,
                    { color: colors.text },
                    ativo && styles.tabTextActive,
                  ]}
                >
                  {label}
                </Text>
              </View>
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
            {/* SALDO */}
            <View style={{ width: largura }}>
              <View style={styles.balanceCard}>
                <View style={styles.balanceTop}>
                  <View>
                    <View style={styles.labelWithEye}>
                      <Text style={[styles.balanceLabel, { color: colors.text }]}>
                        Saldo atual
                      </Text>
                      <TouchableOpacity
                        onPress={toggleOcultarValores}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={ocultarValores ? "eye-off-outline" : "eye-outline"}
                          size={16}
                          color={colors.muted || (dark ? "#9aa0a6" : "#888")}
                        />
                      </TouchableOpacity>
                    </View>

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
                      <ValorOculto
                        size="medium"
                        style={{ alignSelf: "flex-end" }}
                      />
                    ) : (
                      <Text style={[styles.miniValue, { color: colors.text }]}>
                        {fmt(saldoAnterior)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* CAIXINHAS */}
            <View style={{ width: largura }}>
              <View style={styles.balanceCard}>
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
                    onPress={() => {
                      if (isCaixinhasBloqueado) {
                        navigation.navigate("Paywall");
                        return;
                      }
                      navigation.navigate("Caixinhas");
                    }}
                    style={[
                      styles.addBtn,
                      { backgroundColor: isCaixinhasBloqueado ? lockColor : colors.principal },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isCaixinhasBloqueado ? (lockConfig.icon || "star") : "chevron-forward"}
                      size={isCaixinhasBloqueado ? (lockConfig.size || 14) : 22}
                      color="#fff"
                    />
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
    marginBottom: 14,
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
  tabHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabActive: {
    shadowColor: "transparent",
    elevation: 0,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
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
    height: CARD_HEIGHT,
    padding: 18,
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
    alignItems: "flex-end",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWithEye: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
  },
  balanceValue: {
    fontSize: 20,
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
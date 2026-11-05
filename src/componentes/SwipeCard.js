import { useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useTheme } from "@react-navigation/native";
import ValorOculto from "./ValorOculto";

const ACTION_WIDTH = 64;
const OPEN_THRESHOLD = 40;

export default function SwipeCard({
  icon = "ellipse-outline",
  iconColor = "#333",
  tint = "#f4f5f7",
  title = "",
  subtitle = "",
  value = "",
  actions = [],
  open = false,
  onOpenChange,
  onPress,
  hasRecibo = false,
  canEdit = false,
}) {
  const { colors, dark } = useTheme();
  const { ocultarValores } = useContext(AppContext);
  const valorExibido = ocultarValores ? "R$ ***" : value;

  const muted = colors.muted || "#888";
  const text = colors.text || "#1f2933";

  const qtd = Array.isArray(actions) ? actions.length : 0;
  const maxOpen = qtd * ACTION_WIDTH;

  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: open && maxOpen > 0 ? -maxOpen : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [open, maxOpen]);

  function fechar() {
    onOpenChange?.(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }

  function abrir() {
    if (maxOpen <= 0) {
      onPress?.();
      return;
    }
    onOpenChange?.(true);
    Animated.spring(translateX, {
      toValue: -maxOpen,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }

  function toggle() {
    if (open) fechar();
    else abrir();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => {
          startX.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        if (maxOpen <= 0) return;
        let next = startX.current + g.dx;
        if (next > 0) next = 0;
        if (next < -maxOpen) next = -maxOpen;
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (maxOpen <= 0) return;
        const current = startX.current + g.dx;
        const shouldOpen =
          current < -OPEN_THRESHOLD || (open && current < -maxOpen / 2);
        if (shouldOpen) abrir();
        else fechar();
      },
    })
  ).current;

  // Cor de fundo do "container interno" que simula o fundo escuro/caixa onde os botões moram
  const backgroundContainer = dark ? "#1a1a1a" : "#eaeef2";

  return (
    <View style={styles.wrap}>
      {/* Container de fundo (A "caixa" onde os botões aparecem revelando o fundo) */}
      {qtd > 0 && (
        <View
          style={[
            styles.actionsContainer,
            { width: maxOpen, backgroundColor: backgroundContainer },
          ]}
        >
          <View style={styles.actionsBehind}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.key || a.icon}
                style={[
                  styles.actionBtn,
                  { backgroundColor: a.backgroundColor || "#666" },
                ]}
                onPress={() => {
                  fechar();
                  a.onPress?.();
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={a.icon || "ellipsis-horizontal"}
                  size={20}
                  color="#fff"
                />
                {!!a.label && (
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {a.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Card principal que desliza por cima */}
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateX }], backgroundColor: colors.card },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={toggle} style={styles.cardInner}>
          <View style={[styles.iconCircle, { backgroundColor: tint }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>

          <View style={styles.center}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: text }]} numberOfLines={1}>
                {title}
              </Text>
              {ocultarValores ? (
                <ValorOculto size="medium" style={{ alignSelf: "center" }} />
              ) : (
                <Text style={[styles.value, { color: text }]} numberOfLines={1}>
                  {value}
                </Text>
              )}
            </View>

            <View style={styles.subRow}>
              <Text
                style={[styles.subtitle, { color: muted }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
              <View style={styles.badges}>
                {hasRecibo && (
                  <Ionicons
                    name="attach-outline"
                    size={14}
                    color={muted}
                    style={styles.badgeIcon}
                  />
                )}
                {canEdit && (
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={muted}
                    style={styles.badgeIcon}
                  />
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    marginBottom: 0,
    overflow: "hidden",
    borderRadius: 18, // Garante que a "caixa" de fundo respeite o arredondamento do card
  },
  actionsContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
  },
  actionsBehind: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    paddingHorizontal: 4, // Dá um respiro simulando estar dentro de uma caixa
    gap: 4,
  },
  actionBtn: {
    width: ACTION_WIDTH - 8,
    height: "82%", // Deixa os botões um pouco menor verticalmente, dando o efeito de "dentro de uma caixa"
    borderRadius: 12, // Botões com bordas arredondadas individuais
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  actionLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: "Roboto-Medium",
    color: "#fff",
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  value: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  subRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 21,
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Roboto-Light",
    lineHeight: 16,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    minHeight: 16,
    minWidth: 50,
  },
  badgeIcon: {
    marginTop: 1,
  },
});
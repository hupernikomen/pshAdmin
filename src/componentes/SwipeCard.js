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
  const { ocultarValores } = useContext(AppContext);
  const valorExibido = ocultarValores ? "000" : value;

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

  return (
    <View style={styles.wrap}>
      {/* botões atrás */}
      {qtd > 0 && (
        <View style={[styles.actionsBehind, { width: maxOpen }]}>
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
              <Ionicons name={a.icon || "ellipsis-horizontal"} size={20} color="#fff" />
              {!!a.label && (
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {a.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={toggle} style={styles.cardInner}>
          <View style={[styles.iconCircle, { backgroundColor: tint }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>

          <View style={styles.center}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.value} numberOfLines={1}>
                {valorExibido}
              </Text>
            </View>

            <View style={styles.subRow}>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
              <View style={styles.badges}>
                {hasRecibo && (
                  <Ionicons
                    name="attach-outline"
                    size={14}
                    color="#888"
                    style={styles.badgeIcon}
                  />
                )}
                {canEdit && (
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color="#888"
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
  },
  actionsBehind: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: 18,
  },
  actionBtn: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: "Roboto-Medium",
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
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
    fontFamily: "Roboto-Regular",
    color: "#1f2933",
  },
  value: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  subRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Roboto-Light",
    color: "#888",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 16,
  },
  badgeIcon: {
    marginTop: 1,
  },
});
import { useEffect, useRef } from "react";
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

const ACTION_WIDTH = 64;
const OPEN_THRESHOLD = 48;

/**
 * Card com arraste para a esquerda revelando ações.
 *
 * props:
 * - icon, iconColor, tint, title, subtitle, value
 * - onPress?: clique no card (opcional)
 * - actions?: Array<{
 *     key: string,
 *     icon: string,           // Ionicons
 *     label?: string,
 *     backgroundColor: string,
 *     color?: string,         // cor do ícone (default #fff)
 *     onPress: () => void,
 *   }>
 * - open?: boolean            // controlado (opcional)
 * - onOpenChange?: (open) => void
 * - style?: object
 */
export default function SwipeCard({
  icon = "ellipse-outline",
  iconColor = "#555",
  tint = "#f0f0f0",
  title,
  subtitle,
  value,
  onPress,
  actions = [],
  open,
  onOpenChange,
  style,
}) {
  const maxOpen = Math.max(actions.length, 0) * ACTION_WIDTH;
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  useEffect(() => {
    if (typeof open === "boolean") {
      animateTo(open ? -maxOpen : 0, false);
      openRef.current = open;
    }
  }, [open, maxOpen]);

  function animateTo(to, notify = true) {
    Animated.spring(tx, {
      toValue: to,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start(() => {
      const isOpen = to < -OPEN_THRESHOLD / 2;
      openRef.current = isOpen;
      if (notify) onOpenChange?.(isOpen);
    });
  }

  function close() {
    animateTo(0);
  }

  function openActions() {
    if (maxOpen <= 0) return;
    animateTo(-maxOpen);
  }

  function toggle() {
    if (openRef.current) close();
    else openActions();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        maxOpen > 0 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (maxOpen <= 0) return;
        let next = g.dx + (openRef.current ? -maxOpen : 0);
        if (next > 0) next = 0;
        if (next < -maxOpen) next = -maxOpen;
        tx.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (maxOpen <= 0) return;
        const current = openRef.current ? -maxOpen + g.dx : g.dx;
        if (current < -OPEN_THRESHOLD || g.vx < -0.4) {
          animateTo(-maxOpen);
        } else {
          animateTo(0);
        }
      },
    })
  ).current;

  function handleAction(action) {
    close();
    // pequeno delay para o card fechar antes da ação
    setTimeout(() => action.onPress?.(), 80);
  }

  const hasActions = actions.length > 0;

  return (
    <View style={[styles.wrap, style]}>
      {/* Botões atrás */}
      {hasActions && (
        <View style={[styles.actionsRow, { width: maxOpen }]}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[
                styles.actionBtn,
                { backgroundColor: a.backgroundColor || "#666", width: ACTION_WIDTH },
              ]}
              activeOpacity={0.85}
              onPress={() => handleAction(a)}
            >
              <Ionicons
                name={a.icon}
                size={20}
                color={a.color || "#fff"}
              />
              {!!a.label && (
                <Text style={[styles.actionLabel, { color: a.color || "#fff" }]}>
                  {a.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Card */}
      <Animated.View
        style={[styles.card, { transform: [{ translateX: tx }] }]}
        {...(hasActions ? pan.panHandlers : {})}
      >
        <Pressable
          onPress={() => {
            if (openRef.current) {
              close();
              return;
            }
            if (hasActions && !onPress) {
              // só navegação/ações por swipe: toque alterna abrir
              toggle();
              return;
            }
            onPress?.();
          }}
          onLongPress={hasActions ? openActions : undefined}
          style={styles.cardInner}
        >
          <View style={[styles.iconCircle, { backgroundColor: tint }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>

          <View style={styles.itemCenter}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.itemSub} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {value != null && value !== "" && (
            <Text style={styles.itemValue} numberOfLines={1}>
              {value}
            </Text>
          )}

          {/* setinha discreta quando há ações */}
          {hasActions && (
            <TouchableOpacity
              hitSlop={10}
              onPress={toggle}
              style={styles.chevronHit}
            >
              <Ionicons name="chevron-back" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    borderRadius: 18,
    overflow: "hidden",
  },
  actionsRow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "stretch",
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontFamily: "Roboto-Medium",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
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
    color: "#888",
  },
  itemValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
    marginRight: 4,
  },
  chevronHit: {
    paddingLeft: 4,
    paddingVertical: 4,
  },
});
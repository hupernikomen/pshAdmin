import { useEffect, useRef, useState } from "react";
import { useTheme } from "@react-navigation/native";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  Platform,
  UIManager,
} from "react-native";

import Ionicons from "react-native-vector-icons/Ionicons";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_SIZE = 54;
const PILL_SIZE = 52;

function nomeIcone(nome, focado) {
  if (!nome) return "ellipse-outline";
  const base = String(nome).replace(/-outline$/, "");
  return focado ? base : `${base}-outline`;
}

export default function TabbarPersonalizada({
  state,
  descriptors,
  navigation,
}) {
  const { colors } = useTheme();

  const slideX = useRef(new Animated.Value(state.index * TAB_SIZE)).current;
  const scales = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  const [layouts, setLayouts] = useState({});

  useEffect(() => {
    const layout = layouts[state.index];
    const toX = layout
      ? layout.x + layout.width / 2 - PILL_SIZE / 2
      : state.index * TAB_SIZE + (TAB_SIZE - PILL_SIZE) / 2;

    Animated.spring(slideX, {
      toValue: toX,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();

    scales.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === state.index ? 1 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 140,
      }).start();
    });
  }, [state.index, layouts]);

  function onLayoutTab(index, e) {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      if (prev[index]?.x === x && prev[index]?.width === width) return prev;
      return { ...prev, [index]: { x, width } };
    });
  }

  return (
    <Animated.View style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              backgroundColor: colors.principal,
              transform: [{ translateX: slideX }],
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) return;
            if (!isFocused) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              onLayout={(e) => onLayoutTab(index, e)}
              style={styles.buttonTab}
              activeOpacity={0.85}
            >
              <Ionicons
                name={nomeIcone(options.tabBarIcon, isFocused)}
                size={26}
                color={isFocused ? "#fff" : "#9aa0a6"}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    bottom: -10,
    marginBottom: 28,
    padding: 2,
    borderRadius: 35,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ececec",
    elevation: 4,
    shadowColor: "#1f2933",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pill: {
    position: "absolute",
    left: -1,
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    zIndex: 0,
  },
  buttonTab: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
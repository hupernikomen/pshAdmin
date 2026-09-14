import { createContext, useContext, useMemo, useRef } from "react";
import { Animated } from "react-native";

const TabBarVisibilityContext = createContext(null);

export function TabBarVisibilityProvider({ children }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const visible = useRef(true);

  function show() {
    if (visible.current) return;
    visible.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }

  function hide() {
    if (!visible.current) return;
    visible.current = false;
    Animated.spring(translateY, {
      toValue: 110,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }

  function onScroll(event) {
    const y = event.nativeEvent.contentOffset.y;
    const diff = y - lastY.current;

    // topo sempre mostra
    if (y <= 12) {
      show();
      lastY.current = y;
      return;
    }

    // descendo: esconde
    if (diff > 6 && y > 30) {
      hide();
    }

    // subindo: mostra
    if (diff < -6) {
      show();
    }

    lastY.current = y;
  }

  const value = useMemo(
    () => ({
      translateY,
      onScroll,
      show,
      hide,
    }),
    [translateY]
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    return {
      translateY: new Animated.Value(0),
      onScroll: () => {},
      show: () => {},
      hide: () => {},
    };
  }
  return ctx;
}
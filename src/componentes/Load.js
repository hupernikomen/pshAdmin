import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { useAppTheme } from "../context/ThemeContext"; // Ajuste o caminho se necessário para o seu ThemeContext

const { width } = Dimensions.get("window");

export default function Load() {
  const { tema } = useAppTheme();
  const colors = tema?.colors || {};
  const principalColor = colors.principal || "#000";

  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background || "#f4f5f7" }]}>
      <View style={[styles.track, { backgroundColor: principalColor + "20" }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: principalColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  track: {
    height: 3,
    width: "90%",
    borderRadius: 2,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    width: "50%",
    borderRadius: 2,
  },
});
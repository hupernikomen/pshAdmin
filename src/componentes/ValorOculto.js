import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function ValorOculto({ size = "medium", style }) {
  const { colors, dark } = useTheme();
  
  // Usa uma cor sutil com transparência (baseada na cor muted)
  const bg = (colors.muted || (dark ? "#9aa0a6" : "#888")) + "30";

  const sizeStyles = {
    large: styles.large,   // Para o Saldo Principal (24px)
    medium: styles.medium, // Para os SwipeCards e Minivalores (14px)
    small: styles.small,   // Para Subtítulos ou Badges menores (12px)
  };

  return <View style={[styles.pill, sizeStyles[size] || styles.medium, { backgroundColor: bg }, style]} />;
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  large: {
    height: 22,
    width: 140,
    marginVertical: 4,
  },
  medium: {
    height: 14,
    width: 75,
    marginVertical: 2,
  },
  small: {
    height: 12,
    width: 55,
    marginVertical: 2,
  },
});
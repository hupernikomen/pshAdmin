import { DefaultTheme, DarkTheme } from "@react-navigation/native";

/** Cor principal — tema claro (Tom quente e acolhedor) */
export const PRINCIPAL = "#D97706"; // Um âmbar/dourado elegante e vivo

/** Cor principal — tema escuro (mantido intacto) */
export const PRINCIPAL_DARK = "#488fe0ff";

export const TemaClaro = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: "#0284C7", // Azul oceano sóbrio e elegante
    background: "#F1F3F5", // Cinza neve muito suave
    card: "#FFFFFF", // Cartões brancos para contraste limpo
    text: "#1E293B", // Azul escuro carvão para leitura nítida
    border: "#D1D5DB",
    notification: "#0284C7",

    principal: "#0284C7",
    neutro: "#E5E7EB",
    negativo: "#DC2626",
    muted: "#6B7280",
    entrada: "#16A34A",
    saida: "#DC2626",
  },
};

export const TemaEscuro = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: PRINCIPAL_DARK,
    background: "#131313",
    card: "#1c1c1c",
    text: "#b4b4b4ff",
    border: "#333333",
    notification: PRINCIPAL_DARK,
    principal: PRINCIPAL_DARK,
    neutro: "#2a2a2a",
    negativo: "#EF5350",
    muted: "#9aa0a6",
    entrada: "#81C784",
    saida: "#E57373",
  },
};
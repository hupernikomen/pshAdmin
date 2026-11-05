import { DefaultTheme, DarkTheme } from "@react-navigation/native";

/** Cor principal — tema claro (Azul Royal vibrante e moderno) */
export const PRINCIPAL = "#488fe0ff";

/** Cor principal — tema escuro */
export const PRINCIPAL_DARK = "#488fe0ff";

export const TemaClaro = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: PRINCIPAL,
    background: "#f6f6f6ff",
    card: "#FFFFFF",
    text: "#132245ff", // Escuro mais definido para alto contraste
    border: "#E2E8F0",
    notification: PRINCIPAL,

    principal: PRINCIPAL,
    neutro: "#F1F5F9",
    negativo: "#DC2626",
    muted: "#64748B", // Muted mais legível
    entrada: "#16A34A", // Verde vivo
    saida: "#DC2626", // Vermelho vivo
  },
};

export const TemaEscuro = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: PRINCIPAL_DARK,
    background: "#101010",
    card: "#1e1e1e",
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
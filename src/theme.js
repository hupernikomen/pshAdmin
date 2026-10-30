import { DefaultTheme, DarkTheme } from "@react-navigation/native";

/** Cor principal — tema claro */
export const PRINCIPAL = "#2A80F8";

/** Cor principal — tema escuro (mais clara, combina com fundo escuro) */
export const PRINCIPAL_DARK = "#3D6FA8";

export const TemaClaro = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: PRINCIPAL,
    background: "#f4f5f7",
    card: "#ffffff",
    text: "#222",
    border: "#ececec",
    notification: PRINCIPAL,

    principal: PRINCIPAL,
    neutro: "#f6f6f6",
    negativo: "#EB271C",
    muted: "#9aa0a6",
    entrada: "#2E7D32",
    saida: "#C62828",
  },
};

export const TemaEscuro = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: PRINCIPAL_DARK,
    background: "#121212",
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
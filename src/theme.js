import { DefaultTheme, DarkTheme } from "@react-navigation/native";

/** Cor principal do app (a que você já usa) */
export const PRINCIPAL = "#6b96e7";

export const TemaClaro = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: PRINCIPAL,
    background: "#f4f5f7",
    card: "#ffffff",
    text: "#1f2933",
    border: "#ececec",
    notification: PRINCIPAL,

    // extras do seu app
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
    primary: PRINCIPAL,
    background: "#121212",
    card: "#1e1e1e",
    text: "#c4c4c4ff",
    border: "#333333",
    notification: PRINCIPAL,

    principal: PRINCIPAL,
    neutro: "#2a2a2a",
    negativo: "#EF5350",
    muted: "#9aa0a6",
    entrada: "#81C784",
    saida: "#E57373",
  },
};
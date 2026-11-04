import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TemaClaro, TemaEscuro } from "../theme";

const KEY = "@theme_preference"; // "system" | "light" | "dark"
const DEFAULT_PREFERENCE = "dark"; // tema padrão após instalar

export const ThemeContext = createContext({
  preference: DEFAULT_PREFERENCE,
  isDark: true,
  tema: TemaEscuro,
  setPreference: async () => {},
  toggleLightDark: async () => {},
  ready: false,
});

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState(DEFAULT_PREFERENCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setPreferenceState(saved);
        } else {
          // primeira instalação: grava dark como preferência
          setPreferenceState(DEFAULT_PREFERENCE);
          await AsyncStorage.setItem(KEY, DEFAULT_PREFERENCE);
        }
      } catch (_) {
        setPreferenceState(DEFAULT_PREFERENCE);
      }
      setReady(true);
    })();
  }, []);

  async function setPreference(next) {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(KEY, next);
    } catch (_) {}
  }

  async function toggleLightDark() {
    const atualEscuro =
      preference === "dark" ||
      (preference === "system" && system === "dark");
    await setPreference(atualEscuro ? "light" : "dark");
  }

  const isDark = useMemo(() => {
    if (preference === "dark") return true;
    if (preference === "light") return false;
    return system === "dark";
  }, [preference, system]);

  const tema = isDark ? TemaEscuro : TemaClaro;

  const value = useMemo(
    () => ({
      preference,
      isDark,
      tema,
      setPreference,
      toggleLightDark,
      ready,
    }),
    [preference, isDark, tema, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
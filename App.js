import { useEffect, useContext } from "react";
import {
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import changeNavigationBarColor from "react-native-navigation-bar-color";

import AuthProvider, { AuthContext } from "./src/context/AuthContext";
import AppProvider, { AppContext } from "./src/context/AppContext";
import ThemeProvider, { useAppTheme } from "./src/context/ThemeContext";
import Rotas from "./src/rotas";
import Login from "./src/pages/Login";
import { PRINCIPAL } from "./src/theme";

function TelaCarregamento({ colors }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors?.background || "#f4f5f7",
      }}
    >
      <ActivityIndicator size="large" color={colors?.principal || PRINCIPAL} />
    </View>
  );
}

function AppNavigator() {
  const { user, authPronto } = useContext(AuthContext);
  const { igrejasProntas } = useContext(AppContext);
  const { tema, ready } = useAppTheme();
  const { colors } = tema;

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const barColor = tema.dark ? "#121212" : "#f4f5f7";
    const lightIcons = !tema.dark;

    try {
      const result = changeNavigationBarColor(barColor, lightIcons);
      if (result != null && typeof result.then === "function") {
        result.catch(() => {});
      }
    } catch (e) {}
  }, [tema.dark]);

  if (!ready || !authPronto) {
    return <TelaCarregamento colors={colors} />;
  }

  if (!user) {
    return (
      <NavigationContainer theme={tema}>
        <StatusBar
          barStyle={tema.dark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <Login />
      </NavigationContainer>
    );
  }

  if (!igrejasProntas) {
    return <TelaCarregamento colors={colors} />;
  }

  return (
    <NavigationContainer theme={tema}>
      <StatusBar
        barStyle={tema.dark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <Rotas />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <AppNavigator />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
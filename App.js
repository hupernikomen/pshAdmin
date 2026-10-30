import { useEffect, useContext } from "react";
import {
  StatusBar,
  View,
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import changeNavigationBarColor from "react-native-navigation-bar-color";
import Ionicons from "react-native-vector-icons/Ionicons";

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

function TelaSemConexao({ colors, onRetry, carregando }) {
  const principal = colors?.principal || PRINCIPAL;
  const text = colors?.text || "#1f2933";
  const muted = colors?.muted || "#888";
  const bg = colors?.background || "#f4f5f7";
  const card = colors?.card || "#fff";

  return (
    <View style={[stylesOffline.root, { backgroundColor: bg }]}>
      <View style={[stylesOffline.iconWrap, { backgroundColor: card }]}>
        <Ionicons name="cloud-offline-outline" size={36} color={muted} />
      </View>

      <Text style={[stylesOffline.title, { color: text }]}>
        Sem conexão com a internet
      </Text>

      <Text style={[stylesOffline.sub, { color: muted }]}>
        Não foi possível carregar os dados da igreja. Verifique sua conexão e
        tente novamente.
      </Text>

      <TouchableOpacity
        style={[stylesOffline.btn, { backgroundColor: principal }]}
        onPress={onRetry}
        activeOpacity={0.85}
        disabled={carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={stylesOffline.btnText}>Tentar novamente</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const stylesOffline = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  btn: {
    height: 48,
    minWidth: 200,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
});

function AppNavigator() {
  const { user, authPronto } = useContext(AuthContext);
  const { igrejasProntas, semConexao, carregarIgrejasDoUsuario, igrejaAtiva } =
    useContext(AppContext);
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

  // Offline e sem igreja carregada → tela específica (não "criar igreja")
  if (semConexao && !igrejaAtiva?.id) {
    return (
      <NavigationContainer theme={tema}>
        <StatusBar
          barStyle={tema.dark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <TelaSemConexao
          colors={colors}
          onRetry={() => carregarIgrejasDoUsuario?.()}
        />
      </NavigationContainer>
    );
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
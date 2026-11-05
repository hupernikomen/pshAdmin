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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import changeNavigationBarColor from "react-native-navigation-bar-color";
import Ionicons from "react-native-vector-icons/Ionicons";
import SpInAppUpdates, { IAUUpdateKind } from "sp-react-native-in-app-updates";

import AppAlert from "./src/componentes/AppAlert";
import AuthProvider, { AuthContext } from "./src/context/AuthContext";
import AppProvider, { AppContext } from "./src/context/AppContext";
import AlertProvider from "./src/context/AlertContext";
import ThemeProvider, { useAppTheme } from "./src/context/ThemeContext";
import Rotas from "./src/rotas";
import Login from "./src/pages/Login";
import { PRINCIPAL } from "./src/theme";
import Load from "./src/componentes/Load";

// Hook simples para verificar atualização no Android via Play Store
function useVerificarAtualizacao() {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    try {
      const inAppUpdates = new SpInAppUpdates(false);

      inAppUpdates
        .checkNeedsUpdate()
        .then((result) => {
          if (!result?.shouldUpdate) return;

          let updateType = null;

          if (result.isFlexibleUpdateAllowed) {
            updateType = IAUUpdateKind.FLEXIBLE;
          } else if (result.isImmediateUpdateAllowed) {
            updateType = IAUUpdateKind.IMMEDIATE;
          }

          if (!updateType) return;

          inAppUpdates.startUpdate({ updateType });
        })
        .catch(() => {});
    } catch (e) {}
  }, []);
}

function TelaSemConexao({ colors, onRetry, carregando }) {
  const principal = colors?.principal || PRINCIPAL;
  const text = colors?.text || "#1f2933";
  const muted = colors?.muted || "#888";
  const bg = colors?.background || "#f4f5f7";
  const card = colors?.card || "#fff";

  return (
    <SafeAreaView style={[stylesOffline.root, { backgroundColor: bg }]} edges={["top", "bottom"]}>
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
    </SafeAreaView>
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

  useVerificarAtualizacao();

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const barColor = tema.dark ? "#101010" : "#f4f5f7";
    const lightIcons = !tema.dark;

    try {
      const result = changeNavigationBarColor(barColor, lightIcons);
      if (result != null && typeof result.then === "function") {
        result.catch(() => {});
      }
    } catch (e) {}
  }, [tema.dark]);

  if (!ready || !authPronto || (user && !igrejasProntas)) {
    return <Load />;
  }

  if (!user) {
    return (
      <NavigationContainer theme={tema}>
        <StatusBar
          barStyle={tema.dark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
          <Login />
        </SafeAreaView>
        <AppAlert />
      </NavigationContainer>
    );
  }

  if (semConexao && !igrejaAtiva?.id) {
    return (
      <NavigationContainer theme={tema}>
        <StatusBar
          barStyle={tema.dark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <TelaSemConexao
          colors={colors}
          onRetry={() => carregarIgrejasDoUsuario?.()}
        />
        <AppAlert />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={tema}>
      <StatusBar
        barStyle={tema.dark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <Rotas />
      <AppAlert />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <AuthProvider>
            <AppProvider>
              <AppNavigator />
            </AppProvider>
          </AuthProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
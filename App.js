import { StatusBar, View, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useContext } from "react";

import AuthProvider, { AuthContext } from "./src/context/AuthContext";
import AppProvider, { AppContext } from "./src/context/AppContext";
import Rotas from "./src/rotas";
import Login from "./src/pages/Login";
import CriarIgreja from "./src/pages/CriarIgreja";

const Tema = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#fff",
    principal: "#65C556",
    neutro: "#f6f6f6ff",
    negativo: "#EB271C",
  },
};

function TelaCarregamento() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f4f5f7",
      }}
    >
      <ActivityIndicator size="large" color="#65C556" />
    </View>
  );
}

function AppNavigator() {
  const { user, authPronto } = useContext(AuthContext);
  const { igrejasProntas, igrejasDoUsuario, igrejaAtiva } =
    useContext(AppContext);

  if (!authPronto) {
    return <TelaCarregamento />;
  }

  if (!user) {
    return <Login />;
  }

  if (!igrejasProntas) {
    return <TelaCarregamento />;
  }

  if (!igrejasDoUsuario?.length || !igrejaAtiva) {
    return (
      <NavigationContainer theme={Tema}>
        <StatusBar barStyle="dark-content" />
        <CriarIgreja />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={Tema}>
      <StatusBar barStyle="dark-content" />
      <Rotas />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
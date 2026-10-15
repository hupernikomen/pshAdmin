import { StatusBar, View, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useContext } from "react";

import AuthProvider, { AuthContext } from "./src/context/AuthContext";
import AppProvider, { AppContext } from "./src/context/AppContext";
import Rotas from "./src/rotas";
import Login from "./src/pages/Login";

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
  const { igrejasProntas } = useContext(AppContext);

  if (!authPronto) {
    return <TelaCarregamento />;
  }

  if (!user) {
    return <Login />;
  }

  // Aguarda carregar a lista de igrejas do usuário
  if (!igrejasProntas) {
    return <TelaCarregamento />;
  }

  // Sempre entra no app (Rotas). Se não houver igreja,
  // a Home mostra o empty state e o botão para Configurações.
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
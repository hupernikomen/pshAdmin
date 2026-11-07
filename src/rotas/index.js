// src/routes/index.js
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";

import Tabs from "./tabs";
import Registro from "../pages/Registro";
import Caixinhas from "../pages/Caixinhas";
import APagar from "../pages/APagar";
import AReceber from "../pages/AReceber";
import EditarRegistro from "../pages/EditarRegistro";
import Membros from "../pages/Membros";
import Configuracoes from "../pages/Configuracoes";
import Dizimos from "../pages/Dizimos";
import Projecao from "../pages/ProjecaoGastos";
import PaywallScreen from "../pages/PaywallScreen";
import Menu from "../pages/Menu";
import TrocarIgreja from "../pages/TrocarIgreja"

const Stack = createNativeStackNavigator();

export default function Rotas() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            fontFamily: 'Roboto-Bold',
            color: colors.text,
            fontSize: 20,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Projecao"
          component={Projecao}
          options={{ title: "Projeção de Gastos" }}
        />
        
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ title: "Planos" }}
        />

        <Stack.Screen
          name="Menu"
          component={Menu}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="AReceber"
          component={AReceber}
          options={{ title: "A receber" }}
        />

        <Stack.Screen
          name="Membros"
          component={Membros}
          options={{ title: "Membros" }}
        />

        <Stack.Screen
          name="Configuracoes"
          component={Configuracoes}
          options={{ title: "Configurações" }}
        />

        <Stack.Screen
          name="EditarRegistro"
          component={EditarRegistro}
          options={{ title: "Editar registro" }}
        />

        <Stack.Screen
          name="APagar"
          component={APagar}
          options={{ title: "A pagar" }}
        />

        <Stack.Screen name="Caixinhas" component={Caixinhas} />

        <Stack.Screen
          name="Registro"
          component={Registro}
          options={{ animation: "slide_from_left" }}
        />

        <Stack.Screen
          name="Dizimos"
          component={Dizimos}
          options={{ title: "Dízimos" }}
        />

        <Stack.Screen
          name="TrocarIgreja"
          component={TrocarIgreja}
          options={{ title: "Trocar Igreja" }}
        />
      </Stack.Navigator>
    </View>
  );
}
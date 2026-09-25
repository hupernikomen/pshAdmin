import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import Tabs from "./tabs";
import Registro from "../pages/Registro";
import Caixinhas from "../pages/Caixinhas";
import APagar from "../pages/APagar";
import AReceber from "../pages/AReceber";
import EditarRegistro from "../pages/EditarRegistro";
import Membros from "../pages/Membros";
import Configuracoes from "../pages/Configuracoes";

const Stack = createNativeStackNavigator();

export default function Rotas() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: {
          fontFamily: 'Roboto-Medium',
          color: '#000',
          fontSize:18
          },
          contentStyle: {
            backgroundColor: "#f4f5f7",
          },

        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
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
      </Stack.Navigator>
    </SafeAreaView>
  );
}
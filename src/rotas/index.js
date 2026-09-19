import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Tabs from './tabs';
import Registro from '../pages/Registro'
import Caixinhas from '../pages/Caixinhas'
import APagar from "../pages/APagar";
import EditarRegistro from "../pages/EditarRegistro";


const Stack = createNativeStackNavigator();

export default function Rotas() {
  return (
    <Stack.Navigator screenOptions={{
      headerTitleStyle: {
        fontSize: 18,
        fontFamily: 'Roboto-Bold',
      }
    }}>
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{
          headerShown: false,

        }}
      />


      <Stack.Screen
        name="EditarRegistro"
        component={EditarRegistro}
        options={{ title: "Editar registro" }}
      />
      <Stack.Screen name="APagar" component={APagar} options={{ title: "A pagar" }} />

      <Stack.Screen name="Caixinhas" component={Caixinhas} />
      <Stack.Screen name="Registro" component={Registro} options={{ animation: 'slide_from_left' }} />
    </Stack.Navigator>
  );
}
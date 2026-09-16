import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Tabs from './tabs';
import Registro from '../pages/Registro'
import Caixinhas from '../pages/Caixinhas'


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

      <Stack.Screen name="Caixinhas" component={Caixinhas} />
      <Stack.Screen name="Registro" component={Registro} options={{ animation: 'slide_from_left' }} />
    </Stack.Navigator>
  );
}
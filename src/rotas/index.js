import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Tabs from './tabs';
// import Menu from '../pages/Menu'

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

      {/* <Stack.Screen name="Menu" component={Menu} options={{animation:'slide_from_left'}} /> */}
    </Stack.Navigator>
  );
}
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import TabBar from '../componentes/TabBar';

import Home from '../pages/Home';
import Relatorio from '../pages/Relatorio';
import Historico from '../pages/Historico';
import { useTheme } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontFamily: 'Roboto-Bold',
          color: colors.text,
          fontSize: 18,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarIcon: 'pie-chart-outline',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Histórico"
        component={Historico}
        options={{
          tabBarIcon: 'swap-vertical',
        }}
      />
      <Tab.Screen
        name="Relatório"
        component={Relatorio}
        options={{
          tabBarIcon: 'reader-outline',
        }}
      />
    </Tab.Navigator>
  );
}
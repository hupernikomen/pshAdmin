import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import TabBar from '../componentes/TabBar';

import Home from '../pages/Home';
import Relatorio from '../pages/Relatorio'
import Historico from '../pages/Historico'

const Tab = createBottomTabNavigator();




export default function Tabs() {
  return (


    <Tab.Navigator
      initialRouteName='Home'
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerTitleStyle: {
          fontFamily: 'Roboto-Medium',
          color: '#000',
          fontSize:18,
        },
        headerShadowVisible: false,
        sceneStyle: {
          backgroundColor: "#f4f5f7",

        }

      }}>

      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarIcon: 'pie-chart-outline',
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
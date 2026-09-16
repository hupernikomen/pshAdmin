import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import TabBar from '../componentes/TabBar';

import Home from '../pages/Home';
import Relatorio from '../pages/Relatorio'
import Historico from '../pages/Historico'

const Tab = createBottomTabNavigator();


import { TabBarVisibilityProvider } from "../../src/context/TabBarVisibility";


export default function Tabs() {
  return (

    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>

      <TabBarVisibilityProvider>
        <Tab.Navigator
          initialRouteName='Home'
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerTitleStyle: {
              fontSize: 18,
              fontFamily: 'Roboto-Bold',
              marginLeft: 14,
            }
          }}>

          <Tab.Screen
            name="Home"
            component={Home}
            options={{
              title: '',
              tabBarIcon: 'pulse-outline',
            }}
          />
          <Tab.Screen
            name="Histórico"
            component={Historico}
            options={{
              tabBarIcon: 'albums-outline',
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
      </TabBarVisibilityProvider>
    </SafeAreaView>
  );
}
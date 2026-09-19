import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import TabBar from '../componentes/TabBar';

import Home from '../pages/Home';
import Relatorio from '../pages/Relatorio'
import Historico from '../pages/Historico'

const Tab = createBottomTabNavigator();




export default function Tabs() {
  return (

    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>

        <Tab.Navigator
          initialRouteName='Home'
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerTitleStyle: {
              fontSize: 20,
              fontFamily: 'Roboto-Bold',
            }
          }}>

          <Tab.Screen
            name="Home"
            component={Home}
            options={{
              title: 'Tesouraria PSH',
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
    </SafeAreaView>
  );
}
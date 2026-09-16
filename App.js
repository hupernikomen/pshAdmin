import { StatusBar, View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { useContext } from 'react';

// import AuthProvider, { AuthContext } from './src/contexts/AuthContext';
import AppProvider from './src/context/AppContext';
// import AppProvider, { AppContext } from './src/context/AppContext';
import Rotas from './src/rotas';
// import Login from './src/pages/Login';
// import TelaCarregamento from './src/componentes/TelaCarregamento';




const Tema = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#fff',
    principal: '#65C556',
    neutro: '#f6f6f6ff',
    negativo: '#EB271C'
  },
};

function AppNavigator() {
  // const { user, authPronto } = useContext(AuthContext);
  // const { appPronto } = useContext(AppContext);

  // if (!authPronto) {
  //   return (
  //     <View
  //       style={{
  //         flex: 1,
  //         justifyContent: 'center',
  //         alignItems: 'center',
  //         backgroundColor: '#fff',
  //       }}
  //     >
  //       <ActivityIndicator size="large" color="#66796b" />
  //     </View>
  //   );
  // }

  // if (!user) {
  //   return <Login />;
  // }

  return (
    <NavigationContainer theme={Tema}>
      <StatusBar barStyle="dark-content" />
      {/* {appPronto ? <Rotas /> : <TelaCarregamento />} */}
      <Rotas />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* <AuthProvider> */}
      <AppProvider>
        <AppNavigator />
      </AppProvider>
      {/* </AuthProvider> */}
    </SafeAreaProvider>
  );
}
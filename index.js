/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { EventType } from '@notifee/react-native';

// 🔔 Registra a tarefa em segundo plano do Notifee para evitar o aviso
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('Usuário clicou na notificação em background:', detail.notification);
  }
});

AppRegistry.registerComponent(appName, () => App);

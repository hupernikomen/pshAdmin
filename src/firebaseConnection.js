
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Use a MESMA config que você já tem no projeto
const firebaseConfig = {
  apiKey: "AIzaSyDJFnhKXoUqKSIzsffYWkJ7qGIuEUhlUFs",
  authDomain: "psh-admin-8c0f7.firebaseapp.com",
  projectId: "psh-admin-8c0f7",
  storageBucket: "psh-admin-8c0f7.firebasestorage.app",
  messagingSenderId: "53234150017",
  appId: "1:53234150017:web:6e64b2536d79dff74b7b80"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  // Se o Auth já foi criado (hot reload), reutiliza
  auth = getAuth(app);
}

export const db = getFirestore(app);
export { auth };
export default app;
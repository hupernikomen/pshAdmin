import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBUzudyPgQYksqyWJLQjpHfMWApAmhSuWs",
  authDomain: "tesourariaapp-dc9ee.firebaseapp.com",
  projectId: "tesourariaapp-dc9ee",
  storageBucket: "tesourariaapp-dc9ee.firebasestorage.app",
  messagingSenderId: "783811848303",
  appId: "1:783811848303:web:1e15e2647fad520b3a859a"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
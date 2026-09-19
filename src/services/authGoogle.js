import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebaseConnection";

const WEB_CLIENT_ID =
  "53234150017-ef5jlf4qgsuoa5ufi9qv8r110tqpq67l.apps.googleusercontent.com";

export function configurarGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
    scopes: ["profile", "email"],
  });
}

export async function entrarComGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
    const atual = await GoogleSignin.getCurrentUser();
    if (atual) await GoogleSignin.signOut();
  } catch (e) {}

  const response = await GoogleSignin.signIn();
  const idToken = response?.data?.idToken ?? response?.idToken;

  if (!idToken) {
    throw new Error("Não foi possível obter o idToken do Google");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export async function sairDaConta() {
  try {
    await GoogleSignin.signOut();
  } catch (e) {}
  await firebaseSignOut(auth);
}
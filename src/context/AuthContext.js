import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConnection";
import {
  configurarGoogleSignIn,
  entrarComGoogle,
  sairDaConta,
} from "../services/authGoogle";
import {
  cadastrarComEmail,
  entrarComEmail,
  redefinirSenha,
} from "../services/authEmail";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authPronto, setAuthPronto] = useState(false);

  useEffect(() => {
    configurarGoogleSignIn();

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthPronto(true);
    });

    return () => unsub();
  }, []);

  async function loginComGoogle() {
    const u = await entrarComGoogle();
    setUser(u);
    return u;
  }

  async function loginComEmail(email, senha) {
    const u = await entrarComEmail(email, senha);
    setUser(u);
    return u;
  }

  async function registrarComEmail(email, senha, nome) {
    const u = await cadastrarComEmail(email, senha, nome);
    setUser(u);
    return u;
  }

  async function enviarRedefinicaoSenha(email) {
    await redefinirSenha(email);
  }

  async function logout() {
    await sairDaConta();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        uid: user?.uid ?? null,
        authPronto,
        loginComGoogle,
        loginComEmail,
        registrarComEmail,
        enviarRedefinicaoSenha,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthProvider;
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebaseConnection";

function normalizarEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export async function cadastrarComEmail(email, senha, nome) {
  const e = normalizarEmail(email);
  const s = String(senha || "");

  if (!e || !e.includes("@")) {
    throw new Error("Informe um e-mail válido.");
  }
  if (s.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  const cred = await createUserWithEmailAndPassword(auth, e, s);

  const displayName = String(nome || "").trim();
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  return cred.user;
}

export async function entrarComEmail(email, senha) {
  const e = normalizarEmail(email);
  const s = String(senha || "");

  if (!e || !s) {
    throw new Error("Informe e-mail e senha.");
  }

  const cred = await signInWithEmailAndPassword(auth, e, s);
  return cred.user;
}

export async function redefinirSenha(email) {
  const e = normalizarEmail(email);
  if (!e || !e.includes("@")) {
    throw new Error("Informe um e-mail válido.");
  }
  await sendPasswordResetEmail(auth, e);
}
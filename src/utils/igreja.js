import {
  collection,
  doc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseConnection";

async function apagarQuery(q) {
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

/**
 * Apaga igreja + registros + caixinhas + membros.
 * Usado quando exclusaoPrevistaEm já passou (30 dias).
 */
export async function excluirIgrejaDefinitivo(igrejaId) {
  if (!igrejaId) return;

  await apagarQuery(
    query(collection(db, "registros"), where("igrejaId", "==", igrejaId))
  );

  try {
    await apagarQuery(
      query(collection(db, "caixinhas"), where("igrejaId", "==", igrejaId))
    );
  } catch (e) {
    console.log("Aviso ao apagar caixinhas:", e);
  }

  try {
    await apagarQuery(
      query(collection(db, "membros"), where("igrejaId", "==", igrejaId))
    );
  } catch (e) {
    console.log("Aviso ao apagar membros:", e);
  }

  await deleteDoc(doc(db, "igrejas", igrejaId));
}
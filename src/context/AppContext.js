import React, { createContext, useEffect, useState } from "react";
import { db } from "../firebaseConnection";
import {
  doc,
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  setDoc,
  where,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AppContext = createContext({});

export function AppProvider({ children }) {
  const [resumoFinanceiro, setResumoFinanceiro] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [dadosFinancas, setDadosFinanceiros] = useState([]);
  const [futurosTotal, setFuturosTotal] = useState(0);
  const [dadosParcelas, setDadosParcelas] = useState([]);
  const [load, setLoad] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [usuarioDoAS, setUsuarioDoAS] = useState(null);
  const [notificacao, setNotificacao] = useState("");
  const [lixo, setLixo] = useState([]);
  const [aviso, setAviso] = useState({});

  // ID temporário enquanto não temos login
  const TEMP_USER_ID = "temp_user_001";

  useEffect(() => {
    HistoricoMovimentos();
  }, []);

  async function BuscarUsuarioAsyncStorage() {
    try {
      const data = await AsyncStorage.getItem("usuarioAsyncStorage");
      if (!data) {
        setUsuarioDoAS(null);
        return null;
      }
      const parsed = JSON.parse(data);
      setUsuarioDoAS(parsed);
      return parsed;
    } catch (error) {
      console.log("Erro AsyncStorage:", error);
      setUsuarioDoAS(null);
      return null;
    }
  }

  async function HistoricoMovimentos() {
    const userId = usuarioDoAS?.usuarioId || TEMP_USER_ID;

    try {
      const q = query(
        collection(db, "registros"),
        where("idUsuario", "==", userId),
        orderBy("reg", "desc"),
        limit(300)
      );

      const snap = await getDocs(q);
      const lista = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setDadosFinanceiros(lista);
      await BuscarSaldo();
    } catch (e) {
      console.log("Erro HistoricoMovimentos:", e);
    }
  }

  async function BuscarSaldo() {
    try {
      await ResumoFinanceiro();
    } catch (e) {
      console.log("Erro BuscarSaldo:", e);
      setSaldo(0);
    }
  }

  async function ResumoFinanceiro() {
  const userId = usuarioDoAS?.usuarioId || "temp_user_001";

  try {
    const q = query(
      collection(db, "registros"),
      where("idUsuario", "==", userId)
    );

    const snap = await getDocs(q);

    let totalEntradas = 0;
    let totalSaidas = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      const isEntrada = data.tipoMovimento === "entrada";
      const isSaida = data.tipoMovimento === "saida";

      // Pega o valor já recebido/pago (ou o total se ainda não tiver pagamento parcial)
      const valor =
        data.valorRecebidoTotal ??
        data.valorPagoTotal ??
        data.valorTotal ??
        0;

      if (isEntrada) {
        totalEntradas += Number(valor) || 0;
      } else if (isSaida) {
        totalSaidas += Number(valor) || 0;
      }
    });

    const saldoFinal = totalEntradas - totalSaidas;

    setSaldo(saldoFinal);

    // Mantém o resumoFinanceiro simples por enquanto
    setResumoFinanceiro([
      {
        receita: totalEntradas,
        despesa: totalSaidas,
        saldo: saldoFinal,
      },
    ]);

    // Atualiza no Firestore
    await setDoc(doc(db, "saldo", userId), {
      atual: saldoFinal,
    });

    return saldoFinal;
  } catch (error) {
    console.log("Erro ResumoFinanceiro:", error);
    setSaldo(0);
    return 0;
  }
}

  function obterNomeMes(mes) {
    const nomes = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    return nomes[mes] || "";
  }

  async function BuscarLixeira() {
    const userId = usuarioDoAS?.usuarioId || TEMP_USER_ID;

    try {
      const q = query(
        collection(db, "lixeira"),
        where("idUsuario", "==", userId),
        orderBy("dataexclusao", "desc")
      );
      const snap = await getDocs(q);
      setLixo(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log("Erro BuscarLixeira:", e);
    }
  }

  const formatoMoeda = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AppContext.Provider
      value={{
        dadosFinancas,
        resumoFinanceiro,
        saldo,
        futurosTotal,
        dadosParcelas,
        lixo,
        load,
        setLoad,
        usuarioDoAS,
        setUsuarioDoAS,
        aviso,
        setAviso,
        notificacao,
        setNotificacao,
        swipedItemId,
        setSwipedItemId,
        HistoricoMovimentos,
        ResumoFinanceiro,
        BuscarSaldo,
        BuscarLixeira,
        obterNomeMes,
        formatoMoeda,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider
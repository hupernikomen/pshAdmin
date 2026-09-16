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
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AppContext = createContext({});

function arredondarMoney(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

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

  const [caixinhas, setCaixinhas] = useState([]);
  const [totalReservado, setTotalReservado] = useState(0);

  const TEMP_USER_ID = "temp_user_001";

  function getUserId() {
    return usuarioDoAS?.usuarioId || TEMP_USER_ID;
  }

  useEffect(() => {
    HistoricoMovimentos();
    CarregarCaixinhas();
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
    const userId = getUserId();

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
    const userId = getUserId();

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

      const saldoFinal = arredondarMoney(totalEntradas - totalSaidas);

      setSaldo(saldoFinal);

      setResumoFinanceiro([
        {
          receita: totalEntradas,
          despesa: totalSaidas,
          saldo: saldoFinal,
        },
      ]);

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

  // =========================
  // CAIXINHAS
  // =========================

  async function CarregarCaixinhas() {
    const userId = getUserId();

    try {
      const q = query(
        collection(db, "caixinhas"),
        where("idUsuario", "==", userId),
        orderBy("reg", "desc")
      );

      const snap = await getDocs(q);
      const lista = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setCaixinhas(lista);

      const reservado = arredondarMoney(
        lista.reduce((acc, item) => acc + (Number(item.valor) || 0), 0)
      );
      setTotalReservado(reservado);

      return lista;
    } catch (e) {
      console.log("Erro CarregarCaixinhas:", e);
      try {
        const q2 = query(
          collection(db, "caixinhas"),
          where("idUsuario", "==", userId)
        );
        const snap2 = await getDocs(q2);
        const lista2 = snap2.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCaixinhas(lista2);
        const reservado = arredondarMoney(
          lista2.reduce((acc, item) => acc + (Number(item.valor) || 0), 0)
        );
        setTotalReservado(reservado);
        return lista2;
      } catch (e2) {
        console.log("Erro fallback caixinhas:", e2);
        setCaixinhas([]);
        setTotalReservado(0);
        return [];
      }
    }
  }

  async function CriarCaixinha({ nome, valor = 0, meta = 0 }) {
    const userId = getUserId();
    const nomeLimpo = String(nome || "").trim();
    const valorNum = arredondarMoney(valor);
    const metaNum = arredondarMoney(meta);

    if (!nomeLimpo) {
      throw new Error("Informe o nome do ministério.");
    }

    const disponivel = arredondarMoney(
      (Number(saldo) || 0) - (Number(totalReservado) || 0)
    );

    if (valorNum > disponivel) {
      throw new Error("Valor maior que o saldo disponível.");
    }
    if (valorNum < 0) {
      throw new Error("Valor inválido.");
    }

    const payload = {
      idUsuario: userId,
      nome: nomeLimpo,
      valor: valorNum,
      meta: metaNum,
      reg: Date.now(),
    };

    const ref = await addDoc(collection(db, "caixinhas"), payload);
    await CarregarCaixinhas();
    return ref.id;
  }

  async function DepositarNaCaixinha(caixinhaId, valor) {
    const valorNum = arredondarMoney(valor);
    if (valorNum <= 0) throw new Error("Informe um valor válido.");

    const disponivel = arredondarMoney(
      (Number(saldo) || 0) - (Number(totalReservado) || 0)
    );

    if (valorNum > disponivel) {
      throw new Error("Valor maior que o saldo disponível.");
    }

    const item = caixinhas.find((c) => c.id === caixinhaId);
    if (!item) throw new Error("Caixinha não encontrada.");

    const novoValor = arredondarMoney((Number(item.valor) || 0) + valorNum);

    await updateDoc(doc(db, "caixinhas", caixinhaId), {
      valor: novoValor,
    });

    await CarregarCaixinhas();
    return novoValor;
  }

  async function RetirarDaCaixinha(caixinhaId, valor) {
    const valorNum = arredondarMoney(valor);
    if (valorNum <= 0) throw new Error("Informe um valor válido.");

    const item = caixinhas.find((c) => c.id === caixinhaId);
    if (!item) throw new Error("Caixinha não encontrada.");

    const atual = arredondarMoney(item.valor);
    if (valorNum > atual + 0.001) {
      throw new Error("Valor maior que o reservado nesta caixinha.");
    }

    const novoValor = arredondarMoney(atual - valorNum);

    await updateDoc(doc(db, "caixinhas", caixinhaId), {
      valor: novoValor,
    });

    await CarregarCaixinhas();
    return novoValor;
  }

  async function ExcluirCaixinha(caixinhaId) {
    const item = caixinhas.find((c) => c.id === caixinhaId);
    if (!item) throw new Error("Caixinha não encontrada.");

    await deleteDoc(doc(db, "caixinhas", caixinhaId));
    await CarregarCaixinhas();
  }

  function obterNomeMes(mes) {
    const nomes = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    return nomes[mes] || "";
  }

  async function BuscarLixeira() {
    const userId = getUserId();

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

  const saldoDisponivel = arredondarMoney(
    (Number(saldo) || 0) - (Number(totalReservado) || 0)
  );

  return (
    <AppContext.Provider
      value={{
        dadosFinancas,
        resumoFinanceiro,
        saldo,
        saldoDisponivel,
        totalReservado,
        caixinhas,
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
        CarregarCaixinhas,
        CriarCaixinha,
        DepositarNaCaixinha,
        RetirarDaCaixinha,
        ExcluirCaixinha,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider;
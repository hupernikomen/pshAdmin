import React, { createContext, useEffect, useState, useContext } from "react";
import { db } from "../firebaseConnection";
import {
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  limit,
  getDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "./AuthContext";

export const AppContext = createContext({});

const KEY_IGREJA_ATIVA = "@igreja_ativa_id";

function arredondarMoney(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function normalizarEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Fim do dia de hoje (ms) — movimentos futuros não entram no saldo */
function fimDoDiaTs(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function dataDoMovimento(item) {
  return Number(item?.data || item?.createdAt || item?.reg || 0) || 0;
}

/**
 * Saldo realizado: só entradas/saídas com data <= hoje.
 * Valor futuro (ex.: dízimo em 02/10 lançado em 25/09) NÃO entra.
 */
function calcularSaldoRealizado(lista) {
  const limite = fimDoDiaTs();
  let total = 0;

  (lista || []).forEach((item) => {
    const ts = dataDoMovimento(item);
    if (!ts || ts > limite) return;

    if (item.tipoMovimento === "entrada") {
      total += Number(item.valorRecebidoTotal) || 0;
    } else if (item.tipoMovimento === "saida") {
      total -= Number(item.valorPagoTotal) || 0;
    }
  });

  return arredondarMoney(total);
}

export function AppProvider({ children }) {
  const { user, uid, authPronto } = useContext(AuthContext);

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

  const [igrejasDoUsuario, setIgrejasDoUsuario] = useState([]);
  const [igrejaAtiva, setIgrejaAtiva] = useState(null);
  const [igrejasProntas, setIgrejasProntas] = useState(false);

  function getUserId() {
    return uid || user?.uid || null;
  }

  function getEmail() {
    return normalizarEmail(user?.email);
  }

  function getIgrejaId() {
    return igrejaAtiva?.id || null;
  }

  useEffect(() => {
    if (!authPronto) return;

    if (!uid) {
      setIgrejasDoUsuario([]);
      setIgrejaAtiva(null);
      setIgrejasProntas(true);
      setDadosFinanceiros([]);
      setCaixinhas([]);
      setSaldo(0);
      setTotalReservado(0);
      return;
    }

    carregarIgrejasDoUsuario();
  }, [authPronto, uid, user?.email]);

  useEffect(() => {
    if (!igrejaAtiva?.id) {
      setDadosFinanceiros([]);
      setCaixinhas([]);
      setSaldo(0);
      setTotalReservado(0);
      return;
    }
    Promise.all([HistoricoMovimentos(), CarregarCaixinhas()]);
  }, [igrejaAtiva?.id]);

  async function carregarIgrejasDoUsuario() {
    const email = getEmail();
    const userId = getUserId();
    if (!email && !userId) {
      setIgrejasProntas(true);
      return;
    }

    try {
      setIgrejasProntas(false);
      const mapa = new Map();

      if (email) {
        const qEmail = query(
          collection(db, "membros"),
          where("email", "==", email)
        );
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((d) => {
          const data = d.data();
          mapa.set(data.igrejaId, {
            membroId: d.id,
            igrejaId: data.igrejaId,
            papel: data.papel || "leitura",
            email: data.email,
            uid: data.uid || null,
          });
        });
      }

      if (userId) {
        const qUid = query(
          collection(db, "membros"),
          where("uid", "==", userId)
        );
        const snapUid = await getDocs(qUid);
        snapUid.forEach((d) => {
          const data = d.data();
          if (!mapa.has(data.igrejaId)) {
            mapa.set(data.igrejaId, {
              membroId: d.id,
              igrejaId: data.igrejaId,
              papel: data.papel || "leitura",
              email: data.email,
              uid: data.uid || null,
            });
          }
        });
      }

      const membros = Array.from(mapa.values());

      await Promise.all(
        membros.map(async (m) => {
          if (userId && !m.uid && m.membroId) {
            try {
              await updateDoc(doc(db, "membros", m.membroId), { uid: userId });
              m.uid = userId;
            } catch (e) {
              console.log("Erro ao vincular uid no membro:", e);
            }
          }
        })
      );

      const lista = [];
      for (const m of membros) {
        try {
          const ref = doc(db, "igrejas", m.igrejaId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            lista.push({
              igrejaId: m.igrejaId,
              nome: data.nome || "Igreja",
              papel: m.papel,
              membroId: m.membroId,
              createdAt: data.createdAt || null,
            });
          }
        } catch (e) {
          console.log("Erro ao ler igreja:", m.igrejaId, e);
        }
      }

      setIgrejasDoUsuario(lista);

      const salva = await AsyncStorage.getItem(KEY_IGREJA_ATIVA);
      let escolhida =
        (salva && lista.find((i) => i.igrejaId === salva)) || lista[0] || null;

      if (escolhida) {
        setIgrejaAtiva({
          id: escolhida.igrejaId,
          nome: escolhida.nome,
          papel: escolhida.papel,
          membroId: escolhida.membroId,
          createdAt: escolhida.createdAt || null,
        });
      } else {
        setIgrejaAtiva(null);
      }
    } catch (e) {
      console.log("Erro carregarIgrejasDoUsuario:", e);
      setIgrejasDoUsuario([]);
      setIgrejaAtiva(null);
    } finally {
      setIgrejasProntas(true);
    }
  }

  async function selecionarIgreja(igrejaId) {
    const item = igrejasDoUsuario.find((i) => i.igrejaId === igrejaId);
    if (!item) return;

    setIgrejaAtiva({
      id: item.igrejaId,
      nome: item.nome,
      papel: item.papel,
      membroId: item.membroId,
      createdAt: item.createdAt || null,
    });

    try {
      await AsyncStorage.setItem(KEY_IGREJA_ATIVA, igrejaId);
    } catch (e) {
      console.log("Erro ao salvar igreja ativa:", e);
    }
  }

  async function criarIgreja(nome) {
    const userId = getUserId();
    const email = getEmail();
    if (!userId || !email) {
      throw new Error("Faça login para criar uma igreja.");
    }
    const nomeLimpo = String(nome || "").trim();
    if (!nomeLimpo) {
      throw new Error("Informe o nome da igreja.");
    }

    const igrejaRef = await addDoc(collection(db, "igrejas"), {
      nome: nomeLimpo,
      createdAt: Date.now(),
      createdBy: userId,
    });

    const membroRef = await addDoc(collection(db, "membros"), {
      igrejaId: igrejaRef.id,
      email,
      uid: userId,
      papel: "admin",
      createdAt: Date.now(),
    });

    const nova = {
      igrejaId: igrejaRef.id,
      nome: nomeLimpo,
      papel: "admin",
      membroId: membroRef.id,
      createdAt: Date.now(),
    };

    setIgrejasDoUsuario((prev) => [...prev, nova]);
    setIgrejaAtiva({
      id: igrejaRef.id,
      nome: nomeLimpo,
      papel: "admin",
      membroId: membroRef.id,
      createdAt: Date.now(),
    });
    await AsyncStorage.setItem(KEY_IGREJA_ATIVA, igrejaRef.id);

    return igrejaRef.id;
  }

  async function atualizarNomeIgreja(novoNome) {
    const igrejaId = getIgrejaId();
    if (!igrejaId) throw new Error("Nenhuma igreja ativa.");
    if (igrejaAtiva?.papel !== "admin") {
      throw new Error("Apenas administradores podem alterar o nome da igreja.");
    }

    const nomeLimpo = String(novoNome || "").trim();
    if (!nomeLimpo) throw new Error("Informe o nome da igreja.");

    await updateDoc(doc(db, "igrejas", igrejaId), {
      nome: nomeLimpo,
      updatedAt: Date.now(),
    });

    setIgrejaAtiva((prev) => (prev ? { ...prev, nome: nomeLimpo } : prev));
    setIgrejasDoUsuario((prev) =>
      prev.map((ig) =>
        ig.igrejaId === igrejaId ? { ...ig, nome: nomeLimpo } : ig
      )
    );
  }

  async function adicionarMembro({ email, papel }) {
    const igrejaId = getIgrejaId();
    if (!igrejaId) throw new Error("Nenhuma igreja ativa.");
    if (igrejaAtiva?.papel !== "admin") {
      throw new Error("Apenas administradores podem cadastrar membros.");
    }

    const emailNorm = normalizarEmail(email);
    if (!emailNorm) throw new Error("Informe um e-mail válido.");

    const papelOk = ["admin", "tesoureiro", "leitura"].includes(papel)
      ? papel
      : "leitura";

    const qMesma = query(
      collection(db, "membros"),
      where("igrejaId", "==", igrejaId),
      where("email", "==", emailNorm)
    );
    const snapMesma = await getDocs(qMesma);
    if (!snapMesma.empty) {
      throw new Error("Este e-mail já é membro desta igreja.");
    }

    await addDoc(collection(db, "membros"), {
      igrejaId,
      email: emailNorm,
      uid: null,
      papel: papelOk,
      createdAt: Date.now(),
    });
  }

  async function listarMembros() {
    const igrejaId = getIgrejaId();
    if (!igrejaId) return [];

    const q = query(
      collection(db, "membros"),
      where("igrejaId", "==", igrejaId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function atualizarPapelMembro(membroId, papel) {
    if (igrejaAtiva?.papel !== "admin") {
      throw new Error("Apenas administradores.");
    }
    const papelOk = ["admin", "tesoureiro", "leitura"].includes(papel)
      ? papel
      : "leitura";
    await updateDoc(doc(db, "membros", membroId), { papel: papelOk });
  }

  async function removerMembro(membroId) {
    if (igrejaAtiva?.papel !== "admin") {
      throw new Error("Apenas administradores.");
    }
    await deleteDoc(doc(db, "membros", membroId));
  }

  function podeEditarFinanceiro() {
    const p = igrejaAtiva?.papel;
    return p === "admin" || p === "tesoureiro";
  }

  async function HistoricoMovimentos() {
    const igrejaId = getIgrejaId();
    if (!igrejaId) {
      setDadosFinanceiros([]);
      setSaldo(0);
      return [];
    }

    try {
      let lista = [];

      try {
        const q = query(
          collection(db, "registros"),
          where("igrejaId", "==", igrejaId),
          orderBy("reg", "desc")
        );
        const snap = await getDocs(q);
        lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (errIndex) {
        const q2 = query(
          collection(db, "registros"),
          where("igrejaId", "==", igrejaId)
        );
        const snap2 = await getDocs(q2);
        lista = snap2.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.reg || b.data || 0) - (a.reg || a.data || 0));
      }

      setDadosFinanceiros(lista);
      setSaldo(calcularSaldoRealizado(lista));
      return lista;
    } catch (e) {
      console.log("Erro HistoricoMovimentos:", e);
      setDadosFinanceiros([]);
      setSaldo(0);
      return [];
    }
  }

  async function ResumoFinanceiro() {
    return HistoricoMovimentos();
  }

  async function BuscarSaldo() {
    await HistoricoMovimentos();
    return saldo;
  }

  async function CarregarCaixinhas() {
    const igrejaId = getIgrejaId();
    if (!igrejaId) {
      setCaixinhas([]);
      setTotalReservado(0);
      return [];
    }

    try {
      const q = query(
        collection(db, "caixinhas"),
        where("igrejaId", "==", igrejaId),
        orderBy("reg", "desc")
      );
      const snap = await getDocs(q);
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCaixinhas(lista);
      const total = lista.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
      setTotalReservado(arredondarMoney(total));
      return lista;
    } catch (e) {
      try {
        const q2 = query(
          collection(db, "caixinhas"),
          where("igrejaId", "==", igrejaId)
        );
        const snap2 = await getDocs(q2);
        const lista = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCaixinhas(lista);
        const total = lista.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
        setTotalReservado(arredondarMoney(total));
        return lista;
      } catch (e2) {
        setCaixinhas([]);
        setTotalReservado(0);
        return [];
      }
    }
  }

  async function CriarCaixinha(nome, valorInicial = 0) {
    const igrejaId = getIgrejaId();
    const userId = getUserId();
    if (!igrejaId) throw new Error("Nenhuma igreja ativa.");
    if (!podeEditarFinanceiro()) throw new Error("Sem permissão.");

    const valor = arredondarMoney(valorInicial);
    await addDoc(collection(db, "caixinhas"), {
      igrejaId,
      idUsuario: userId,
      nome: String(nome || "").trim(),
      valor,
      reg: Date.now(),
      createdAt: Date.now(),
    });
    await CarregarCaixinhas();
  }

  async function DepositarNaCaixinha(caixinhaId, valor) {
    if (!podeEditarFinanceiro()) throw new Error("Sem permissão.");
    const v = arredondarMoney(valor);
    if (v <= 0) throw new Error("Valor inválido.");
    const cx = caixinhas.find((c) => c.id === caixinhaId);
    if (!cx) throw new Error("Caixinha não encontrada.");
    await updateDoc(doc(db, "caixinhas", caixinhaId), {
      valor: arredondarMoney((Number(cx.valor) || 0) + v),
    });
    await CarregarCaixinhas();
  }

  async function RetirarDaCaixinha(caixinhaId, valor) {
    if (!podeEditarFinanceiro()) throw new Error("Sem permissão.");
    const v = arredondarMoney(valor);
    if (v <= 0) throw new Error("Valor inválido.");
    const cx = caixinhas.find((c) => c.id === caixinhaId);
    if (!cx) throw new Error("Caixinha não encontrada.");
    const atual = Number(cx.valor) || 0;
    if (v > atual + 0.001) throw new Error("Saldo insuficiente na caixinha.");
    await updateDoc(doc(db, "caixinhas", caixinhaId), {
      valor: arredondarMoney(atual - v),
    });
    await CarregarCaixinhas();
  }

  async function ExcluirCaixinha(caixinhaId) {
    if (!podeEditarFinanceiro()) throw new Error("Sem permissão.");
    await deleteDoc(doc(db, "caixinhas", caixinhaId));
    await CarregarCaixinhas();
  }

  async function BuscarLixeira() {
    const igrejaId = getIgrejaId();
    if (!igrejaId) {
      setLixo([]);
      return;
    }
    try {
      const q = query(
        collection(db, "lixeira"),
        where("igrejaId", "==", igrejaId),
        orderBy("dataexclusao", "desc")
      );
      const snap = await getDocs(q);
      setLixo(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log("Erro BuscarLixeira:", e);
    }
  }

  function obterNomeMes(mes) {
    const nomes = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    return nomes[mes] || "";
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
        igrejasDoUsuario,
        igrejaAtiva,
        igrejasProntas,
        carregarIgrejasDoUsuario,
        selecionarIgreja,
        criarIgreja,
        atualizarNomeIgreja,
        adicionarMembro,
        listarMembros,
        atualizarPapelMembro,
        removerMembro,
        podeEditarFinanceiro,
        getIgrejaId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider;
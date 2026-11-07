import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebaseConnection";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { MINISTERIOS } from "../constants/ministerios";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  valorAPagarItem,
} from "../utils/financeiro";

const TIPOS_SAIDA = [
  { id: "Fixa", exemplo: "Energia, internet, aluguel, prebenda, etc." },
  { id: "Avulsa", exemplo: "Manutenção, material de limpeza, serviços, etc." },
  { id: "Parcelada", exemplo: "Compras no cartão ou acordadas." },
];

function parseNumero(txt) {
  if (txt === null || txt === undefined) return 0;
  let s = String(txt).trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (!(parts.length === 2 && parts[1].length <= 2)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function maisUmMes(d) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

function chaveMes(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesesEntre(anoIni, mesIni, anoFim, mesFim) {
  const list = [];
  let a = anoIni;
  let m = mesIni;
  while (a < anoFim || (a === anoFim && m <= mesFim)) {
    list.push({
      ano: a,
      mes: m,
      key: `${a}-${String(m + 1).padStart(2, "0")}`,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      a += 1;
    }
  }
  return list;
}

function inicioMediaFromCreatedAt(createdAt) {
  const d = new Date(Number(createdAt) || 0);
  if (!createdAt || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

function saidaNoMesItem(item, mes, ano, limiteHoje) {
  if (item?.tipoMovimento !== "saida") return 0;
  const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
  if (pagos.length > 0) {
    return pagos.reduce((acc, p) => {
      const ts = Number(p.data || 0);
      if (!ts || ts > limiteHoje) return acc;
      const d = new Date(ts);
      if (d.getMonth() === mes && d.getFullYear() === ano) {
        return acc + (Number(p.valor) || 0);
      }
      return acc;
    }, 0);
  }
  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  const pagas = parcelas.filter(
    (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
  );
  if (pagas.length > 0) {
    return pagas.reduce((acc, p) => {
      const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
      if (!ts || ts > limiteHoje) return acc;
      const d = new Date(ts);
      if (d.getMonth() === mes && d.getFullYear() === ano) {
        return acc + (Number(p.valor) || 0);
      }
      return acc;
    }, 0);
  }
  const ts = dataDoItem(item);
  if (ts && ts <= limiteHoje) {
    const d = new Date(ts);
    if (d.getMonth() === mes && d.getFullYear() === ano) {
      return Number(item.valorPagoTotal) || 0;
    }
  }
  return 0;
}

function calcularMediaDizimos(lista, igrejaAtiva) {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const limiteHoje = fimDoDiaTs(agora);
  const inicioMedia = inicioMediaFromCreatedAt(igrejaAtiva?.createdAt);

  if (inicioMedia) {
    const idxInicio = inicioMedia.getFullYear() * 12 + inicioMedia.getMonth();
    const idxAtual = anoAtual * 12 + mesAtual;
    const meses = idxAtual - idxInicio + 1;
    if (meses < 1) return 0;
    const total = (lista || [])
      .filter((i) => i.tipoMovimento === "entrada" && i.tipo === "Dízimo")
      .reduce((acc, i) => {
        const recebidos = Array.isArray(i.valoresRecebidos)
          ? i.valoresRecebidos
          : [];
        if (recebidos.length > 0) {
          return (
            acc +
            recebidos.reduce((s, r) => {
              const ts = Number(r.data || 0);
              if (!ts || ts > limiteHoje || ts < inicioMedia.getTime()) return s;
              const d = new Date(ts);
              const idx = d.getFullYear() * 12 + d.getMonth();
              if (idx >= idxInicio && idx <= idxAtual) {
                return s + (Number(r.valor) || 0);
              }
              return s;
            }, 0)
          );
        }
        const ts = dataDoItem(i);
        if (!ts || ts > limiteHoje || ts < inicioMedia.getTime()) return acc;
        const d = new Date(ts);
        const idx = d.getFullYear() * 12 + d.getMonth();
        if (idx >= idxInicio && idx <= idxAtual) {
          return acc + (Number(i.valorRecebidoTotal) || 0);
        }
        return acc;
      }, 0);
    return arred(total / meses);
  }

  const totalAno = (lista || [])
    .filter((i) => i.tipoMovimento === "entrada" && i.tipo === "Dízimo")
    .reduce((acc, i) => {
      let s = 0;
      for (let m = 0; m <= mesAtual; m++) {
        const recebidos = Array.isArray(i.valoresRecebidos)
          ? i.valoresRecebidos
          : [];
        if (recebidos.length > 0) {
          s += recebidos.reduce((sum, r) => {
            const ts = Number(r.data || 0);
            if (!ts || ts > limiteHoje) return sum;
            const d = new Date(ts);
            if (d.getMonth() === m && d.getFullYear() === anoAtual) {
              return sum + (Number(r.valor) || 0);
            }
            return sum;
          }, 0);
        } else {
          const ts = dataDoItem(i);
          if (ts && ts <= limiteHoje) {
            const d = new Date(ts);
            if (d.getMonth() === m && d.getFullYear() === anoAtual) {
              s += Number(i.valorRecebidoTotal) || 0;
            }
          }
        }
      }
      return acc + s;
    }, 0);
  return arred(mesAtual + 1 > 0 ? totalAno / (mesAtual + 1) : 0);
}

function calcularMediaContaFixa(lista, igrejaAtiva) {
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const limiteHoje = fimDoDiaTs(agora);
  const inicioMedia = inicioMediaFromCreatedAt(igrejaAtiva?.createdAt);
  const fixas = (lista || []).filter(
    (i) => i.tipoMovimento === "saida" && i.tipo === "Fixa"
  );
  if (!fixas.length) return 0;

  if (inicioMedia) {
    const idxInicio = inicioMedia.getFullYear() * 12 + inicioMedia.getMonth();
    const idxAtual = anoAtual * 12 + mesAtual;
    const meses = idxAtual - idxInicio + 1;
    if (meses < 1) return 0;
    let total = 0;
    for (let idx = idxInicio; idx <= idxAtual; idx++) {
      const ano = Math.floor(idx / 12);
      const mes = idx % 12;
      fixas.forEach((item) => {
        total += saidaNoMesItem(item, mes, ano, limiteHoje);
      });
    }
    return arred(total / meses);
  }

  let totalAno = 0;
  for (let m = 0; m <= mesAtual; m++) {
    fixas.forEach((item) => {
      totalAno += saidaNoMesItem(item, m, anoAtual, limiteHoje);
    });
  }
  return arred(mesAtual + 1 > 0 ? totalAno / (mesAtual + 1) : 0);
}

function valorQuitadoFuturo(item, limiteHoje) {
  if (item?.tipoMovimento !== "saida" || item?.tipo === "Saldo inicial") return 0;
  const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
  if (pagos.length > 0) {
    return pagos.reduce((acc, p) => {
      const ts = Number(p.data || 0);
      if (ts > limiteHoje) return acc + (Number(p.valor) || 0);
      return acc;
    }, 0);
  }
  const ts = dataDoItem(item);
  const pago = Number(item.valorPagoTotal) || 0;
  if (ts > limiteHoje && pago > 0) return pago;
  return 0;
}

function marcarPai(porItem, parentId, child) {
  const prev = porItem[parentId];
  if (!prev) {
    porItem[parentId] = { ...child };
    return;
  }
  if (!child.ok) {
    porItem[parentId] = {
      ok: false,
      saldoAntes: prev.ok ? child.saldoAntes : prev.saldoAntes,
      saldoApos: prev.ok ? child.saldoAntes : prev.saldoApos,
    };
    return;
  }
  if (prev.ok) {
    porItem[parentId] = {
      ok: true,
      saldoAntes: prev.saldoAntes,
      saldoApos: child.saldoApos,
    };
  }
}

function expandirParaSimulacao(lista) {
  const mensais = [];
  (lista || []).forEach((g) => {
    const parentId = g.id;
    const valorTotal = arred(Number(g.valor) || 0);
    if (g.tipo === "Parcelada") {
      const n = Math.max(1, parseInt(g.quantidadeParcelas, 10) || 1);
      const base = arred(valorTotal / n);
      const inicio = Number(g.dataPrimeiraParcela || g.data) || Date.now();
      for (let i = 1; i <= n; i++) {
        const valor = i === n ? arred(total - base * (n - 1)) : base;
        const venc = new Date(inicio);
        venc.setMonth(venc.getMonth() + (i - 1));
        mensais.push({
          id: `${parentId}#${i}`,
          parentId,
          data: venc.getTime(),
          valor,
          descricao: `${g.descricao || "Gasto"} (${i}/${n})`,
        });
      }
      return;
    }
    mensais.push({
      id: parentId,
      parentId,
      data: Number(g.data) || Date.now(),
      valor: valorTotal,
      descricao: g.descricao || "Gasto",
    });
  });
  return { mensais };
}

export function montarIndicadoresProjecao({ dadosFinancas, saldo, igrejaAtiva }) {
  const listaFin = dadosFinancas || [];
  const limite = fimDoDiaTs();
  let aReceber = 0;
  let aPagar = 0;
  let quitadoFuturo = 0;
  listaFin.forEach((item) => {
    aReceber += valorAReceberItem(item, limite) || 0;
    aPagar += valorAPagarItem(item, limite) || 0;
    quitadoFuturo += valorQuitadoFuturo(item, limite) || 0;
  });
  const saldoAtual = Number(saldo) || 0;
  return {
    saldoAtual,
    aReceber: arred(aReceber),
    aPagar: arred(aPagar),
    quitadoFuturo: arred(quitadoFuturo),
    saldoProjetado: arred(saldoAtual + aReceber - aPagar - quitadoFuturo),
    mediaDizimos: calcularMediaDizimos(listaFin, igrejaAtiva),
    mediaContaFixa: calcularMediaContaFixa(listaFin, igrejaAtiva),
  };
}

export function simularViabilidade({
  saldoProjetadoInicial,
  mediaDizimos,
  mediaContaFixa,
  gastosExistentes,
  novoGasto,
}) {
  const agora = new Date();
  const mesIni = agora.getMonth();
  const anoIni = agora.getFullYear();
  const todos = [...(gastosExistentes || [])];
  if (novoGasto) {
    todos.push({
      id: "__novo__",
      data: Number(novoGasto.data),
      valor: Number(novoGasto.valor) || 0,
      descricao: novoGasto.descricao || "",
      tipo: novoGasto.tipo,
      quantidadeParcelas: novoGasto.quantidadeParcelas,
      dataPrimeiraParcela: novoGasto.dataPrimeiraParcela,
    });
  }

  const { mensais } = expandirParaSimulacao(todos);
  const porItem = {};

  if (!mensais.length) {
    return {
      ok: true,
      saldoFinal: arred(saldoProjetadoInicial),
      porItem,
      motivo: "",
    };
  }

  let saldo = arred(saldoProjetadoInicial);
  let okGeral = true;
  let motivo = "";

  mensais.sort((a, b) => (a.data || 0) - (b.data || 0));
  const ultima = new Date(mensais[mensais.length - 1].data);
  const meses =
    ultima.getFullYear() < anoIni
      ? []
      : mesesEntre(
        anoIni,
        mesIni,
        ultima.getFullYear(),
        ultima.getFullYear() === anoIni
          ? Math.max(mesIni, ultima.getMonth())
          : ultima.getMonth()
      );

  const porMes = {};
  mensais.forEach((g) => {
    const k = chaveMes(g.data);
    if (!porMes[k]) porMes[k] = [];
    porMes[k].push(g);
  });

  const listaMeses = meses.length
    ? meses
    : [{ key: chaveMes(Date.now()), ano: anoIni, mes: mesIni }];

  for (const m of listaMeses) {
    saldo = arred(
      saldo + (Number(mediaDizimos) || 0) - (Number(mediaContaFixa) || 0)
    );
    const listaMes = porMes[m.key] || [];
    listaMes.sort((a, b) => (a.data || 0) - (b.data || 0));
    for (const g of listaMes) {
      const valor = arred(g.valor);
      const saldoAntes = saldo;
      if (saldo + 0.001 < valor) {
        okGeral = false;
        if (!motivo) {
          motivo = `Sem saldo em ${String(m.mes + 1).padStart(2, "0")}/${m.ano
            } para "${g.descricao}" (R$ ${valor
              .toFixed(2)
              .replace(".", ",")}). Disponível: R$ ${saldo
                .toFixed(2)
                .replace(".", ",")}.`;
        }
        const child = { ok: false, saldoAntes, saldoApos: saldoAntes };
        porItem[g.id] = child;
        marcarPai(porItem, g.parentId, child);
        continue;
      }
      saldo = arred(saldo - valor);
      const child = { ok: true, saldoAntes, saldoApos: saldo };
      porItem[g.id] = child;
      marcarPai(porItem, g.parentId, child);
    }
  }

  return { ok: okGeral, saldoFinal: saldo, porItem, motivo };
}

export function calcularSaldoFinalProjecao({
  dadosFinancas,
  saldo,
  igrejaAtiva,
  gastos,
}) {
  const ind = montarIndicadoresProjecao({ dadosFinancas, saldo, igrejaAtiva });
  return simularViabilidade({
    saldoProjetadoInicial: ind.saldoProjetado,
    mediaDizimos: ind.mediaDizimos,
    mediaContaFixa: ind.mediaContaFixa,
    gastosExistentes: gastos || [],
    novoGasto: null,
  }).saldoFinal;
}

export default function ProjecaoGastos() {
  const {
    dadosFinancas,
    saldo,
    load,
    HistoricoMovimentos,
    formatoMoeda,
    igrejaAtiva,
    getIgrejaId,
    podeEditarFinanceiro,
    CarregarCaixinhas,
  } = useContext(AppContext);

  const { uid } = useAuth();
  const { showAlert } = useAppAlert();
  const { colors, dark } = useTheme();
  const navigation = useNavigation();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : colors.neutro || "#f4f5f7";
  const separator = colors.border || (dark ? "#333" : "#ececec");
  const danger = colors.negativo || "#C62828";
  const podeEditar = !!podeEditarFinanceiro?.();

  const [refreshing, setRefreshing] = useState(false);
  const [lista, setLista] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [openId, setOpenId] = useState(null);

  const [modal, setModal] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTxt, setValorTxt] = useState("");
  const [dataPag, setDataPag] = useState(new Date());
  const [dataPrimeira, setDataPrimeira] = useState(() => maisUmMes(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [showDatePrimeira, setShowDatePrimeira] = useState(false);
  const [tipo, setTipo] = useState(null);
  const [ministerio, setMinisterio] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("2");
  const [salvando, setSalvando] = useState(false);

  const [modalTipo, setModalTipo] = useState(false);
  const [modalMinisterio, setModalMinisterio] = useState(false);

  const indicadores = useMemo(
    () =>
      montarIndicadoresProjecao({
        dadosFinancas,
        saldo,
        igrejaAtiva,
      }),
    [dadosFinancas, saldo, igrejaAtiva]
  );

  const saldoProjetadoTela = useMemo(
    () =>
      calcularSaldoFinalProjecao({
        dadosFinancas,
        saldo,
        igrejaAtiva,
        gastos: lista,
      }),
    [dadosFinancas, saldo, igrejaAtiva, lista]
  );

  const qtdNum = Math.max(1, parseInt(qtdParcelas, 10) || 1);
  const valorTotalNum = parseNumero(valorTxt);
  const previewParcela =
    tipo === "Parcelada" && valorTotalNum > 0
      ? arred(valorTotalNum / qtdNum)
      : 0;

  const carregar = useCallback(async () => {
    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      setLista([]);
      setCarregandoLista(false);
      return;
    }
    try {
      setCarregandoLista(true);
      const q = query(
        collection(db, "gastosProjetados"),
        where("igrejaId", "==", igrejaId),
        orderBy("data", "asc")
      );
      const snap = await getDocs(q);
      setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log("Erro carregar projeção:", e);
      try {
        const q2 = query(
          collection(db, "gastosProjetados"),
          where("igrejaId", "==", igrejaId)
        );
        const snap2 = await getDocs(q2);
        const arr = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (Number(a.data) || 0) - (Number(b.data) || 0));
        setLista(arr);
      } catch (e2) {
        setLista([]);
      }
    } finally {
      setCarregandoLista(false);
    }
  }, [getIgrejaId, igrejaAtiva?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      HistoricoMovimentos?.(),
      CarregarCaixinhas?.(),
      carregar(),
    ]);
    setRefreshing(false);
  };

  function resetForm() {
    setDescricao("");
    setValorTxt("");
    setDataPag(new Date());
    setDataPrimeira(maisUmMes(new Date()));
    setTipo(null);
    setMinisterio("");
    setObservacao("");
    setQtdParcelas("2");
  }

  function abrirModal() {
    if (!podeEditar) {
      showAlert({
        title: "Sem permissão",
        message: "Seu perfil não pode criar gastos projetados.",
      });
      return;
    }
    resetForm();
    setModal(true);
  }

  function escolherTipo(id) {
    setTipo(id);
    setModalTipo(false);
    if (id === "Parcelada") {
      setDataPrimeira(maisUmMes(new Date()));
    }
  }

  async function salvar() {
    if (!podeEditar) return;
    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      showAlert({ title: "Erro", message: "Igreja não identificada." });
      return;
    }
    if (!tipo) {
      showAlert({ title: "Atenção", message: "Selecione o tipo." });
      return;
    }
    if (!descricao.trim()) {
      showAlert({ title: "Atenção", message: "Informe a descrição." });
      return;
    }
    const valor = parseNumero(valorTxt);
    if (!(valor > 0)) {
      showAlert({ title: "Atenção", message: "Informe um valor válido." });
      return;
    }
    if (tipo === "Parcelada") {
      const qtd = parseInt(qtdParcelas, 10) || 0;
      if (qtd < 2) {
        showAlert({
          title: "Atenção",
          message: "Informe ao menos 2 parcelas.",
        });
        return;
      }
    }

    const sim = simularViabilidade({
      saldoProjetadoInicial: indicadores.saldoProjetado,
      mediaDizimos: indicadores.mediaDizimos,
      mediaContaFixa: indicadores.mediaContaFixa,
      gastosExistentes: lista,
      novoGasto: {
        data: tipo === "Parcelada" ? dataPrimeira.getTime() : dataPag.getTime(),
        valor,
        descricao: descricao.trim(),
        tipo,
        quantidadeParcelas: qtdParcelas,
        dataPrimeiraParcela: dataPrimeira.getTime(),
      },
    });

    if (!sim.ok) {
      showAlert({
        title: "Projeção apertada",
        message:
          sim.motivo ||
          "Esse gasto pode comprometer o saldo projetado nos próximos meses.",
        buttons: [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Salvar mesmo assim",
            onPress: () => persistirGasto(valor),
          },
        ],
      });
      return;
    }

    await persistirGasto(valor);
  }

  async function persistirGasto(valor) {
    const igrejaId = getIgrejaId?.();
    if (!igrejaId) return;
    try {
      setSalvando(true);
      const payload = {
        igrejaId,
        idUsuario: uid || null,
        descricao: descricao.trim(),
        valor: arred(valor),
        tipo,
        data:
          tipo === "Parcelada" ? dataPrimeira.getTime() : dataPag.getTime(),
        dataPrimeiraParcela:
          tipo === "Parcelada" ? dataPrimeira.getTime() : null,
        quantidadeParcelas:
          tipo === "Parcelada"
            ? Math.max(2, parseInt(qtdParcelas, 10) || 2)
            : null,
        ministerio: ministerio || null,
        observacao: observacao.trim() || null,
        origemPagamento: "geral",
        caixinhaId: null,
        caixinhaNome: null,
        createdAt: Date.now(),
        reg: Date.now(),
      };
      await addDoc(collection(db, "gastosProjetados"), payload);
      setModal(false);
      resetForm();
      await carregar();
    } catch (e) {
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível salvar.",
      });
    } finally {
      setSalvando(false);
    }
  }

  function pedirRegistrar(item) {
    if (!podeEditar) {
      showAlert({
        title: "Sem permissão",
        message: "Seu perfil não pode registrar despesas.",
      });
      return;
    }
    setOpenId(null);
    navigation.navigate("Registro", {
      preencherGasto: {
        tipoMovimento: "saida",
        tipo: item.tipo || "Avulsa",
        descricao: item.descricao || "",
        ministerio: item.ministerio || "",
        observacao: item.observacao || "",
        quantidadeParcelas: item.quantidadeParcelas ? String(item.quantidadeParcelas) : "1",
        data: item.data ? new Date(item.data) : new Date(),
      },
    });
  }

  function excluir(item) {
    if (!podeEditar) return;
    showAlert({
      title: "Excluir projeção",
      message: `Remover "${item.descricao || "este gasto"}" da projeção?`,
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "gastosProjetados", item.id));
              setOpenId(null);
              await carregar();
            } catch (e) {
              showAlert({
                title: "Erro",
                message: "Não foi possível excluir.",
              });
            }
          },
        },
      ],
    });
  }

  if ((load || carregandoLista) && !refreshing && !lista.length) {
    return <Load />;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={[styles.kpiSingle, { backgroundColor: card }]}>
              <Text style={[styles.kpiLabel, { color: muted }]}>
                Saldo projetado
              </Text>
              <Text style={[styles.kpiValue, { color: text }]}>
                R$ {formatoMoeda.format(saldoProjetadoTela)}
              </Text>
            </View>

            {podeEditar && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: principal }]}
                onPress={abrirModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Novo gasto projetado</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={muted} />
            <Text style={[styles.emptyTitle, { color: text }]}>
              Nenhum gasto projetado
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              Cadastre despesas futuras para simular o impacto no caixa.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dataLabel = item.data
            ? new Date(item.data).toLocaleDateString("pt-BR")
            : "—";
          const sub =
            item.tipo === "Parcelada"
              ? `${item.tipo} · ${item.quantidadeParcelas || "?"}x · ${dataLabel}`
              : `${item.tipo || "Gasto"} · ${dataLabel}`;

          return (
            <SwipeCard
              icon="calendar-outline"
              iconColor={dark ? "#FFB74D" : "#EF6C00"}
              tint={dark ? "#3D2E1A" : "#FFF3E0"}
              title={item.descricao || "Gasto projetado"}
              subtitle={sub}
              value={`R$ ${formatoMoeda.format(Number(item.valor) || 0)}`}
              open={openId === item.id}
              onOpenChange={(v) => setOpenId(v ? item.id : null)}
              actions={
                podeEditar
                  ? [
                    {
                      key: "go",
                      icon: "checkmark-outline",
                      label: "Registrar",
                      backgroundColor: principal,
                      onPress: () => pedirRegistrar(item),
                    },
                    {
                      key: "del",
                      icon: "trash-outline",
                      label: "Excluir",
                      backgroundColor: danger,
                      onPress: () => excluir(item),
                    },
                  ]
                  : []
              }
            />
          );
        }}
      />

      {/* Modal para Adicionar Novo Gasto Projetado */}
      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModal(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: card }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <Text style={[styles.modalTitle, { color: text }]}>
                Novo gasto projetado
              </Text>

              <TouchableOpacity
                style={[styles.field, { backgroundColor: surface }]}
                onPress={() => setModalTipo(true)}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>Tipo</Text>
                <View style={styles.fieldRow}>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: tipo ? text : muted },
                    ]}
                  >
                    {tipo || "Selecione o tipo"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={muted} />
                </View>
              </TouchableOpacity>

              {!!tipo && tipo !== "Parcelada" && (
                <TouchableOpacity
                  style={[styles.field, { backgroundColor: surface }]}
                  onPress={() => setShowDate(true)}
                >
                  <Text style={[styles.fieldLabel, { color: muted }]}>
                    Data
                  </Text>
                  <Text style={[styles.fieldValue, { color: text }]}>
                    {dataPag.toLocaleDateString("pt-BR")}
                  </Text>
                </TouchableOpacity>
              )}
              {showDate && (
                <DateTimePicker
                  value={dataPag}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setShowDate(false);
                    if (d) {
                      setDataPag(d);
                      setDataPrimeira(maisUmMes(d));
                    }
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.field, { backgroundColor: surface }]}
                onPress={() => setModalMinisterio(true)}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Ministério (opcional)
                </Text>
                <View style={styles.fieldRow}>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: ministerio ? text : muted },
                    ]}
                  >
                    {ministerio || "Selecione o ministério"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={muted} />
                </View>
              </TouchableOpacity>

              <View style={[styles.field, { backgroundColor: surface }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Descrição
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text }]}
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descreva a despesa"
                  placeholderTextColor={muted}
                />
              </View>

              <View style={[styles.field, { backgroundColor: surface }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Valor total
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text }]}
                  value={valorTxt}
                  onChangeText={setValorTxt}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={muted}
                />
              </View>

              {tipo === "Parcelada" && (
                <>
                  <View style={[styles.field, { backgroundColor: surface }]}>
                    <Text style={[styles.fieldLabel, { color: muted }]}>
                      Quantidade de parcelas
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: text }]}
                      value={qtdParcelas}
                      onChangeText={setQtdParcelas}
                      keyboardType="number-pad"
                      placeholder="2"
                      placeholderTextColor={muted}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.field, { backgroundColor: surface }]}
                    onPress={() => setShowDatePrimeira(true)}
                  >
                    <Text style={[styles.fieldLabel, { color: muted }]}>
                      Data da primeira parcela
                    </Text>
                    <Text style={[styles.fieldValue, { color: text }]}>
                      {dataPrimeira.toLocaleDateString("pt-BR")}
                    </Text>
                  </TouchableOpacity>
                  {showDatePrimeira && (
                    <DateTimePicker
                      value={dataPrimeira}
                      mode="date"
                      display="default"
                      onChange={(_, d) => {
                        setShowDatePrimeira(false);
                        if (d) setDataPrimeira(d);
                      }}
                    />
                  )}
                  {previewParcela > 0 && (
                    <Text style={[styles.hint, { color: muted }]}>
                      {qtdNum}x de R$ {formatoMoeda.format(previewParcela)}
                    </Text>
                  )}
                </>
              )}

              <View
                style={[
                  styles.field,
                  { backgroundColor: surface, minHeight: 72 },
                ]}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Observação
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text, minHeight: 40 }]}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                  placeholder="Opcional"
                  placeholderTextColor={muted}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btnCancel, { backgroundColor: surface }]}
                  onPress={() => setModal(false)}
                >
                  <Text style={[styles.btnCancelText, { color: muted }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnOk,
                    { backgroundColor: principal },
                    salvando && { opacity: 0.7 },
                  ]}
                  onPress={salvar}
                  disabled={salvando}
                >
                  <Text style={styles.btnOkText}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Escolha de Tipo */}
      <Modal
        visible={modalTipo}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTipo(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalTipo(false)}
        >
          <Pressable
            style={[styles.pickerCard, { backgroundColor: card }]}
            onPress={() => { }}
          >
            <Text style={[styles.modalTitle, { color: text }]}>Tipo</Text>
            {TIPOS_SAIDA.map((item, index) => {
              const ativo = tipo === item.id;
              const ultimo = index === TIPOS_SAIDA.length - 1;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerItem,
                    !ultimo && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: separator,
                    },
                  ]}
                  onPress={() => escolherTipo(item.id)}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.pickerTitle, { color: text }]}>
                      {item.id}
                    </Text>
                    <Text style={[styles.pickerEx, { color: muted }]}>
                      {item.exemplo}
                    </Text>
                  </View>
                  {ativo && (
                    <Ionicons name="checkmark" size={18} color={principal} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Escolha de Ministério */}
      <Modal
        visible={modalMinisterio}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMinisterio(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalMinisterio(false)}
        >
          <Pressable
            style={[styles.pickerCard, { backgroundColor: card }]}
            onPress={() => { }}
          >
            <Text style={[styles.modalTitle, { color: text }]}>Ministério</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: separator,
                  },
                ]}
                onPress={() => {
                  setMinisterio("");
                  setModalMinisterio(false);
                }}
              >
                <Text style={[styles.pickerTitle, { color: muted }]}>
                  Nenhum
                </Text>
                {!ministerio && (
                  <Ionicons name="checkmark" size={18} color={principal} />
                )}
              </TouchableOpacity>
              {(MINISTERIOS || []).map((m, index) => {
                const ativo = ministerio === m;
                const ultimo = index === (MINISTERIOS || []).length - 1;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.pickerItem,
                      !ultimo && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: separator,
                      },
                    ]}
                    onPress={() => {
                      setMinisterio(m);
                      setModalMinisterio(false);
                    }}
                  >
                    <Text style={[styles.pickerTitle, { color: text }]}>
                      {m}
                    </Text>
                    {ativo && (
                      <Ionicons name="checkmark" size={18} color={principal} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 100,
    gap: 8,
  },
  headerBlock: { marginBottom: 8 },
  kpiSingle: { borderRadius: 16, padding: 14, marginBottom: 12 },
  kpiLabel: { fontSize: 12, fontFamily: "Roboto-Light", marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: "Roboto-Bold" },
  addBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontFamily: "Roboto-Bold" },
  empty: { marginTop: 40, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontFamily: "Roboto-Medium" },
  emptyText: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { borderRadius: 20, padding: 16, maxHeight: "92%" },
  pickerCard: { borderRadius: 20, padding: 16, maxHeight: "80%" },
  modalTitle: { fontSize: 17, fontFamily: "Roboto-Bold", marginBottom: 12 },
  field: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldValue: { fontSize: 15, fontFamily: "Roboto-Medium", flex: 1 },
  fieldInput: { fontSize: 15, fontFamily: "Roboto-Regular", padding: 0 },
  hint: { fontSize: 13, fontFamily: "Roboto-Regular", marginBottom: 8 },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelText: { fontSize: 14, fontFamily: "Roboto-Medium" },
  btnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOkText: { fontSize: 14, fontFamily: "Roboto-Bold", color: "#fff" },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  pickerTitle: { fontSize: 15, fontFamily: "Roboto-Medium" },
  pickerEx: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    lineHeight: 16,
  },
});
import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  PermissionsAndroid,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
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
  { id: "Sem Prazo", exemplo: "Conta a pagar sem data definida, provisão futura." },
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

function isDataFutura(d) {
  return inicioDoDia(d || new Date()).getTime() > inicioDoDia(new Date()).getTime();
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
        const recebidos = Array.isArray(i.valoresRecebidos) ? i.valoresRecebidos : [];
        if (recebidos.length > 0) {
          return (
            acc +
            recebidos.reduce((s, r) => {
              const ts = Number(r.data || 0);
              if (!ts || ts > limiteHoje || ts < inicioMedia.getTime()) return s;
              const d = new Date(ts);
              const idx = d.getFullYear() * 12 + d.getMonth();
              if (idx >= idxInicio && idx <= idxAtual) return s + (Number(r.valor) || 0);
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
        const recebidos = Array.isArray(i.valoresRecebidos) ? i.valoresRecebidos : [];
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
  const semPrazo = [];
  (lista || []).forEach((g) => {
    const parentId = g.id;
    const valorTotal = arred(Number(g.valor) || 0);
    if (g.tipo === "Sem Prazo") {
      semPrazo.push({
        id: parentId,
        parentId,
        valor: valorTotal,
        descricao: g.descricao || "Gasto",
        data: Number(g.data) || 0,
      });
      return;
    }
    if (g.tipo === "Parcelada") {
      const n = Math.max(1, parseInt(g.quantidadeParcelas, 10) || 1);
      const base = arred(valorTotal / n);
      const inicio = Number(g.dataPrimeiraParcela || g.data) || Date.now();
      for (let i = 1; i <= n; i++) {
        const valor = i === n ? arred(valorTotal - base * (n - 1)) : base;
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
  return { mensais, semPrazo };
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

  const { mensais, semPrazo } = expandirParaSimulacao(todos);
  const porItem = {};

  if (!mensais.length && !semPrazo.length) {
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

  semPrazo.sort((a, b) => (a.data || 0) - (b.data || 0));
  for (const g of semPrazo) {
    const valor = arred(g.valor);
    const saldoAntes = saldo;
    if (saldo + 0.001 < valor) {
      okGeral = false;
      if (!motivo) {
        motivo = `Sem saldo para "${g.descricao}" sem prazo (R$ ${valor
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

  if (mensais.length) {
    mensais.sort((a, b) => (a.data || 0) - (b.data || 0));
    const ultima = new Date(mensais[mensais.length - 1].data);
    const fimAno = Math.max(anoIni, ultima.getFullYear());
    const fimMes =
      ultima.getFullYear() > anoIni ? ultima.getMonth() : Math.max(mesIni, ultima.getMonth());
    const meses =
      ultima.getFullYear() < anoIni
        ? []
        : mesesEntre(anoIni, mesIni, fimAno, ultima.getFullYear() === anoIni ? Math.max(mesIni, ultima.getMonth()) : ultima.getMonth());

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
            motivo = `Sem saldo em ${String(m.mes + 1).padStart(2, "0")}/${
              m.ano
            } para "${g.descricao}" (R$ ${valor.toFixed(2).replace(".", ",")}). Disponível: R$ ${saldo
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

function saldoEstimadoNoMes({
  saldoProjetadoInicial,
  mediaDizimos,
  mediaContaFixa,
  gastosExistentes,
  dataAlvo,
}) {
  const sim = simularViabilidade({
    saldoProjetadoInicial,
    mediaDizimos,
    mediaContaFixa,
    gastosExistentes,
    novoGasto: null,
  });
  if (!dataAlvo) return sim.saldoFinal;

  const alvo = new Date(dataAlvo);
  const agora = new Date();
  if (
    alvo.getFullYear() < agora.getFullYear() ||
    (alvo.getFullYear() === agora.getFullYear() && alvo.getMonth() < agora.getMonth())
  ) {
    return arred(saldoProjetadoInicial);
  }

  const { mensais, semPrazo } = expandirParaSimulacao(gastosExistentes);
  let saldo = arred(saldoProjetadoInicial);
  semPrazo.forEach((g) => {
    if (saldo + 0.001 >= g.valor) saldo = arred(saldo - g.valor);
  });

  const meses = mesesEntre(
    agora.getFullYear(),
    agora.getMonth(),
    alvo.getFullYear(),
    alvo.getMonth()
  );
  const porMes = {};
  mensais.forEach((g) => {
    const k = chaveMes(g.data);
    if (!porMes[k]) porMes[k] = [];
    porMes[k].push(g);
  });
  for (const m of meses) {
    saldo = arred(saldo + (Number(mediaDizimos) || 0) - (Number(mediaContaFixa) || 0));
    (porMes[m.key] || [])
      .sort((a, b) => a.data - b.data)
      .forEach((g) => {
        if (saldo + 0.001 >= g.valor) saldo = arred(saldo - g.valor);
      });
  }
  return saldo;
}

function montarParcelas({
  valorTotal,
  qtd,
  dataBase,
  origemPagamento,
  caixinhaId,
  caixinhaNome,
}) {
  const total = arred(valorTotal);
  const n = Math.max(1, parseInt(qtd, 10) || 1);
  const base = arred(total / n);
  const lista = [];
  for (let i = 1; i <= n; i++) {
    const valor = i === n ? arred(total - base * (n - 1)) : base;
    const venc = new Date(dataBase);
    venc.setMonth(venc.getMonth() + (i - 1));
    lista.push({
      numero: i,
      valor,
      vencimento: venc.getTime(),
      status: "aberta",
      pagoEm: null,
      origemPagamento: null,
      caixinhaId: null,
      caixinhaNome: null,
    });
  }
  return {
    parcelas: lista,
    valoresPagos: [],
    valorPagoTotal: 0,
    status: "aberta",
    origemPagamento: origemPagamento || "geral",
    caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
    caixinhaNome: origemPagamento === "caixinha" ? caixinhaNome : null,
  };
}

function valorPagoNaConfirmacao(item) {
  if (item.tipo === "Parcelada" || item.tipo === "Sem Prazo") return 0;
  if (isDataFutura(new Date(Number(item.data) || Date.now()))) return 0;
  return arred(Number(item.valor) || 0);
}

export default function ProjecaoGastos() {
  const {
    dadosFinancas,
    saldo,
    saldoDisponivel,
    load,
    HistoricoMovimentos,
    ResumoFinanceiro,
    formatoMoeda,
    igrejaAtiva,
    getIgrejaId,
    podeEditarFinanceiro,
    caixinhas,
    RetirarDaCaixinha,
    CarregarCaixinhas,
  } = useContext(AppContext);

  const { uid } = useAuth();
  const { showAlert } = useAppAlert();
  const { colors, dark } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [lista, setLista] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
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
  const [origem, setOrigem] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [reciboUri, setReciboUri] = useState(null);
  const [modalTipo, setModalTipo] = useState(false);
  const [modalMinisterio, setModalMinisterio] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [openId, setOpenId] = useState(null);

  const podeEditar = podeEditarFinanceiro?.() !== false;
  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const separator = dark ? "#3a3a3a" : "#ececec";
  const danger = dark ? "#E57373" : "#C62828";
  const okGreen = dark ? "#81C784" : "#2E7D32";
  const tintOk = dark ? "#1B3D2F" : "#E8F5E9";
  const tintBad = dark ? "#3D1B1B" : "#FFEBEE";

  const caixinhasComSaldo = (caixinhas || []).filter((c) => (Number(c.valor) || 0) > 0);
  const mostrarOrigem = !!tipo && tipo !== "Sem Prazo" && caixinhasComSaldo.length > 0;

  const indicadores = useMemo(
    () => montarIndicadoresProjecao({ dadosFinancas, saldo, igrejaAtiva }),
    [dadosFinancas, saldo, igrejaAtiva]
  );

  const simulacao = useMemo(
    () =>
      simularViabilidade({
        saldoProjetadoInicial: indicadores.saldoProjetado,
        mediaDizimos: indicadores.mediaDizimos,
        mediaContaFixa: indicadores.mediaContaFixa,
        gastosExistentes: lista,
        novoGasto: null,
      }),
    [indicadores, lista]
  );

  const dataAlvoPreview = tipo === "Parcelada" ? dataPrimeira : dataPag;
  const saldoMesSelecionado = useMemo(() => {
    if (tipo === "Sem Prazo") {
      return arred(
        indicadores.saldoProjetado -
          lista
            .filter((g) => g.tipo === "Sem Prazo")
            .reduce((a, g) => a + (Number(g.valor) || 0), 0)
      );
    }
    return saldoEstimadoNoMes({
      saldoProjetadoInicial: indicadores.saldoProjetado,
      mediaDizimos: indicadores.mediaDizimos,
      mediaContaFixa: indicadores.mediaContaFixa,
      gastosExistentes: lista,
      dataAlvo: dataAlvoPreview,
    });
  }, [tipo, indicadores, lista, dataAlvoPreview]);

  const carregarGastos = useCallback(async () => {
    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      setLista([]);
      setCarregandoLista(false);
      return;
    }
    try {
      const q = query(
        collection(db, "gastosProjetados"),
        where("igrejaId", "==", igrejaId),
        orderBy("data", "asc")
      );
      const snap = await getDocs(q);
      setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      try {
        const snap2 = await getDocs(
          query(collection(db, "gastosProjetados"), where("igrejaId", "==", igrejaId))
        );
        const arr = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (a.data || 0) - (b.data || 0));
        setLista(arr);
      } catch (e2) {
        setLista([]);
      }
    } finally {
      setCarregandoLista(false);
    }
  }, [getIgrejaId]);

  useEffect(() => {
    carregarGastos();
  }, [carregarGastos, igrejaAtiva?.id]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos?.(), carregarGastos()]);
    setRefreshing(false);
  }

  function abrirModal() {
    const hoje = new Date();
    setDescricao("");
    setValorTxt("");
    setDataPag(hoje);
    setDataPrimeira(maisUmMes(hoje));
    setShowDate(false);
    setShowDatePrimeira(false);
    setTipo(null);
    setMinisterio("");
    setObservacao("");
    setQtdParcelas("2");
    setOrigem("geral");
    setCaixinhaId(null);
    setReciboUri(null);
    setModal(true);
  }

  function escolherTipo(id) {
    setTipo(id);
    if (id === "Parcelada") {
      if (!qtdParcelas) setQtdParcelas("2");
      setDataPrimeira(maisUmMes(dataPag));
    }
    if (id === "Sem Prazo") {
      setOrigem("geral");
      setCaixinhaId(null);
    }
    setModalTipo(false);
  }

  async function salvarImagemLocal(uri) {
    const nomeArquivo = `recibo_${Date.now()}.jpg`;
    const pastaDestino = `${RNFS.DocumentDirectoryPath}/recibos`;
    if (!(await RNFS.exists(pastaDestino))) await RNFS.mkdir(pastaDestino);
    const caminhoFinal = `${pastaDestino}/${nomeArquivo}`;
    await RNFS.copyFile(uri, caminhoFinal);
    return `file://${caminhoFinal}`;
  }

  async function tirarFoto() {
    try {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({ title: "Permissão negada", message: "Precisamos da câmera para continuar." });
          return;
        }
      }
      const result = await launchCamera({
        mediaType: "photo",
        quality: 0.6,
        maxWidth: 700,
        maxHeight: 700,
        saveToPhotos: false,
      });
      if (result.didCancel || result.errorCode) return;
      if (result.assets?.length > 0) setReciboUri(result.assets[0].uri);
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível abrir a câmera." });
    }
  }

  async function escolherDaGaleria() {
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.6,
        maxWidth: 700,
        maxHeight: 700,
        selectionLimit: 1,
      });
      if (result.didCancel || result.errorCode) return;
      if (result.assets?.length > 0) setReciboUri(result.assets[0].uri);
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível abrir a galeria." });
    }
  }

  async function salvar() {
    if (!podeEditar) {
      showAlert({ title: "Aviso", message: "Você não tem permissão para registrar." });
      return;
    }
    const nome = String(descricao || "").trim();
    const valor = parseNumero(valorTxt);
    if (!tipo) {
      showAlert({ title: "Atenção", message: "Selecione o tipo." });
      return;
    }
    if (!nome) {
      showAlert({ title: "Atenção", message: "Informe a descrição." });
      return;
    }
    if (!(valor > 0)) {
      showAlert({ title: "Atenção", message: "Informe um valor válido." });
      return;
    }
    const qtd = parseInt(qtdParcelas, 10) || 0;
    if (tipo === "Parcelada" && qtd < 2) {
      showAlert({ title: "Atenção", message: "Informe pelo menos 2 parcelas." });
      return;
    }
    if (origem === "caixinha" && !caixinhaId) {
      showAlert({ title: "Atenção", message: "Selecione a caixinha." });
      return;
    }

    const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
    const dataTs =
      tipo === "Parcelada" ? dataPrimeira.getTime() : new Date(dataPag).setHours(12, 0, 0, 0);
    const dataPrimeiraTs = dataPrimeira.getTime();

    const teste = simularViabilidade({
      saldoProjetadoInicial: indicadores.saldoProjetado,
      mediaDizimos: indicadores.mediaDizimos,
      mediaContaFixa: indicadores.mediaContaFixa,
      gastosExistentes: lista,
      novoGasto: {
        data: dataTs,
        valor,
        descricao: nome,
        tipo,
        quantidadeParcelas: qtd,
        dataPrimeiraParcela: dataPrimeiraTs,
      },
    });
    if (!teste.ok) {
      showAlert({ title: "Não é viável", message: teste.motivo || "Saldo futuro insuficiente." });
      return;
    }

    const igrejaId = getIgrejaId?.();
    if (!igrejaId) {
      showAlert({ title: "Erro", message: "Nenhuma igreja selecionada." });
      return;
    }

    try {
      setSalvando(true);
      const reciboUrl = reciboUri ? await salvarImagemLocal(reciboUri) : null;
      await addDoc(collection(db, "gastosProjetados"), {
        igrejaId,
        descricao: nome,
        valor: arred(valor),
        data: dataTs,
        tipo,
        quantidadeParcelas: tipo === "Parcelada" ? qtd : 1,
        dataPrimeiraParcela: tipo === "Parcelada" ? dataPrimeiraTs : null,
        ministerio: ministerio || null,
        observacao: observacao.trim(),
        origemPagamento: origem === "caixinha" ? "caixinha" : "geral",
        caixinhaId: origem === "caixinha" ? caixinhaId : null,
        caixinhaNome: origem === "caixinha" ? cx?.nome || null : null,
        reciboUrl,
        mediaDizimosUsada: indicadores.mediaDizimos,
        mediaContaFixaUsada: indicadores.mediaContaFixa,
        saldoProjetadoBase: indicadores.saldoProjetado,
        createdAt: Date.now(),
        ficticio: true,
      });
      setModal(false);
      await carregarGastos();
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível salvar." });
    } finally {
      setSalvando(false);
    }
  }

  function pedirRegistrar(item) {
    const pago = valorPagoNaConfirmacao(item);
    const texto =
      item.tipo === "Parcelada"
        ? "As parcelas vão para A pagar. Nada é debitado agora."
        : item.tipo === "Sem Prazo"
        ? "Entra em A pagar, sem data de vencimento."
        : pago > 0
        ? "Entra no histórico como despesa paga."
        : "A data ainda é futura: entra em A pagar, sem baixar o caixa.";
    showAlert({
      title: "Registrar despesa",
      message: `Confirmar "${item.descricao}" de R$ ${formatoMoeda.format(
        item.valor || 0
      )}?\n\n${texto}`,
      buttons: [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => efetivar(item) },
      ],
    });
  }

  async function efetivar(item) {
    const igrejaId = getIgrejaId?.();
    if (!igrejaId || !uid) {
      showAlert({ title: "Erro", message: "Igreja ou usuário não identificado." });
      return;
    }

    const valor = arred(Number(item.valor) || 0);
    const parcial = valorPagoNaConfirmacao(item);
    const origemPagamento = item.origemPagamento === "caixinha" ? "caixinha" : "geral";
    const agora = Date.now();

    if (parcial > 0 && origemPagamento === "geral") {
      if (parcial > (Number(saldoDisponivel) || 0) + 0.001) {
        showAlert({
          title: "Saldo insuficiente",
          message: `Caixa livre disponível: R$ ${formatoMoeda.format(saldoDisponivel || 0)}`,
        });
        return;
      }
    }
    if (parcial > 0 && origemPagamento === "caixinha") {
      const cx = (caixinhas || []).find((c) => c.id === item.caixinhaId);
      if (!cx || parcial > (Number(cx.valor) || 0) + 0.001) {
        showAlert({
          title: "Saldo insuficiente",
          message: cx
            ? `"${cx.nome}" tem R$ ${formatoMoeda.format(cx.valor || 0)}`
            : "Caixinha não encontrada.",
        });
        return;
      }
    }

    const base = {
      igrejaId,
      idUsuario: uid,
      tipoMovimento: "saida",
      tipo: item.tipo || "Avulsa",
      data: Number(item.data) || agora,
      descricao: item.descricao || "Despesa",
      valorTotal: valor,
      observacao: item.observacao || "",
      ministerio: item.ministerio || null,
      reciboUrl: item.reciboUrl || null,
      origemPagamento,
      caixinhaId: origemPagamento === "caixinha" ? item.caixinhaId || null : null,
      caixinhaNome: origemPagamento === "caixinha" ? item.caixinhaNome || null : null,
      reg: agora,
      createdAt: agora,
      origemProjecaoId: item.id,
    };

    if (item.tipo === "Parcelada") {
      const montado = montarParcelas({
        valorTotal: valor,
        qtd: item.quantidadeParcelas,
        dataBase: new Date(Number(item.dataPrimeiraParcela || item.data)),
        origemPagamento,
        caixinhaId: item.caixinhaId,
        caixinhaNome: item.caixinhaNome,
      });
      Object.assign(base, {
        dataPrimeiraParcela: Number(item.dataPrimeiraParcela || item.data),
        quantidadeParcelas: parseInt(item.quantidadeParcelas, 10) || 1,
        parcelas: montado.parcelas,
        valoresPagos: [],
        valorPagoTotal: 0,
        status: "aberta",
      });
    } else if (item.tipo === "Sem Prazo") {
      Object.assign(base, {
        valoresPagos: [],
        valorPagoTotal: 0,
        quantidadeParcelas: 1,
        status: "aberta",
        origemPagamento: "geral",
        caixinhaId: null,
        caixinhaNome: null,
      });
    } else {
      Object.assign(base, {
        valoresPagos:
          parcial > 0
            ? [
                {
                  valor: parcial,
                  data: Number(item.data) || agora,
                  id: String(agora),
                  origemPagamento,
                  caixinhaId: origemPagamento === "caixinha" ? item.caixinhaId || null : null,
                  caixinhaNome:
                    origemPagamento === "caixinha" ? item.caixinhaNome || null : null,
                },
              ]
            : [],
        valorPagoTotal: parcial,
        quantidadeParcelas: 1,
        status: parcial >= valor - 0.001 ? "quitada" : "aberta",
      });
    }

    try {
      const ref = await addDoc(collection(db, "registros"), base);
      try {
        if (parcial > 0 && origemPagamento === "caixinha" && item.caixinhaId) {
          await RetirarDaCaixinha?.(item.caixinhaId, parcial);
        }
      } catch (e) {
        await deleteDoc(ref);
        throw e;
      }
      await deleteDoc(doc(db, "gastosProjetados", item.id));
      setOpenId(null);
      await Promise.all([
        carregarGastos(),
        HistoricoMovimentos?.(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);
      showAlert({
        title: "Despesa registrada",
        message:
          parcial > 0
            ? "Lançada no histórico como paga."
            : "Lançada em A pagar.",
      });
    } catch (e) {
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível registrar a despesa.",
      });
    }
  }

  function excluir(item) {
    showAlert({
      title: "Excluir",
      message: `Remover "${item.descricao}"?`,
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "gastosProjetados", item.id));
              await carregarGastos();
            } catch (e) {
              showAlert({ title: "Erro", message: "Não foi possível excluir." });
            }
          },
        },
      ],
    });
  }

  if ((load || carregandoLista) && !refreshing) return <Load />;

  const qtdNum = parseInt(qtdParcelas, 10) || 0;
  const totalNum = parseNumero(valorTxt);
  const previewParcela =
    tipo === "Parcelada" && qtdNum > 0 && totalNum > 0 ? arred(totalNum / qtdNum) : 0;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[principal]} tintColor={principal} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={[styles.kpiSingle, { backgroundColor: card }]}>
              <Text style={[styles.kpiLabel, { color: muted }]}>Saldo da projeção</Text>
              <Text style={[styles.kpiValue, { color: text }]}>
                R$ {formatoMoeda.format(simulacao.saldoFinal)}
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
            <Ionicons name="calendar-outline" size={36} color={muted} />
            <Text style={[styles.emptyTitle, { color: muted }]}>Nenhum gasto projetado</Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              O formulário segue o mesmo padrão de uma saída. Ao confirmar o card, vira despesa de verdade.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const det = simulacao.porItem?.[item.id];
          const okItem = det ? !!det.ok : true;
          const saldoAposItem = det ? det.saldoApos : simulacao.saldoFinal;
          const situacaoCor = okItem ? okGreen : danger;
          const origemTxt =
            item.origemPagamento === "caixinha" ? item.caixinhaNome || "Caixinha" : "Caixa livre";
          let quando = item.data ? new Date(item.data).toLocaleDateString("pt-BR") : "—";
          if (item.tipo === "Parcelada") {
            const n = parseInt(item.quantidadeParcelas, 10) || 1;
            quando = `${n}x · 1ª ${new Date(
              Number(item.dataPrimeiraParcela || item.data)
            ).toLocaleDateString("pt-BR")}`;
          }
          if (item.tipo === "Sem Prazo") quando = "Sem prazo";
          const subtitle = `${item.tipo || "Avulsa"}  ·  ${quando}\n${origemTxt}  ·  ${
            okItem ? "Viável" : "Sem saldo"
          }  ·  Resta R$ ${formatoMoeda.format(saldoAposItem)}`;

          return (
            <SwipeCard
              icon={okItem ? "checkmark-circle-outline" : "alert-circle-outline"}
              iconColor={situacaoCor}
              tint={okItem ? tintOk : tintBad}
              title={item.descricao || "Gasto"}
              subtitle={subtitle}
              value={`R$ ${formatoMoeda.format(item.valor || 0)}`}
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

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <View style={[styles.modalCard, { backgroundColor: card }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: text }]}>Novo gasto projetado</Text>

              <TouchableOpacity
                style={[styles.field, { backgroundColor: surface }]}
                onPress={() => setModalTipo(true)}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>Tipo</Text>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldValue, { color: tipo ? text : muted }]}>
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
                  <Text style={[styles.fieldLabel, { color: muted }]}>Data</Text>
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

              {mostrarOrigem && (
                <>
                  <View style={[styles.segment, { backgroundColor: surface }]}>
                    {[
                      { id: "geral", label: "Caixa livre" },
                      { id: "caixinha", label: "Caixinha" },
                    ].map((opt) => {
                      const ativo = origem === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.segmentBtn, ativo && { backgroundColor: principal }]}
                          onPress={() => {
                            setOrigem(opt.id);
                            if (opt.id === "geral") setCaixinhaId(null);
                          }}
                        >
                          <Text style={[styles.segmentText, { color: ativo ? "#fff" : muted }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {origem === "caixinha" &&
                    caixinhasComSaldo.map((cx) => {
                      const ativo = caixinhaId === cx.id;
                      return (
                        <TouchableOpacity
                          key={cx.id}
                          style={[
                            styles.cxItem,
                            { backgroundColor: surface, borderColor: ativo ? principal : "transparent" },
                          ]}
                          onPress={() => setCaixinhaId(cx.id)}
                        >
                          <Text style={[styles.cxNome, { color: text }]}>{cx.nome}</Text>
                          <Text style={[styles.cxValor, { color: muted }]}>
                            R$ {formatoMoeda.format(cx.valor || 0)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </>
              )}

              <TouchableOpacity
                style={[styles.field, { backgroundColor: surface }]}
                onPress={() => setModalMinisterio(true)}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>Ministério (opcional)</Text>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldValue, { color: ministerio ? text : muted }]}>
                    {ministerio || "Selecione o ministério"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={muted} />
                </View>
              </TouchableOpacity>

              <View style={[styles.saldoMesBox, { backgroundColor: surface }]}>
                <Text style={[styles.saldoMesLabel, { color: muted }]}>
                  {tipo === "Sem Prazo"
                    ? "Saldo projetado disponível agora"
                    : tipo === "Parcelada"
                    ? "Saldo estimado no mês da 1ª parcela"
                    : "Saldo estimado neste mês"}
                </Text>
                <Text style={[styles.saldoMesValue, { color: text }]}>
                  R$ {formatoMoeda.format(saldoMesSelecionado)}
                </Text>
              </View>

              <View style={[styles.field, { backgroundColor: surface }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>Descrição</Text>
                <TextInput
                  style={[styles.fieldInput, { color: text }]}
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descreva a despesa"
                  placeholderTextColor={muted}
                />
              </View>

              <View style={[styles.field, { backgroundColor: surface }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>Valor total</Text>
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
                    <Text style={[styles.fieldLabel, { color: muted }]}>Quantidade de parcelas</Text>
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
                    <Text style={[styles.fieldLabel, { color: muted }]}>Data da primeira parcela</Text>
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

              <View style={[styles.field, { backgroundColor: surface }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>Recibo (opcional)</Text>
                {reciboUri ? (
                  <View style={styles.reciboSelecionado}>
                    <Image source={{ uri: reciboUri }} style={styles.preview} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <TouchableOpacity onPress={tirarFoto}>
                        <Text style={[styles.reciboAcaoText, { color: text }]}>Câmera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={escolherDaGaleria}>
                        <Text style={[styles.reciboAcaoText, { color: text }]}>Galeria</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReciboUri(null)}>
                        <Text style={[styles.reciboAcaoText, { color: danger }]}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.reciboVazio}>
                    <TouchableOpacity style={[styles.reciboOpcao, { backgroundColor: card }]} onPress={tirarFoto}>
                      <Ionicons name="camera-outline" size={20} color={muted} />
                      <Text style={[styles.reciboOpcaoText, { color: muted }]}>Câmera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reciboOpcao, { backgroundColor: card }]}
                      onPress={escolherDaGaleria}
                    >
                      <Ionicons name="images-outline" size={20} color={muted} />
                      <Text style={[styles.reciboOpcaoText, { color: muted }]}>Galeria</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[styles.field, { backgroundColor: surface, minHeight: 72 }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>Observação</Text>
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
                  <Text style={[styles.btnCancelText, { color: muted }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOk, { backgroundColor: principal }, salvando && { opacity: 0.7 }]}
                  onPress={salvar}
                  disabled={salvando}
                >
                  <Text style={styles.btnOkText}>{salvando ? "Salvando..." : "Salvar"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalTipo} transparent animationType="fade" onRequestClose={() => setModalTipo(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalTipo(false)}>
          <Pressable style={[styles.pickerCard, { backgroundColor: card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: text }]}>Tipo</Text>
            {TIPOS_SAIDA.map((item, index) => {
              const ativo = tipo === item.id;
              const ultimo = index === TIPOS_SAIDA.length - 1;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerItem,
                    !ultimo && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separator },
                  ]}
                  onPress={() => escolherTipo(item.id)}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.pickerTitle, { color: text }]}>{item.id}</Text>
                    <Text style={[styles.pickerEx, { color: muted }]}>{item.exemplo}</Text>
                  </View>
                  {ativo && <Ionicons name="checkmark" size={18} color={principal} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={modalMinisterio}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMinisterio(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalMinisterio(false)}>
          <Pressable style={[styles.pickerCard, { backgroundColor: card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: text }]}>Ministério</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separator }]}
                onPress={() => {
                  setMinisterio("");
                  setModalMinisterio(false);
                }}
              >
                <Text style={[styles.pickerTitle, { color: muted }]}>Nenhum</Text>
                {!ministerio && <Ionicons name="checkmark" size={18} color={principal} />}
              </TouchableOpacity>
              {(MINISTERIOS || []).map((m, index) => {
                const ativo = ministerio === m;
                const ultimo = index === MINISTERIOS.length - 1;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.pickerItem,
                      !ultimo && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separator },
                    ]}
                    onPress={() => {
                      setMinisterio(m);
                      setModalMinisterio(false);
                    }}
                  >
                    <Text style={[styles.pickerTitle, { color: text }]}>{m}</Text>
                    {ativo && <Ionicons name="checkmark" size={18} color={principal} />}
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
  listContent: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 100, gap: 8 },
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
  emptyText: { marginTop: 14, fontSize: 13, fontFamily: "Roboto-Regular", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { borderRadius: 20, padding: 16, maxHeight: "92%" },
  pickerCard: { borderRadius: 20, padding: 16, maxHeight: "80%" },
  modalTitle: { fontSize: 17, fontFamily: "Roboto-Bold", marginBottom: 12 },
  field: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontFamily: "Roboto-Regular", marginBottom: 4 },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldValue: { fontSize: 15, fontFamily: "Roboto-Medium", flex: 1 },
  fieldInput: { fontSize: 15, fontFamily: "Roboto-Regular", padding: 0 },
  hint: { fontSize: 13, fontFamily: "Roboto-Regular", marginBottom: 8 },
  saldoMesBox: { borderRadius: 12, padding: 12, marginBottom: 12 },
  saldoMesLabel: { fontSize: 12, fontFamily: "Roboto-Regular", marginBottom: 4 },
  saldoMesValue: { fontSize: 18, fontFamily: "Roboto-Bold" },
  segment: { flexDirection: "row", borderRadius: 16, padding: 4, marginBottom: 10 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  segmentText: { fontSize: 13, fontFamily: "Roboto-Medium" },
  cxItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1.5,
  },
  cxNome: { fontSize: 14, fontFamily: "Roboto-Medium" },
  cxValor: { fontSize: 13, fontFamily: "Roboto-Regular" },
  reciboVazio: { flexDirection: "row", gap: 10, marginTop: 4 },
  reciboOpcao: { flex: 1, height: 58, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 4 },
  reciboOpcaoText: { fontSize: 12, fontFamily: "Roboto-Regular" },
  reciboSelecionado: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  preview: { width: 56, height: 72, borderRadius: 8, backgroundColor: "#eee" },
  reciboAcaoText: { fontSize: 13, fontFamily: "Roboto-Medium" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 8 },
  btnCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnCancelText: { fontSize: 14, fontFamily: "Roboto-Medium" },
  btnOk: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnOkText: { fontSize: 14, fontFamily: "Roboto-Bold", color: "#fff" },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  pickerTitle: { fontSize: 15, fontFamily: "Roboto-Medium" },
  pickerEx: { marginTop: 3, fontSize: 12, fontFamily: "Roboto-Regular", lineHeight: 16 },
});
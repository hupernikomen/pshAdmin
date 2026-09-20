import { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
} from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchCamera } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { AppContext } from "../../context/AppContext";
import { db } from "../../firebaseConnection";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Load from "../../componentes/Load";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";

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

function arred(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** Gera parcelas mensais a partir da data base */
function montarParcelas({ valorTotal, qtd, dataBase, valorPagoAgora, origemPagamento, caixinhaId, caixinhaNome }) {
  const total = arred(valorTotal);
  const n = Math.max(1, parseInt(qtd, 10) || 1);
  const base = arred(total / n);
  let pagoRestante = arred(valorPagoAgora);
  const lista = [];
  const pagamentos = [];

  for (let i = 1; i <= n; i++) {
    const valor = i === n ? arred(total - base * (n - 1)) : base;
    const venc = new Date(dataBase);
    venc.setMonth(venc.getMonth() + (i - 1));
    const vencTs = venc.getTime();

    const cobre = pagoRestante >= valor - 0.001;
    if (cobre) {
      pagoRestante = arred(pagoRestante - valor);
      lista.push({
        numero: i,
        valor,
        vencimento: vencTs,
        status: "paga",
        pagoEm: dataBase.getTime(),
        origemPagamento: origemPagamento || null,
        caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
        caixinhaNome: origemPagamento === "caixinha" ? caixinhaNome : null,
      });
      pagamentos.push({
        valor,
        data: dataBase.getTime(),
        id: `${Date.now()}_${i}`,
        parcelaNumero: i,
        origemPagamento: origemPagamento || null,
        caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
        caixinhaNome: origemPagamento === "caixinha" ? caixinhaNome : null,
      });
    } else {
      lista.push({
        numero: i,
        valor,
        vencimento: vencTs,
        status: "aberta",
        pagoEm: null,
        origemPagamento: null,
        caixinhaId: null,
        caixinhaNome: null,
      });
    }
  }

  const valorPagoTotal = arred(
    lista.filter((p) => p.status === "paga").reduce((a, p) => a + p.valor, 0)
  );

  return {
    parcelas: lista,
    valoresPagos: pagamentos,
    valorPagoTotal,
    status: valorPagoTotal >= total - 0.001 ? "quitada" : "aberta",
  };
}

export default function Registro() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const {
    setAviso,
    load,
    setLoad,
    HistoricoMovimentos,
    ResumoFinanceiro,
    caixinhas,
    saldoDisponivel,
    RetirarDaCaixinha,
    CarregarCaixinhas,
    formatoMoeda,
  } = useContext(AppContext);

  const { uid } = useAuth();

  const [tipoMovimento, setTipoMovimento] = useState(null);
  const [modo, setModo] = useState("nova");
  const [tipo, setTipo] = useState(null);
  const [data, setData] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorParcial, setValorParcial] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("1");
  const [reciboUri, setReciboUri] = useState(null);
  const [abertos, setAbertos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [parcelaSel, setParcelaSel] = useState(null);
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [temSaldoInicial, setTemSaldoInicial] = useState(false);

  const tiposEntrada = ["Saldo inicial", "Dízimo", "Oferta", "Bazar"];
  const tiposSaida = ["Conta Fixa", "Parcelada"];
  const isSaldoInicial = tipo === "Saldo inicial";
  const isParcelada = tipo === "Parcelada" || selecionado?.tipo === "Parcelada";

  useEffect(() => {
    verificarSaldoInicial();
  }, [uid]);

  useEffect(() => {
    if (modo === "adicionar" && tipoMovimento && uid) {
      carregarAbertos();
    } else {
      setAbertos([]);
      setSelecionado(null);
      setParcelaSel(null);
    }
  }, [modo, tipoMovimento, uid]);

  useEffect(() => {
    if (tipoMovimento !== "saida") {
      setOrigemPagamento("geral");
      setCaixinhaId(null);
    }
  }, [tipoMovimento]);

  async function verificarSaldoInicial() {
    if (!uid) {
      setTemSaldoInicial(false);
      return;
    }
    try {
      const q = query(
        collection(db, "registros"),
        where("idUsuario", "==", uid),
        where("tipo", "==", "Saldo inicial")
      );
      const snap = await getDocs(q);
      setTemSaldoInicial(!snap.empty);
    } catch (e) {
      console.log("Erro verificarSaldoInicial:", e);
    }
  }

  async function carregarAbertos() {
    if (!uid) return;
    try {
      const q = query(
        collection(db, "registros"),
        where("idUsuario", "==", uid),
        where("tipoMovimento", "==", tipoMovimento),
        where("status", "==", "aberta")
      );
      const snap = await getDocs(q);
      setAbertos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log("Erro ao carregar abertos:", e);
    }
  }

  async function salvarImagemLocal(uri) {
    const nomeArquivo = `recibo_${Date.now()}.jpg`;
    const pastaDestino = `${RNFS.ExternalStorageDirectoryPath}/Pictures/PSH_App`;
    const pastaExiste = await RNFS.exists(pastaDestino);
    if (!pastaExiste) await RNFS.mkdir(pastaDestino);
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
          Alert.alert("Permissão negada", "Precisamos da câmera para continuar.");
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
    } catch (error) {
      Alert.alert("Erro", "Não foi possível abrir a câmera.");
    }
  }

  function validarOrigemSaida(valorPagoAgora) {
    if (tipoMovimento !== "saida") return true;
    if (origemPagamento === "geral") {
      if (valorPagoAgora > (Number(saldoDisponivel) || 0) + 0.001) {
        Alert.alert(
          "Saldo insuficiente",
          `Caixa geral disponível: R$ ${formatoMoeda.format(saldoDisponivel || 0)}`
        );
        return false;
      }
      return true;
    }
    if (!caixinhaId) {
      Alert.alert("Atenção", "Selecione a caixinha de origem.");
      return false;
    }
    const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
    if (!cx) {
      Alert.alert("Atenção", "Caixinha não encontrada.");
      return false;
    }
    if (valorPagoAgora > (Number(cx.valor) || 0) + 0.001) {
      Alert.alert(
        "Saldo insuficiente",
        `"${cx.nome}" tem R$ ${formatoMoeda.format(cx.valor || 0)}`
      );
      return false;
    }
    return true;
  }

  async function debitarOrigemSeSaida(valorPagoAgora) {
    if (tipoMovimento !== "saida") return;
    if (origemPagamento === "caixinha" && caixinhaId && valorPagoAgora > 0) {
      await RetirarDaCaixinha(caixinhaId, valorPagoAgora);
    }
  }

  async function salvar() {
    if (!uid) {
      Alert.alert("Atenção", "Faça login novamente.");
      return;
    }
    if (!tipoMovimento) {
      Alert.alert("Atenção", "Selecione Entrada ou Saída.");
      return;
    }
    if (modo === "nova" && (!tipo || !descricao || !valorTotal)) {
      Alert.alert("Atenção", "Preencha os campos obrigatórios.");
      return;
    }
    if (modo === "adicionar" && !selecionado) {
      Alert.alert("Atenção", "Selecione um registro.");
      return;
    }
    if (isSaldoInicial && temSaldoInicial) {
      Alert.alert(
        "Atenção",
        "O saldo inicial já foi registrado e não pode ser lançado de novo."
      );
      return;
    }

    const caixinhaSel = (caixinhas || []).find((c) => c.id === caixinhaId);

    // --- ADICIONAR PAGAMENTO ---
    if (modo === "adicionar") {
      const temParcelas = Array.isArray(selecionado.parcelas) && selecionado.parcelas.length > 0;

      if (temParcelas) {
        if (!parcelaSel) {
          Alert.alert("Atenção", "Selecione a parcela a pagar.");
          return;
        }
        const valor = arred(parcelaSel.valor);
        if (!validarOrigemSaida(valor)) return;

        setLoad(true);
        try {
          const parcelas = (selecionado.parcelas || []).map((p) => {
            if (p.numero !== parcelaSel.numero) return p;
            return {
              ...p,
              status: "paga",
              pagoEm: data.getTime(),
              origemPagamento,
              caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
              caixinhaNome:
                origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null,
            };
          });

          const listaAtual = selecionado.valoresPagos || [];
          const novoPagamento = {
            valor,
            data: data.getTime(),
            id: Date.now().toString(),
            parcelaNumero: parcelaSel.numero,
            origemPagamento,
            caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
            caixinhaNome:
              origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null,
          };

          const novoTotal = arred((selecionado.valorPagoTotal || 0) + valor);
          const todasPagas = parcelas.every((p) => p.status === "paga");

          await updateDoc(doc(db, "registros", selecionado.id), {
            parcelas,
            valoresPagos: [...listaAtual, novoPagamento],
            valorPagoTotal: novoTotal,
            status: todasPagas ? "quitada" : "aberta",
          });

          await debitarOrigemSeSaida(valor);
          await Promise.all([
            HistoricoMovimentos(),
            ResumoFinanceiro(),
            CarregarCaixinhas?.(),
          ]);
          setAviso({ titulo: "Sucesso", mensagem: "Parcela paga!" });
          navigation.goBack();
        } catch (e) {
          Alert.alert("Erro", e.message || "Não foi possível salvar");
        } finally {
          setLoad(false);
        }
        return;
      }

      // fluxo antigo (sem array parcelas)
      if (!valorParcial) {
        Alert.alert("Atenção", "Informe o valor.");
        return;
      }
      const valor = parseNumero(valorParcial);
      if (!validarOrigemSaida(valor)) return;

      setLoad(true);
      try {
        const campoArray =
          tipoMovimento === "entrada" ? "valoresRecebidos" : "valoresPagos";
        const campoTotal =
          tipoMovimento === "entrada" ? "valorRecebidoTotal" : "valorPagoTotal";
        const listaAtual = selecionado[campoArray] || [];
        const novoTotal = arred((selecionado[campoTotal] || 0) + valor);

        await updateDoc(doc(db, "registros", selecionado.id), {
          [campoArray]: [
            ...listaAtual,
            {
              valor,
              data: data.getTime(),
              id: Date.now().toString(),
              origemPagamento: tipoMovimento === "saida" ? origemPagamento : null,
              caixinhaId:
                tipoMovimento === "saida" && origemPagamento === "caixinha"
                  ? caixinhaId
                  : null,
              caixinhaNome:
                tipoMovimento === "saida" && origemPagamento === "caixinha"
                  ? caixinhaSel?.nome || null
                  : null,
            },
          ],
          [campoTotal]: novoTotal,
          status: novoTotal >= selecionado.valorTotal ? "quitada" : "aberta",
        });

        await debitarOrigemSeSaida(valor);
        await Promise.all([
          HistoricoMovimentos(),
          ResumoFinanceiro(),
          CarregarCaixinhas?.(),
        ]);
        setAviso({ titulo: "Sucesso", mensagem: "Registro salvo!" });
        navigation.goBack();
      } catch (e) {
        Alert.alert("Erro", e.message || "Não foi possível salvar");
      } finally {
        setLoad(false);
      }
      return;
    }

    // --- NOVA ---
    const valor = parseNumero(valorTotal);
    const parcial = isSaldoInicial
      ? valor
      : valorParcial
        ? parseNumero(valorParcial)
        : tipo === "Parcelada"
          ? 0
          : valor;

    if (tipo === "Parcelada") {
      const qtd = parseInt(qtdParcelas, 10) || 1;
      if (qtd < 1) {
        Alert.alert("Atenção", "Informe a quantidade de parcelas.");
        return;
      }
      if (!validarOrigemSaida(parcial)) return;

      setLoad(true);
      try {
        const montado = montarParcelas({
          valorTotal: valor,
          qtd,
          dataBase: data,
          valorPagoAgora: parcial,
          origemPagamento,
          caixinhaId,
          caixinhaNome: caixinhaSel?.nome || null,
        });

        const base = {
          idUsuario: uid,
          tipoMovimento: "saida",
          tipo: "Parcelada",
          data: data.getTime(),
          descricao: descricao.trim(),
          valorTotal: valor,
          observacao: observacao.trim(),
          quantidadeParcelas: qtd,
          parcelas: montado.parcelas,
          valoresPagos: montado.valoresPagos,
          valorPagoTotal: montado.valorPagoTotal,
          status: montado.status,
          origemPagamento,
          caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
          caixinhaNome:
            origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null,
          reciboUrl: reciboUri ? await salvarImagemLocal(reciboUri) : null,
          reg: Date.now(),
          createdAt: Date.now(),
        };

        await addDoc(collection(db, "registros"), base);
        await debitarOrigemSeSaida(montado.valorPagoTotal);
        await Promise.all([
          HistoricoMovimentos(),
          ResumoFinanceiro(),
          CarregarCaixinhas?.(),
        ]);
        setAviso({ titulo: "Sucesso", mensagem: "Compra parcelada registrada!" });
        navigation.goBack();
      } catch (e) {
        Alert.alert("Erro", e.message || "Não foi possível salvar");
      } finally {
        setLoad(false);
      }
      return;
    }

    // entrada / conta fixa
    if (!validarOrigemSaida(parcial)) return;
    setLoad(true);
    try {
      const base = {
        idUsuario: uid,
        tipoMovimento,
        tipo,
        data: data.getTime(),
        descricao: descricao.trim(),
        valorTotal: valor,
        observacao: observacao.trim(),
        status: isSaldoInicial || parcial >= valor ? "quitada" : "aberta",
        reg: Date.now(),
        createdAt: Date.now(),
      };

      if (tipoMovimento === "entrada") {
        base.valoresRecebidos = [
          { valor: parcial, data: data.getTime(), id: Date.now().toString() },
        ];
        base.valorRecebidoTotal = parcial;
      } else {
        base.valoresPagos = [
          {
            valor: parcial,
            data: data.getTime(),
            id: Date.now().toString(),
            origemPagamento,
            caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
            caixinhaNome:
              origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null,
          },
        ];
        base.valorPagoTotal = parcial;
        base.quantidadeParcelas = 1;
        base.origemPagamento = origemPagamento;
        base.caixinhaId = origemPagamento === "caixinha" ? caixinhaId : null;
        base.caixinhaNome =
          origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null;
        base.reciboUrl = reciboUri ? await salvarImagemLocal(reciboUri) : null;
      }

      await addDoc(collection(db, "registros"), base);
      await debitarOrigemSeSaida(parcial);
      await Promise.all([
        HistoricoMovimentos(),
        ResumoFinanceiro(),
        CarregarCaixinhas?.(),
      ]);
      setAviso({ titulo: "Sucesso", mensagem: "Registro salvo!" });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", e.message || "Não foi possível salvar");
    } finally {
      setLoad(false);
    }
  }

  if (load) return <Load />;

  const caixinhasComSaldo = (caixinhas || []).filter(
    (c) => (Number(c.valor) || 0) > 0
  );

  const parcelasAbertasSel = (selecionado?.parcelas || []).filter(
    (p) => p.status === "aberta"
  );

  const qtdNum = parseInt(qtdParcelas, 10) || 0;
  const totalNum = parseNumero(valorTotal);
  const previewParcela =
    tipo === "Parcelada" && qtdNum > 0 && totalNum > 0
      ? arred(totalNum / qtdNum)
      : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 24}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.segment}>
        {["entrada", "saida"].map((item) => {
          const ativo = tipoMovimento === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.segmentBtn,
                ativo && { backgroundColor: colors.principal },
              ]}
              onPress={() => {
                setTipoMovimento(item);
                setTipo(null);
                setModo("nova");
                setSelecionado(null);
                setParcelaSel(null);
              }}
            >
              <Text style={[styles.segmentText, ativo && { color: "#fff" }]}>
                {item === "entrada" ? "Entrada" : "Saída"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tipoMovimento && (
        <>
          <View style={styles.segment}>
            {[
              { id: "nova", label: "Nova" },
              { id: "adicionar", label: "Adicionar Pagamento" },
            ].map((opt) => {
              const ativo = modo === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.segmentBtn,
                    ativo && { backgroundColor: colors.principal },
                  ]}
                  onPress={() => {
                    setModo(opt.id);
                    if (opt.id === "nova") {
                      setSelecionado(null);
                      setParcelaSel(null);
                    }
                  }}
                >
                  <Text style={[styles.segmentText, ativo && { color: "#fff" }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {modo === "nova" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo</Text>
              <View style={styles.chips}>
                {(tipoMovimento === "entrada" ? tiposEntrada : tiposSaida).map(
                  (t) => {
                    const ativo = tipo === t;
                    const bloqueado = t === "Saldo inicial" && temSaldoInicial;
                    return (
                      <TouchableOpacity
                        key={t}
                        disabled={bloqueado}
                        style={[
                          styles.chip,
                          ativo && { backgroundColor: colors.principal },
                          bloqueado && styles.chipDisabled,
                        ]}
                        onPress={() => {
                          setTipo(t);
                          if (t === "Saldo inicial" && !descricao) {
                            setDescricao("Saldo inicial");
                          }
                          if (t === "Parcelada" && !qtdParcelas) {
                            setQtdParcelas("2");
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            ativo && { color: "#fff" },
                            bloqueado && styles.chipTextDisabled,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>
          )}

          {modo === "adicionar" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selecione o registro</Text>
              {abertos.length === 0 ? (
                <Text style={styles.empty}>Nenhum registro em aberto</Text>
              ) : (
                abertos.map((item) => {
                  const ativo = selecionado?.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.selectCard,
                        ativo && {
                          borderColor: colors.principal,
                          backgroundColor: "#fff",
                        },
                      ]}
                      onPress={() => {
                        setSelecionado(item);
                        setParcelaSel(null);
                        setValorParcial("");
                      }}
                    >
                      <View style={styles.selectIcon}>
                        <Ionicons
                          name={
                            tipoMovimento === "entrada"
                              ? "arrow-down-outline"
                              : "arrow-up-outline"
                          }
                          size={16}
                          color={ativo ? colors.principal : "#9aa0a6"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectTitle}>
                          {item.tipo} · {item.descricao}
                        </Text>
                        <Text style={styles.selectSub}>
                          R${" "}
                          {(
                            item.valorRecebidoTotal ||
                            item.valorPagoTotal ||
                            0
                          ).toFixed(2)}{" "}
                          de R$ {item.valorTotal?.toFixed(2)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {selecionado &&
                Array.isArray(selecionado.parcelas) &&
                parcelasAbertasSel.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.sectionTitle}>Parcela a pagar</Text>
                    {parcelasAbertasSel.map((p) => {
                      const ativo = parcelaSel?.numero === p.numero;
                      return (
                        <TouchableOpacity
                          key={p.numero}
                          style={[
                            styles.selectCard,
                            ativo && {
                              borderColor: colors.principal,
                              backgroundColor: "#fff",
                            },
                          ]}
                          onPress={() => {
                            setParcelaSel(p);
                            setValorParcial(String(p.valor).replace(".", ","));
                          }}
                        >
                          <View style={styles.selectIcon}>
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color={ativo ? colors.principal : "#9aa0a6"}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.selectTitle}>
                              Parcela {p.numero}/{selecionado.quantidadeParcelas || selecionado.parcelas.length}
                            </Text>
                            <Text style={styles.selectSub}>
                              Venc.{" "}
                              {new Date(p.vencimento).toLocaleDateString("pt-BR")}{" "}
                              · R$ {formatoMoeda.format(p.valor)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
            </View>
          )}

          {tipoMovimento === "saida" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pagar com</Text>
              <View style={styles.segment}>
                {[
                  { id: "geral", label: "Caixa geral" },
                  { id: "caixinha", label: "Caixinha" },
                ].map((opt) => {
                  const ativo = origemPagamento === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.segmentBtn,
                        ativo && { backgroundColor: colors.principal },
                      ]}
                      onPress={() => {
                        setOrigemPagamento(opt.id);
                        if (opt.id === "geral") setCaixinhaId(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          ativo && { color: "#fff" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {origemPagamento === "geral" ? (
                <Text style={styles.hint}>
                  Disponível: R$ {formatoMoeda.format(saldoDisponivel || 0)}
                </Text>
              ) : caixinhasComSaldo.length === 0 ? (
                <Text style={styles.empty}>Nenhuma caixinha com saldo</Text>
              ) : (
                caixinhasComSaldo.map((cx) => {
                  const ativo = caixinhaId === cx.id;
                  return (
                    <TouchableOpacity
                      key={cx.id}
                      style={[
                        styles.selectCard,
                        ativo && {
                          borderColor: colors.principal,
                          backgroundColor: "#fff",
                        },
                      ]}
                      onPress={() => setCaixinhaId(cx.id)}
                    >
                      <View style={styles.selectIcon}>
                        <Ionicons
                          name="wallet-outline"
                          size={16}
                          color={ativo ? colors.principal : "#9aa0a6"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectTitle}>{cx.nome}</Text>
                        <Text style={styles.selectSub}>
                          R$ {formatoMoeda.format(cx.valor || 0)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados</Text>

            <TouchableOpacity
              style={styles.field}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.fieldLabel}>Data</Text>
              <Text style={styles.fieldValue}>
                {data.toLocaleDateString("pt-BR")}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={data}
                mode="date"
                display="default"
                onChange={(e, selected) => {
                  setShowDatePicker(false);
                  if (selected) setData(selected);
                }}
              />
            )}

            {modo === "nova" && (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Descrição</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Descreva o registro"
                    placeholderTextColor="#b0b5ba"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {isSaldoInicial ? "Saldo inicial" : "Valor total"}
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={valorTotal}
                    onChangeText={setValorTotal}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#b0b5ba"
                  />
                </View>
              </>
            )}

            {modo === "nova" && tipo === "Parcelada" && (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Quantidade de parcelas</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={qtdParcelas}
                    onChangeText={setQtdParcelas}
                    keyboardType="number-pad"
                    placeholder="2"
                    placeholderTextColor="#b0b5ba"
                  />
                </View>
                {previewParcela > 0 && (
                  <Text style={styles.hint}>
                    {qtdNum}x de R$ {formatoMoeda.format(previewParcela)}
                  </Text>
                )}
              </>
            )}

            {modo === "nova" && !isSaldoInicial && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {tipo === "Parcelada"
                    ? "Valor pago agora (parcelas iniciais)"
                    : "Valor agora"}
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  value={valorParcial}
                  onChangeText={setValorParcial}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor="#b0b5ba"
                />
              </View>
            )}

            {modo === "adicionar" &&
              !(
                Array.isArray(selecionado?.parcelas) &&
                selecionado.parcelas.length > 0
              ) && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Valor deste pagamento</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={valorParcial}
                    onChangeText={setValorParcial}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#b0b5ba"
                  />
                </View>
              )}

            {tipoMovimento === "saida" && modo === "nova" && (
              <View style={styles.reciboRow}>
                <TouchableOpacity style={styles.reciboBtn} onPress={tirarFoto}>
                  <Ionicons
                    name={reciboUri ? "camera" : "camera-outline"}
                    size={22}
                    color={reciboUri ? colors.principal : "#9aa0a6"}
                  />
                  <Text style={styles.reciboLabel}>Recibo</Text>
                </TouchableOpacity>
                {reciboUri && (
                  <Image source={{ uri: reciboUri }} style={styles.preview} />
                )}
              </View>
            )}

            <View style={[styles.field, { minHeight: 88 }]}>
              <Text style={styles.fieldLabel}>Observação</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 48 }]}
                value={observacao}
                onChangeText={setObservacao}
                multiline
                placeholder="Opcional"
                placeholderTextColor="#b0b5ba"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.principal }]}
            onPress={salvar}
            activeOpacity={0.85}
          >
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f5f7" },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 120, },
  segment: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#555",
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#8a8f98",
    marginBottom: 10,
    marginLeft: 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  chipDisabled: { backgroundColor: "#ececec", opacity: 0.7 },
  chipText: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#333",
  },
  chipTextDisabled: { color: "#9aa0a6" },
  selectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  selectIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#f4f5f7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectTitle: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  selectSub: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#8a8f98",
    marginTop: 4,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  field: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#1f2933",
    padding: 0,
  },
  reciboRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  reciboBtn: {
    width: 100,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reciboLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
  },
  preview: { height: 110, aspectRatio: 9 / 16, borderRadius: 16 },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
});
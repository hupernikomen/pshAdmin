import { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from "react-native";
import { useTheme, useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import { collection, addDoc } from "firebase/firestore";
import Load from "../componentes/Load";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import { MINISTERIOS } from "../constants/ministerios";

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
  const hoje = inicioDoDia(new Date());
  const dia = inicioDoDia(d || new Date());
  return dia.getTime() > hoje.getTime();
}

function montarParcelas({
  valorTotal,
  qtd,
  dataBase,
  valorPagoAgora,
  origemPagamento,
  caixinhaId,
  caixinhaNome,
}) {
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

const TIPOS_ENTRADA = [
  { id: "Dízimo", exemplo: "" },
  { id: "Oferta", exemplo: "Oferta de culto, oferta alçada, etc." },
  { id: "Campanhas", exemplo: "Campanha de construção, arrecadações, etc." },
  { id: "Outros", exemplo: "Doações, vendas, etc." },
];

const TIPOS_SAIDA = [
  { id: "Fixa", exemplo: "Energia, internet, aluguel, prebenda, etc." },
  { id: "Avulsa", exemplo: "Manutenção, material de limpeza, serviços, etc." },
  { id: "Parcelada", exemplo: "Compras no cartão ou acordadas." },
];

export default function Registro() {
  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

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
    getIgrejaId,
    podeEditarFinanceiro,
    igrejaAtiva,
  } = useContext(AppContext);

  const { showAlert } = useAppAlert();
  const { uid } = useAuth();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#8a8f98");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const placeholder = muted;
  const separator = dark ? "#3a3a3a" : "#ececec";
  const danger = colors.negativo || "#C62828";

  const [tipoMovimento, setTipoMovimento] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [data, setData] = useState(new Date());
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(() =>
    maisUmMes(new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDatePrimeira, setShowDatePrimeira] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("1");
  const [reciboUri, setReciboUri] = useState(null);
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [ministerio, setMinisterio] = useState("");
  const [modalMinisterio, setModalMinisterio] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);

  // Preenche automaticamente os dados se vier da Projeção de Gastos (mantendo o valor em branco)
  useEffect(() => {
    const gasto = route.params?.preencherGasto;
    if (gasto) {
      setTipoMovimento(gasto.tipoMovimento || "saida");
      setTipo(gasto.tipo || "Avulsa");
      setDescricao(gasto.descricao || "");
      setMinisterio(gasto.ministerio || "");
      setObservacao(gasto.observacao || "");
      if (gasto.quantidadeParcelas) setQtdParcelas(gasto.quantidadeParcelas);
      if (gasto.data) setData(new Date(gasto.data));
    }
  }, [route.params]);

  const listaTipos = tipoMovimento === "entrada" ? TIPOS_ENTRADA : TIPOS_SAIDA;
  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;

  const temCaixinhaComSaldo = (caixinhas || []).some(
    (c) => (Number(c.valor) || 0) > 0
  );

  const mostrarOrigemSaida = tipoMovimento === "saida" && temCaixinhaComSaldo;

  useEffect(() => {
    const tem = (caixinhas || []).some((c) => (Number(c.valor) || 0) > 0);
    if (tipoMovimento !== "saida" || !tem) {
      setOrigemPagamento("geral");
      setCaixinhaId(null);
    }
    if (tipoMovimento !== "saida") {
      setMinisterio("");
    }
  }, [tipoMovimento, caixinhas]);

  function escolherTipo(t) {
    setTipo(t);
    if (t === "Parcelada") {
      if (!qtdParcelas) setQtdParcelas("2");
      setDataPrimeiraParcela(maisUmMes(data));
    }
    setModalTipo(false);
  }

  function valorPagoNaCriacao(total) {
    if (tipo === "Parcelada") return 0;
    if (isDataFutura(data)) return 0;
    return total;
  }

  async function salvarImagemLocal(uri) {
    const nomeArquivo = `recibo_${Date.now()}.jpg`;
    const pastaDestino = `${RNFS.DocumentDirectoryPath}/recibos`;
    const pastaExiste = await RNFS.exists(pastaDestino);
    if (!pastaExiste) await RNFS.mkdir(pastaDestino);
    const caminhoFinal = `${pastaDestino}/${nomeArquivo}`;
    await RNFS.copyFile(uri, caminhoFinal);
    return `file://${caminhoFinal}`;
  }

  async function escolherDaGaleria() {
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setReciboUri(asset.uri);
    } catch (error) {
      showAlert({ title: "Erro", message: "Não foi possível abrir a galeria." });
    }
  }

  function validarOrigemSaida(valorPagoAgora) {
    if (tipoMovimento !== "saida") return true;
    if (!(valorPagoAgora > 0)) return true;

    if (origemPagamento === "geral") {
      if (valorPagoAgora > (Number(saldoDisponivel) || 0) + 0.001) {
        showAlert({
          title: "Saldo insuficiente",
          message: `Caixa livre disponível: R$ ${formatoMoeda.format(
            saldoDisponivel || 0
          )}`,
        });
        return false;
      }
      return true;
    }
    if (!caixinhaId) {
      showAlert({ title: "Atenção", message: "Selecione a caixinha de origem." });
      return false;
    }
    const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
    if (!cx) {
      showAlert({ title: "Atenção", message: "Caixinha não encontrada." });
      return false;
    }
    if (valorPagoAgora > (Number(cx.valor) || 0) + 0.001) {
      showAlert({
        title: "Saldo insuficiente",
        message: `"${cx.nome}" tem R$ ${formatoMoeda.format(cx.valor || 0)}`,
      });
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
      showAlert({ title: "Atenção", message: "Faça login novamente." });
      return;
    }
    if (!igrejaId) {
      showAlert({ title: "Atenção", message: "Nenhuma igreja selecionada." });
      return;
    }
    if (podeEditarFinanceiro && !podeEditarFinanceiro()) {
      showAlert({
        title: "Sem permissão",
        message: "Seu perfil é somente leitura nesta igreja.",
      });
      return;
    }
    if (!tipoMovimento) {
      showAlert({ title: "Atenção", message: "Selecione Entrada ou Saída." });
      return;
    }
    if (!tipo || !descricao || !valorTotal) {
      showAlert({ title: "Atenção", message: "Preencha os campos obrigatórios." });
      return;
    }

    const caixinhaSel = (caixinhas || []).find((c) => c.id === caixinhaId);
    const valor = parseNumero(valorTotal);

    if (!(valor > 0)) {
      showAlert({ title: "Atenção", message: "Informe o valor total." });
      return;
    }

    const parcial = valorPagoNaCriacao(valor);

    if (tipo === "Parcelada") {
      const qtd = parseInt(qtdParcelas, 10) || 1;
      if (qtd < 1) {
        showAlert({
          title: "Atenção",
          message: "Informe a quantidade de parcelas.",
        });
        return;
      }
      if (!dataPrimeiraParcela) {
        showAlert({
          title: "Atenção",
          message: "Informe a data da primeira parcela.",
        });
        return;
      }
      if (!validarOrigemSaida(parcial)) return;

      setLoad(true);
      try {
        const montado = montarParcelas({
          valorTotal: valor,
          qtd,
          dataBase: dataPrimeiraParcela,
          valorPagoAgora: parcial,
          origemPagamento,
          caixinhaId,
          caixinhaNome: caixinhaSel?.nome || null,
        });

        await addDoc(collection(db, "registros"), {
          igrejaId,
          idUsuario: uid,
          tipoMovimento: "saida",
          tipo: "Parcelada",
          data: data.getTime(),
          dataPrimeiraParcela: dataPrimeiraParcela.getTime(),
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
          ministerio: ministerio || null,
          reciboUrl: reciboUri ? await salvarImagemLocal(reciboUri) : null,
          reg: Date.now(),
          createdAt: Date.now(),
        });

        await debitarOrigemSeSaida(montado.valorPagoTotal);
        await Promise.all([
          HistoricoMovimentos(),
          ResumoFinanceiro(),
          CarregarCaixinhas?.(),
        ]);

        setAviso({
          titulo: "Sucesso",
          mensagem: "Compra parcelada registrada!",
        });
        navigation.goBack();
      } catch (e) {
        showAlert({
          title: "Erro",
          message: e.message || "Não foi possível salvar",
        });
      } finally {
        setLoad(false);
      }
      return;
    }

    if (!validarOrigemSaida(parcial)) return;
    setLoad(true);
    try {
      const base = {
        igrejaId,
        idUsuario: uid,
        tipoMovimento,
        tipo,
        data: data.getTime(),
        descricao: descricao.trim(),
        valorTotal: valor,
        observacao: observacao.trim(),
        status: parcial >= valor ? "quitada" : "aberta",
        reg: Date.now(),
        createdAt: Date.now(),
      };

      if (tipoMovimento === "entrada") {
        base.valoresRecebidos =
          parcial > 0
            ? [{ valor: parcial, data: data.getTime(), id: Date.now().toString() }]
            : [];
        base.valorRecebidoTotal = parcial;
      } else {
        base.valoresPagos =
          parcial > 0
            ? [
                {
                  valor: parcial,
                  data: data.getTime(),
                  id: Date.now().toString(),
                  origemPagamento,
                  caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
                  caixinhaNome:
                    origemPagamento === "caixinha"
                      ? caixinhaSel?.nome || null
                      : null,
                },
              ]
            : [];
        base.valorPagoTotal = parcial;
        base.quantidadeParcelas = 1;
        base.origemPagamento = origemPagamento;
        base.caixinhaId = origemPagamento === "caixinha" ? caixinhaId : null;
        base.caixinhaNome =
          origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null;
        base.ministerio = ministerio || null;
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
      showAlert({
        title: "Erro",
        message: e.message || "Não foi possível salvar",
      });
    } finally {
      setLoad(false);
    }
  }

  if (load) return <Load />;

  const caixinhasComSaldo = (caixinhas || []).filter(
    (c) => (Number(c.valor) || 0) > 0
  );

  const qtdNum = parseInt(qtdParcelas, 10) || 0;
  const totalNum = parseNumero(valorTotal);
  const previewParcela =
    tipo === "Parcelada" && qtdNum > 0 && totalNum > 0
      ? arred(totalNum / qtdNum)
      : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 24}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={[styles.segment, { backgroundColor: card }]}>
          {["entrada", "saida"].map((item) => {
            const ativo = tipoMovimento === item;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.segmentBtn,
                  ativo && { backgroundColor: principal },
                ]}
                onPress={() => {
                  setTipoMovimento(item);
                  setTipo(null);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: muted },
                    ativo && { color: "#fff" },
                  ]}
                >
                  {item === "entrada" ? "Entrada" : "Saída"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tipoMovimento && (
          <>
            {mostrarOrigemSaida && (
              <View style={styles.section}>
                <View style={[styles.segment, { backgroundColor: card }]}>
                  {[
                    { id: "geral", label: "Caixa livre" },
                    { id: "caixinha", label: "Caixinha" },
                  ].map((opt) => {
                    const ativo = origemPagamento === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.segmentBtn,
                          ativo && { backgroundColor: principal },
                        ]}
                        onPress={() => {
                          setOrigemPagamento(opt.id);
                          if (opt.id === "geral") setCaixinhaId(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: muted },
                            ativo && { color: "#fff" },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {origemPagamento === "geral" ? null : caixinhasComSaldo.length ===
                  0 ? (
                  <Text style={[styles.empty, { color: muted }]}>
                    Nenhuma caixinha com saldo
                  </Text>
                ) : (
                  caixinhasComSaldo.map((cx) => {
                    const ativo = caixinhaId === cx.id;
                    return (
                      <TouchableOpacity
                        key={cx.id}
                        style={[
                          styles.selectCard,
                          {
                            backgroundColor: card,
                            borderColor: ativo ? principal : "transparent",
                          },
                        ]}
                        onPress={() => setCaixinhaId(cx.id)}
                      >
                        <View
                          style={[styles.selectIcon, { backgroundColor: surface }]}
                        >
                          <Ionicons
                            name="wallet-outline"
                            size={16}
                            color={ativo ? principal : muted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectTitle, { color: text }]}>
                            {cx.nome}
                          </Text>
                          <Text style={[styles.selectSub, { color: muted }]}>
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
              <Text style={[styles.sectionTitle, { color: muted }]}>Dados</Text>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: card, marginBottom: 24 }]}
                onPress={() => setModalTipo(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>Tipo</Text>
                <View style={styles.fieldRow}>
                  <Text
                    style={[styles.fieldValue, { color: tipo ? text : muted }]}
                  >
                    {tipo || "Selecione o tipo"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={muted} />
                </View>
              </TouchableOpacity>

              {tipo !== "Parcelada" && (
                <TouchableOpacity
                  style={[styles.field, { backgroundColor: card }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.fieldLabel, { color: muted }]}>Data</Text>
                  <Text style={[styles.fieldValue, { color: text }]}>
                    {data.toLocaleDateString("pt-BR")}
                  </Text>
                </TouchableOpacity>
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={data}
                  mode="date"
                  display="default"
                  onChange={(e, selected) => {
                    setShowDatePicker(false);
                    if (selected) {
                      setData(selected);
                      setDataPrimeiraParcela(maisUmMes(selected));
                    }
                  }}
                />
              )}

              {tipoMovimento === "saida" && (
                <TouchableOpacity
                  style={[styles.field, { backgroundColor: card }]}
                  onPress={() => setModalMinisterio(true)}
                  activeOpacity={0.8}
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
              )}

              <View style={[styles.field, { backgroundColor: card }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Descrição
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text }]}
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descreva o registro"
                  placeholderTextColor={placeholder}
                />
              </View>

              <View style={[styles.field, { backgroundColor: card }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Valor total
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text }]}
                  value={valorTotal}
                  onChangeText={setValorTotal}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={placeholder}
                />
              </View>

              {tipo === "Parcelada" && (
                <>
                  <View style={[styles.field, { backgroundColor: card }]}>
                    <Text style={[styles.fieldLabel, { color: muted }]}>
                      Quantidade de parcelas
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: text }]}
                      value={qtdParcelas}
                      onChangeText={setQtdParcelas}
                      keyboardType="number-pad"
                      placeholder="2"
                      placeholderTextColor={placeholder}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.field, { backgroundColor: card }]}
                    onPress={() => setShowDatePrimeira(true)}
                  >
                    <Text style={[styles.fieldLabel, { color: muted }]}>
                      Data primeira parcela
                    </Text>
                    <Text style={[styles.fieldValue, { color: text }]}>
                      {dataPrimeiraParcela.toLocaleDateString("pt-BR")}
                    </Text>
                  </TouchableOpacity>

                  {showDatePrimeira && (
                    <DateTimePicker
                      value={dataPrimeiraParcela}
                      mode="date"
                      display="default"
                      onChange={(e, selected) => {
                        setShowDatePrimeira(false);
                        if (selected) setDataPrimeiraParcela(selected);
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

              {tipoMovimento === "saida" && (
                <View style={[styles.field, { backgroundColor: card }]}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>
                    Comprovante / Recibo (opcional)
                  </Text>
                  <View style={styles.reciboContainer}>
                    {reciboUri ? (
                      <View style={styles.reciboPreviewRow}>
                        <Image source={{ uri: reciboUri }} style={styles.reciboMini} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <TouchableOpacity onPress={escolherDaGaleria}>
                            <Text style={[styles.reciboAcaoText, { color: principal }]}>Trocar foto</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setReciboUri(null)}>
                            <Text style={[styles.reciboAcaoText, { color: danger }]}>Remover foto</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.uploadBtn, { borderColor: muted }]}
                        onPress={escolherDaGaleria}
                      >
                        <Ionicons name="camera-outline" size={20} color={principal} />
                        <Text style={[styles.uploadText, { color: text }]}>Adicionar foto do recibo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              <View style={[styles.field, { minHeight: 88, backgroundColor: card }]}>
                <Text style={[styles.fieldLabel, { color: muted }]}>
                  Observação
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: text, minHeight: 48 }]}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                  placeholder="Opcional"
                  placeholderTextColor={placeholder}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: principal }]}
              onPress={salvar}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>Salvar</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={modalTipo}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTipo(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalTipo(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: text }]}>Tipo</Text>
            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {listaTipos.map((item, index) => {
                const ativo = tipo === item.id;
                const ultimo = index === listaTipos.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalItem,
                      !ultimo && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: separator,
                      },
                    ]}
                    onPress={() => escolherTipo(item.id)}
                  >
                    <View style={styles.modalItemLeft}>
                      <Text style={[styles.modalItemText, { color: text }]}>
                        {item.id}
                      </Text>
                      <Text style={[styles.modalItemExemplo, { color: muted }]}>
                        {item.exemplo}
                      </Text>
                    </View>
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
            style={[styles.modalCard, { backgroundColor: card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: text }]}>Ministério</Text>
            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <TouchableOpacity
                style={[
                  styles.modalItem,
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
                <Text style={[styles.modalItemText, { color: muted }]}>Nenhum</Text>
                {!ministerio && (
                  <Ionicons name="checkmark" size={18} color={principal} />
                )}
              </TouchableOpacity>

              {MINISTERIOS.map((m, index) => {
                const ativo = ministerio === m;
                const ultimo = index === MINISTERIOS.length - 1;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.modalItem,
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
                    <Text style={[styles.modalItemText, { color: text }]}>{m}</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14 },
  content: { paddingTop: 12, paddingBottom: 120 },
  segment: {
    flexDirection: "row",
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
  segmentText: { fontSize: 13, fontFamily: "Roboto-Medium" },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    marginBottom: 10,
    marginLeft: 2,
  },
  selectCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  selectIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectTitle: { fontSize: 14, fontFamily: "Roboto-Medium" },
  selectSub: { fontSize: 12, fontFamily: "Roboto-Regular", marginTop: 2 },
  hint: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    marginTop: 4,
    marginBottom: 8,
  },
  empty: { fontSize: 13, fontFamily: "Roboto-Regular" },
  field: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fieldLabel: { fontSize: 11, fontFamily: "Roboto-Regular", marginBottom: 4 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldValue: { fontSize: 15, fontFamily: "Roboto-Medium", flex: 1 },
  fieldInput: { fontSize: 15, fontFamily: "Roboto-Regular", padding: 0 },
  reciboContainer: { marginTop: 4 },
  uploadBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: { fontSize: 14, fontFamily: "Roboto-Medium" },
  reciboPreviewRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  reciboMini: { width: 48, height: 60, borderRadius: 8, backgroundColor: "#eee" },
  reciboAcaoText: { fontSize: 13, fontFamily: "Roboto-Medium" },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveText: { color: "#fff", fontSize: 16, fontFamily: "Roboto-Bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 17, fontFamily: "Roboto-Bold", marginBottom: 8 },
  modalList: { maxHeight: 360 },
  modalListContent: { paddingBottom: 4 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  modalItemLeft: { flex: 1, paddingRight: 8 },
  modalItemText: { fontSize: 15, fontFamily: "Roboto-Medium" },
  modalItemExemplo: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    lineHeight: 16,
  },
});
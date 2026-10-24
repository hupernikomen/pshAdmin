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
import { Picker } from "@react-native-picker/picker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import { collection, addDoc } from "firebase/firestore";
import Load from "../componentes/Load";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";
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

export default function Registro() {
  const { colors, dark } = useTheme();
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
    getIgrejaId,
    podeEditarFinanceiro,
    igrejaAtiva,
  } = useContext(AppContext);

  const { uid } = useAuth();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#8a8f98");
  const card = colors.card;
  const bg = colors.background;
  const placeholder = muted;

  const [tipoMovimento, setTipoMovimento] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [data, setData] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [temAdiantamento, setTemAdiantamento] = useState(false);
  const [valorParcial, setValorParcial] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("1");
  const [reciboUri, setReciboUri] = useState(null);
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [ministerio, setMinisterio] = useState("");

  const tiposEntrada = ["Dízimo", "Oferta", "Campanhas", "Outros"];
  const tiposSaida = ["Conta Única", "Parcelada"];

  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;

  useEffect(() => {
    if (tipoMovimento !== "saida") {
      setOrigemPagamento("geral");
      setCaixinhaId(null);
      setMinisterio("");
    }
  }, [tipoMovimento]);

  async function salvarImagemLocal(uri) {
    const nomeArquivo = `recibo_${Date.now()}.jpg`;
    const pastaDestino = `${RNFS.DocumentDirectoryPath}/recibos`;
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
          Alert.alert(
            "Permissão negada",
            "Precisamos da câmera para continuar."
          );
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
    } catch (error) {
      Alert.alert("Erro", "Não foi possível abrir a galeria.");
    }
  }

  function valorDoAdiantamento(total) {
    if (!temAdiantamento) {
      return tipo === "Parcelada" ? 0 : total;
    }
    return parseNumero(valorParcial);
  }

  function validarOrigemSaida(valorPagoAgora) {
    if (tipoMovimento !== "saida") return true;
    if (origemPagamento === "geral") {
      if (valorPagoAgora > (Number(saldoDisponivel) || 0) + 0.001) {
        Alert.alert(
          "Saldo insuficiente",
          `Caixa livre disponível: R$ ${formatoMoeda.format(
            saldoDisponivel || 0
          )}`
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
    if (!igrejaId) {
      Alert.alert("Atenção", "Nenhuma igreja selecionada.");
      return;
    }
    if (podeEditarFinanceiro && !podeEditarFinanceiro()) {
      Alert.alert(
        "Sem permissão",
        "Seu perfil é somente leitura nesta igreja."
      );
      return;
    }
    if (!tipoMovimento) {
      Alert.alert("Atenção", "Selecione Entrada ou Saída.");
      return;
    }
    if (!tipo || !descricao || !valorTotal) {
      Alert.alert("Atenção", "Preencha os campos obrigatórios.");
      return;
    }

    const caixinhaSel = (caixinhas || []).find((c) => c.id === caixinhaId);
    const valor = parseNumero(valorTotal);

    if (!(valor > 0)) {
      Alert.alert("Atenção", "Informe o valor total.");
      return;
    }

    if (temAdiantamento) {
      const adiant = parseNumero(valorParcial);
      if (!(adiant > 0)) {
        Alert.alert("Atenção", "Informe o valor do adiantamento.");
        return;
      }
      if (adiant > valor + 0.001) {
        Alert.alert(
          "Atenção",
          "O adiantamento não pode ser maior que o valor total."
        );
        return;
      }
    }

    const parcial = valorDoAdiantamento(valor);

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

        await addDoc(collection(db, "registros"), {
          igrejaId,
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
        Alert.alert("Erro", e.message || "Não foi possível salvar");
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
            ? [
                {
                  valor: parcial,
                  data: data.getTime(),
                  id: Date.now().toString(),
                },
              ]
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
      Alert.alert("Erro", e.message || "Não foi possível salvar");
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

  const labelAdiantamento =
    tipoMovimento === "entrada"
      ? "Houve adiantamento recebido"
      : "Houve adiantamento pago";

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
                  setTemAdiantamento(false);
                  setValorParcial("");
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

        {tipoMovimento === "saida" && (
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

            {origemPagamento === "geral" ? (
              <Text style={[styles.hint, { color: muted }]}>
                Disponível: R$ {formatoMoeda.format(saldoDisponivel || 0)}
              </Text>
            ) : caixinhasComSaldo.length === 0 ? (
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
                      style={[
                        styles.selectIcon,
                        { backgroundColor: dark ? "#2a2a2a" : "#f4f5f7" },
                      ]}
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

        {tipoMovimento && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Tipo</Text>
              <View style={styles.chips}>
                {(tipoMovimento === "entrada" ? tiposEntrada : tiposSaida).map(
                  (t) => {
                    const ativo = tipo === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.chip,
                          { backgroundColor: card },
                          ativo && { backgroundColor: principal },
                        ]}
                        onPress={() => {
                          setTipo(t);
                          if (t === "Parcelada" && !qtdParcelas) {
                            setQtdParcelas("2");
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: text },
                            ativo && { color: "#fff" },
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

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Dados</Text>

              <TouchableOpacity
                style={[styles.field, { backgroundColor: card }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[styles.fieldLabel, { color: muted }]}>Data</Text>
                <Text style={[styles.fieldValue, { color: text }]}>
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

              {tipoMovimento === "saida" && (
                <View style={[styles.field, { backgroundColor: card }]}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>
                    Ministério (opcional)
                  </Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={ministerio}
                      onValueChange={(v) => setMinisterio(v)}
                      style={[styles.picker, { color: text }]}
                      dropdownIconColor={text}
                    >
                      <Picker.Item
                        label="Selecione o ministério"
                        value=""
                        color={muted}
                      />
                      {MINISTERIOS.map((m) => (
                        <Picker.Item key={m} label={m} value={m} color={text} />
                      ))}
                    </Picker>
                  </View>
                </View>
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
                  {previewParcela > 0 && (
                    <Text style={[styles.hint, { color: muted }]}>
                      {qtdNum}x de R$ {formatoMoeda.format(previewParcela)}
                    </Text>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.checkRow, { backgroundColor: card }]}
                onPress={() => {
                  setTemAdiantamento((v) => {
                    if (v) setValorParcial("");
                    return !v;
                  });
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={temAdiantamento ? "checkbox" : "square-outline"}
                  size={22}
                  color={temAdiantamento ? principal : muted}
                />
                <Text style={[styles.checkText, { color: text }]}>
                  {labelAdiantamento}
                </Text>
              </TouchableOpacity>

              {temAdiantamento && (
                <View style={[styles.field, { backgroundColor: card }]}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>
                    Adiantamento
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { color: text }]}
                    value={valorParcial}
                    onChangeText={setValorParcial}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={placeholder}
                  />
                </View>
              )}

              {tipoMovimento === "saida" && (
                <View style={styles.reciboRow}>
                  <TouchableOpacity
                    style={[styles.reciboBtn, { backgroundColor: card }]}
                    onPress={tirarFoto}
                  >
                    <Ionicons
                      name={reciboUri ? "camera" : "camera-outline"}
                      size={22}
                      color={reciboUri ? principal : muted}
                    />
                    <Text style={[styles.reciboLabel, { color: muted }]}>
                      Câmera
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.reciboBtn, { backgroundColor: card }]}
                    onPress={escolherDaGaleria}
                  >
                    <Ionicons
                      name="images-outline"
                      size={22}
                      color={reciboUri ? principal : muted}
                    />
                    <Text style={[styles.reciboLabel, { color: muted }]}>
                      Galeria
                    </Text>
                  </TouchableOpacity>

                  {reciboUri && (
                    <Image source={{ uri: reciboUri }} style={styles.preview} />
                  )}
                </View>
              )}

              <View
                style={[
                  styles.field,
                  { minHeight: 88, backgroundColor: card },
                ]}
              >
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14 },
  content: {
    paddingTop: 12,
    paddingBottom: 120,
  },
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
  segmentText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    marginBottom: 10,
    marginLeft: 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
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
  selectTitle: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  selectSub: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginTop: 4,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
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
  fieldValue: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    padding: 0,
  },
  pickerWrap: {
    marginHorizontal: -8,
    marginBottom: Platform.OS === "ios" ? 0 : -8,
  },
  picker: {
    marginTop: -12,
    ...(Platform.OS === "android" ? { height: 55 } : { height: 140 }),
  },
  reciboRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  reciboBtn: {
    width: 100,
    height: 110,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reciboLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
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
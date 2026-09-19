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
import { useAuth } from "../../context/AuthContext"; // caminho do seu projeto


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

console.log(uid, 'UID');


  const [tipoMovimento, setTipoMovimento] = useState(null);
  const [modo, setModo] = useState("nova");
  const [tipo, setTipo] = useState(null);
  const [data, setData] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorParcial, setValorParcial] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState("");
  const [reciboUri, setReciboUri] = useState(null);
  const [abertos, setAbertos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);

  const tiposEntrada = ["Dízimo", "Oferta", "Bazar"];
  const tiposSaida = ["Conta Fixa", "Parcelada"];

  useEffect(() => {
    if (modo === "adicionar" && tipoMovimento) {
      carregarAbertos();
    } else {
      setAbertos([]);
      setSelecionado(null);
    }
  }, [modo, tipoMovimento]);

  useEffect(() => {
    if (tipoMovimento !== "saida") {
      setOrigemPagamento("geral");
      setCaixinhaId(null);
    }
  }, [tipoMovimento]);

  async function carregarAbertos() {
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
    if (modo === "adicionar" && (!selecionado || !valorParcial)) {
      Alert.alert("Atenção", "Selecione um registro e informe o valor.");
      return;
    }

    const valorPagoAgora =
      modo === "adicionar"
        ? parseNumero(valorParcial)
        : parseNumero(valorParcial || valorTotal);

    if (!validarOrigemSaida(valorPagoAgora)) return;

    setLoad(true);

    try {
      const caixinhaSel = (caixinhas || []).find((c) => c.id === caixinhaId);

      if (modo === "adicionar") {
        const valor = parseNumero(valorParcial);
        const novoPagamento = {
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
        };

        const campoArray =
          tipoMovimento === "entrada" ? "valoresRecebidos" : "valoresPagos";
        const campoTotal =
          tipoMovimento === "entrada" ? "valorRecebidoTotal" : "valorPagoTotal";

        const listaAtual = selecionado[campoArray] || [];
        const novoTotal =
          Math.round(((selecionado[campoTotal] || 0) + valor) * 100) / 100;

        await updateDoc(doc(db, "registros", selecionado.id), {
          [campoArray]: [...listaAtual, novoPagamento],
          [campoTotal]: novoTotal,
          status: novoTotal >= selecionado.valorTotal ? "quitada" : "aberta",
        });

        await debitarOrigemSeSaida(valor);
      } else {
        const valor = parseNumero(valorTotal);
        const parcial = valorParcial ? parseNumero(valorParcial) : valor;

        const base = {
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
          base.quantidadeParcelas = qtdParcelas ? parseInt(qtdParcelas, 10) : 1;
          base.origemPagamento = origemPagamento;
          base.caixinhaId = origemPagamento === "caixinha" ? caixinhaId : null;
          base.caixinhaNome =
            origemPagamento === "caixinha" ? caixinhaSel?.nome || null : null;

          if (reciboUri) {
            base.reciboUrl = await salvarImagemLocal(reciboUri);
          } else {
            base.reciboUrl = null;
          }
        }

        await addDoc(collection(db, "registros"), base);
        await debitarOrigemSeSaida(parcial);
      }

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Entrada / Saída */}
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
          {/* Nova / Adicionar */}
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
                    if (opt.id === "nova") setSelecionado(null);
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
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.chip,
                          ativo && { backgroundColor: colors.principal },
                        ]}
                        onPress={() => setTipo(t)}
                      >
                        <Text
                          style={[styles.chipText, ativo && { color: "#fff" }]}
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
                      onPress={() => setSelecionado(item)}
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
                        style={[styles.segmentText, ativo && { color: "#fff" }]}
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
                  <Text style={styles.fieldLabel}>Valor total</Text>
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

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {modo === "nova" ? "Valor agora" : "Valor deste pagamento"}
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

            {tipoMovimento === "saida" && modo === "nova" && (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Parcelas</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={qtdParcelas}
                    onChangeText={setQtdParcelas}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#b0b5ba"
                  />
                </View>

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
              </>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 48,
  },

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

  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#8a8f98",
    marginBottom: 10,
    marginLeft: 2,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#333",
  },

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
    marginTop: 2,
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

  reciboRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
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
  preview: {
    height: 110,
    aspectRatio: 9 / 16,
    borderRadius: 16,
  },

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
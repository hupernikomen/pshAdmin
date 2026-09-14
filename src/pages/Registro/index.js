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
import Ionicons from 'react-native-vector-icons/Ionicons'

export default function Registro() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { setAviso, load, setLoad, HistoricoMovimentos, ResumoFinanceiro } =
    useContext(AppContext);

  const TEMP_USER_ID = "temp_user_001";

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

  const tiposEntrada = ["Dízimo", "Oferta", "Bazar", "Restante", "Outros"];
  const tiposSaida = ["Conta Fixa", "Parcelada", "Futura", "Outros"];

  useEffect(() => {
    if (modo === "adicionar" && tipoMovimento) {
      carregarAbertos();
    } else {
      setAbertos([]);
      setSelecionado(null);
    }
  }, [modo, tipoMovimento]);

  async function carregarAbertos() {
    try {
      const q = query(
        collection(db, "registros"),
        where("idUsuario", "==", TEMP_USER_ID),
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

      if (result.assets?.length > 0) {
        setReciboUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível abrir a câmera.");
    }
  }


  async function salvar() {
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

    setLoad(true);

    try {
      if (modo === "adicionar") {
        const valor = parseFloat(valorParcial);
        const novoPagamento = {
          valor,
          data: data.getTime(),
          id: Date.now().toString(),
        };

        const campoArray = tipoMovimento === "entrada" ? "valoresRecebidos" : "valoresPagos";
        const campoTotal = tipoMovimento === "entrada" ? "valorRecebidoTotal" : "valorPagoTotal";

        const listaAtual = selecionado[campoArray] || [];
        const novoTotal = (selecionado[campoTotal] || 0) + valor;

        await updateDoc(doc(db, "registros", selecionado.id), {
          [campoArray]: [...listaAtual, novoPagamento],
          [campoTotal]: novoTotal,
          status: novoTotal >= selecionado.valorTotal ? "quitada" : "aberta",
        });
      } else {
        const valor = parseFloat(valorTotal);
        const parcial = valorParcial ? parseFloat(valorParcial) : valor;

        const base = {
          idUsuario: TEMP_USER_ID,
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
          base.valoresRecebidos = [{ valor: parcial, data: data.getTime(), id: Date.now().toString() }];
          base.valorRecebidoTotal = parcial;
        } else {
          base.valoresPagos = [{ valor: parcial, data: data.getTime(), id: Date.now().toString() }];
          base.valorPagoTotal = parcial;
          base.quantidadeParcelas = qtdParcelas ? parseInt(qtdParcelas) : 1;
          base.reciboUrl = reciboUri || null;

          // só salva a imagem agora
          if (reciboUri) {
            const caminhoFinal = await salvarImagemLocal(reciboUri);
            base.reciboUrl = caminhoFinal;
          } else {
            base.reciboUrl = null;
          }
        }


        await addDoc(collection(db, "registros"), base);
      }

      await Promise.all([HistoricoMovimentos(), ResumoFinanceiro()]);
      setAviso({ titulo: "Sucesso", mensagem: "Registro salvo!" });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", e.message || "Não foi possível salvar");
    } finally {
      setLoad(false);
    }
  }

  if (load) return <Load />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.segment}>
        {["entrada", "saida"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.segmentBtn,
              tipoMovimento === item && { backgroundColor: colors.principal },
            ]}
            onPress={() => {
              setTipoMovimento(item);
              setTipo(null);
              setModo("nova");
              setSelecionado(null);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                tipoMovimento === item && { color: "#fff" },
              ]}
            >
              {item === "entrada" ? "Entrada" : "Saída"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tipoMovimento && (
        <>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modo === "nova" && { backgroundColor: colors.principal },
              ]}
              onPress={() => {
                setModo("nova");
                setSelecionado(null);
              }}
            >
              <Text style={[styles.segmentText, modo === "nova" && { color: "#fff" }]}>
                Nova
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                modo === "adicionar" && { backgroundColor: colors.principal },
              ]}
              onPress={() => setModo("adicionar")}
            >
              <Text style={[styles.segmentText, modo === "adicionar" && { color: "#fff" }]}>
                Adicionar Pagamento
              </Text>
            </TouchableOpacity>
          </View>

          {modo === "nova" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo</Text>
              <View style={styles.chips}>
                {(tipoMovimento === "entrada" ? tiposEntrada : tiposSaida).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      { backgroundColor: tipo === t ? colors.principal : colors.neutro },
                    ]}
                    onPress={() => setTipo(t)}
                  >
                    <Text style={[styles.chipText, tipo === t && { color: "#fff" }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {modo === "adicionar" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selecione o registro</Text>
              {abertos.length === 0 ? (
                <Text style={styles.empty}>Nenhum registro em aberto</Text>
              ) : (
                abertos.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.neutro,
                        borderColor: selecionado?.id === item.id ? colors.principal : "transparent",
                      },
                    ]}
                    onPress={() => setSelecionado(item)}
                  >
                    <Text style={styles.cardTitle}>{item.tipo} • {item.descricao}</Text>
                    <Text style={styles.cardSub}>
                      R$ {(item.valorRecebidoTotal || item.valorPagoTotal || 0).toFixed(2)} de R$ {item.valorTotal?.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados</Text>

            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.inputLabel}>Data</Text>
              <Text style={styles.inputValue}>{data.toLocaleDateString("pt-BR")}</Text>
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
                <View style={styles.input}>
                  <Text style={styles.inputLabel}>Descrição</Text>
                  <TextInput
                    style={styles.textInput}
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Descreva o registro"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.input}>
                  <Text style={styles.inputLabel}>Valor Total</Text>
                  <TextInput
                    style={styles.textInput}
                    value={valorTotal}
                    onChangeText={setValorTotal}
                    keyboardType="numeric"
                    placeholder="0,00"
                    placeholderTextColor="#999"
                  />
                </View>
              </>
            )}

            <View style={styles.input}>
              <Text style={styles.inputLabel}>
                {modo === "nova" ? "Valor agora" : "Valor deste pagamento"}
              </Text>
              <TextInput
                style={styles.textInput}
                value={valorParcial}
                onChangeText={setValorParcial}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor="#999"
              />
            </View>

            {tipoMovimento === "saida" && modo === "nova" && (
              <>
                <View style={styles.input}>
                  <Text style={styles.inputLabel}>Parcelas</Text>
                  <TextInput
                    style={styles.textInput}
                    value={qtdParcelas}
                    onChangeText={setQtdParcelas}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 14 }}>

                  <TouchableOpacity
                    style={[styles.input, { height: 120, alignItems: 'center', justifyContent: 'center', gap: 7 }]}
                    onPress={tirarFoto}
                  >
                    <Text style={styles.inputLabel}>Recibo</Text>
                    <Ionicons name={reciboUri ? 'camera' : 'camera-outline'} size={24} color={reciboUri ? colors.principal : '#777'} />

                  </TouchableOpacity>

                  {reciboUri && (
                    <Image source={{ uri: reciboUri }} style={styles.preview} />
                  )}
                </View>
              </>
            )}

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Observação</Text>
              <TextInput
                style={[styles.textInput, { height: 70 }]}
                value={observacao}
                onChangeText={setObservacao}
                multiline
                placeholder="Opcional"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.principal }]}
            onPress={salvar}
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
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 50,
  },

  // Segmented control (Entrada/Saída e Nova/Adicionar)
  segment: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },

  // Seções
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    marginBottom: 12,
  },

  // Chips de tipo
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },

  // Cards de registros abertos
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  cardSub: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    marginTop: 4,
  },
  empty: {
    fontSize: 14,
    fontFamily: "Roboto-Light",
  },

  // Inputs
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 2,
  },
  inputValue: {
    fontSize: 16,
    fontFamily: "Roboto-Regular",
  },
  textInput: {
    fontSize: 16,
    fontFamily: "Roboto-Regular",
    padding: 0,
  },

  // Foto
  preview: {
    height: 120,
    aspectRatio: 9 / 16,
    borderRadius: 14,
    marginBottom: 10,
  },

  // Botão salvar
  saveBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    elevation: 3,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
});
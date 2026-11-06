import { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute, useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConnection";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import { arred, isDataFutura } from "../utils/financeiro";

function parseNumero(txt) {
  if (!txt) return 0;
  let s = String(txt).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function valorPagoNaConfirmacao(item, valorFinal) {
  if (item.tipo === "Parcelada" || item.tipo === "Sem Prazo") return 0;
  if (isDataFutura(new Date(Number(item.data) || Date.now()))) return 0;
  return arred(Number(valorFinal) || 0);
}

function montarParcelas({ valorTotal, qtd, dataBase, origemPagamento, caixinhaId, caixinhaNome }) {
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

export default function ConfirmarRegistroProjecao() {
  const route = useRoute();
  const navigation = useNavigation();
  const { item } = route.params || {};

  const {
    HistoricoMovimentos,
    ResumoFinanceiro,
    getIgrejaId,
    RetirarDaCaixinha,
    CarregarCaixinhas,
  } = useContext(AppContext);
  const { uid } = useAuth();
  const { showAlert } = useAppAlert();
  const { colors, dark } = useTheme();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : colors.neutro || "#f4f5f7";
  const danger = colors.negativo || "#C62828";

  // Formata o valor inicial garantindo sempre 2 casas decimais e vírgula
  const valorInicialFormatado = Number(item?.valor || 0)
    .toFixed(2)
    .replace(".", ",");

  const [confirmValorTxt, setConfirmValorTxt] = useState(valorInicialFormatado);
  const [dataPag, setDataPag] = useState(
    item?.data ? new Date(item.data) : new Date()
  );
  const [showDate, setShowDate] = useState(false);
  const [confirmReciboUri, setConfirmReciboUri] = useState(item?.reciboUrl || null);
  const [registrando, setRegistrando] = useState(false);

  async function salvarFotoLocal(asset) {
    if (!asset?.uri) return null;
    try {
      const ext = asset.fileName?.split(".").pop() || "jpg";
      const dest = `${RNFS.DocumentDirectoryPath}/recibo_${Date.now()}.${ext}`;
      const from = String(asset.uri).replace("file://", "");
      if (await RNFS.exists(from)) {
        await RNFS.copyFile(from, dest);
      } else {
        await RNFS.copyFile(asset.uri, dest);
      }
      return `file://${dest}`;
    } catch (e) {
      return asset.uri || null;
    }
  }

  async function escolherReciboGaleria() {
    try {
      const res = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const uri = await salvarFotoLocal(asset);
      if (uri) setConfirmReciboUri(uri);
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível abrir a galeria." });
    }
  }

  async function confirmarRegistro() {
    if (registrando || !item) return;
    const valorFinal = parseNumero(confirmValorTxt);
    if (!(valorFinal > 0)) {
      showAlert({ title: "Atenção", message: "Informe um valor válido." });
      return;
    }

    try {
      setRegistrando(true);
      const igrejaId = getIgrejaId?.();
      if (!igrejaId) throw new Error("Igreja não identificada.");

      const agora = Date.now();
      const dataTs = dataPag.getTime();
      const origemPagamento = item.origemPagamento || "geral";
      const cxId = item.caixinhaId || null;
      const cxNome = item.caixinhaNome || null;
      const reciboUri = confirmReciboUri || null;

      if (item.tipo === "Parcelada") {
        const qtd = Math.max(2, parseInt(item.quantidadeParcelas, 10) || 2);
        const montado = montarParcelas({
          valorTotal: valorFinal,
          qtd,
          dataBase: dataTs,
          origemPagamento,
          caixinhaId: cxId,
          caixinhaNome: cxNome,
        });

        await addDoc(collection(db, "registros"), {
          igrejaId,
          idUsuario: uid || null,
          tipoMovimento: "saida",
          tipo: "Parcelada",
          descricao: item.descricao || "Despesa",
          data: dataTs,
          valorTotal: valorFinal,
          valorPagoTotal: 0,
          valoresPagos: [],
          parcelas: montado.parcelas,
          status: "aberta",
          ministerio: item.ministerio || null,
          observacao: item.observacao || null,
          reciboUri,
          origemPagamento,
          caixinhaId: cxId,
          caixinhaNome: cxNome,
          createdAt: agora,
          reg: agora,
          origemProjecaoId: item.id,
        });
      } else {
        const pagoAgora = valorPagoNaConfirmacao(item, valorFinal);
        const futuro = isDataFutura(new Date(dataTs));
        const valoresPagos =
          pagoAgora > 0
            ? [{ valor: pagoAgora, data: dataTs, origemPagamento, caixinhaId: cxId, caixinhaNome: cxNome }]
            : [];

        if (pagoAgora > 0 && origemPagamento === "caixinha" && cxId) {
          await RetirarDaCaixinha?.(cxId, pagoAgora);
        }

        await addDoc(collection(db, "registros"), {
          igrejaId,
          idUsuario: uid || null,
          tipoMovimento: "saida",
          tipo: item.tipo || "Avulsa",
          descricao: item.descricao || "Despesa",
          data: dataTs,
          valorTotal: valorFinal,
          valorPagoTotal: pagoAgora,
          valoresPagos,
          parcelas: [],
          status:
            futuro || item.tipo === "Sem Prazo"
              ? "aberta"
              : pagoAgora >= valorFinal
              ? "quitada"
              : "aberta",
          ministerio: item.ministerio || null,
          observacao: item.observacao || null,
          reciboUri,
          origemPagamento,
          caixinhaId: cxId,
          caixinhaNome: cxNome,
          createdAt: agora,
          reg: agora,
          origemProjecaoId: item.id,
        });
      }

      await deleteDoc(doc(db, "gastosProjetados", item.id));
      await Promise.all([
        HistoricoMovimentos?.(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);

      navigation.goBack();
      showAlert({ title: "Registrado", message: "A despesa foi lançada com sucesso no financeiro." });
    } catch (e) {
      showAlert({ title: "Erro", message: e?.message || "Não foi possível registrar." });
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerSub, { color: muted }]}>
          Revise ou ajuste os dados abaixo antes de efetivar o registro no financeiro.
        </Text>

        {/* Informações fixas do item original */}
        <View style={[styles.infoCard, { backgroundColor: card }]}>
          <Text style={[styles.descPrincipal, { color: text }]}>
            {item?.descricao || "Despesa projetada"}
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: muted }]}>Tipo</Text>
            <Text style={[styles.infoVal, { color: text }]}>{item?.tipo || "—"}</Text>
          </View>
          {!!item?.ministerio && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: muted }]}>Ministério</Text>
              <Text style={[styles.infoVal, { color: text }]}>{item.ministerio}</Text>
            </View>
          )}
        </View>

        {/* Campos Editáveis (Padrão de Formulário) */}
        <View style={styles.formSection}>
          {/* Campo Valor */}
          <View style={[styles.field, { backgroundColor: surface }]}>
            <Text style={[styles.fieldLabel, { color: muted }]}>Valor (R$)</Text>
            <TextInput
              style={[styles.fieldInput, { color: text }]}
              value={confirmValorTxt}
              onChangeText={setConfirmValorTxt}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={muted}
              editable={!registrando}
            />
          </View>

          {/* Campo Data */}
          <TouchableOpacity
            style={[styles.field, { backgroundColor: surface }]}
            onPress={() => setShowDate(true)}
            disabled={registrando}
          >
            <Text style={[styles.fieldLabel, { color: muted }]}>Data do Registro</Text>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldValue, { color: text }]}>
                {dataPag.toLocaleDateString("pt-BR")}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={muted} />
            </View>
          </TouchableOpacity>

          {showDate && (
            <DateTimePicker
              value={dataPag}
              mode="date"
              display="default"
              onChange={(_, d) => {
                setShowDate(false);
                if (d) setDataPag(d);
              }}
            />
          )}

          {/* Campo Comprovante / Recibo */}
          <View style={[styles.field, { backgroundColor: surface }]}>
            <Text style={[styles.fieldLabel, { color: muted }]}>Comprovante / Recibo</Text>
            <View style={styles.reciboContainer}>
              {confirmReciboUri ? (
                <View style={styles.reciboPreviewRow}>
                  <Image source={{ uri: confirmReciboUri }} style={styles.reciboMini} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <TouchableOpacity onPress={escolherReciboGaleria} disabled={registrando}>
                      <Text style={[styles.reciboAcaoText, { color: principal }]}>Trocar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setConfirmReciboUri(null)} disabled={registrando}>
                      <Text style={[styles.reciboAcaoText, { color: danger }]}>Remover foto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBtn, { borderColor: muted }]}
                  onPress={escolherReciboGaleria}
                  disabled={registrando}
                >
                  <Ionicons name="camera-outline" size={20} color={principal} />
                  <Text style={[styles.uploadText, { color: text }]}>Adicionar foto do recibo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Botões de Ação */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnCancel, { backgroundColor: surface }]}
            onPress={() => navigation.goBack()}
            disabled={registrando}
          >
            <Text style={[styles.btnCancelText, { color: muted }]}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnOk, { backgroundColor: principal }, registrando && { opacity: 0.7 }]}
            onPress={confirmarRegistro}
            disabled={registrando}
          >
            <Text style={styles.btnOkText}>{registrando ? "Registrando..." : "Confirmar e Lançar"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontFamily: "Roboto-Bold", marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: "Roboto-Regular", lineHeight: 18, marginBottom: 16 },
  infoCard: { borderRadius: 16, padding: 14, marginBottom: 16 },
  descPrincipal: { fontSize: 16, fontFamily: "Roboto-Medium", marginBottom: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  infoLabel: { fontSize: 12, fontFamily: "Roboto-Regular" },
  infoVal: { fontSize: 13, fontFamily: "Roboto-Medium" },
  formSection: { gap: 12, marginBottom: 24 },
  field: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  fieldLabel: { fontSize: 11, fontFamily: "Roboto-Regular", marginBottom: 4 },
  fieldInput: { fontSize: 16, fontFamily: "Roboto-Bold", padding: 0 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldValue: { fontSize: 15, fontFamily: "Roboto-Medium" },
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
  actions: { flexDirection: "row", gap: 12 },
  btnCancel: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnCancelText: { fontSize: 15, fontFamily: "Roboto-Medium" },
  btnOk: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnOkText: { color: "#fff", fontSize: 15, fontFamily: "Roboto-Bold" },
});
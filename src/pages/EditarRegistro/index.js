import { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation, useRoute, useTheme } from "@react-navigation/native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConnection";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";
import { LIMITE_MS } from "../../utils/registroEdit";

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

export default function EditarRegistro() {
  const { id } = useRoute().params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { HistoricoMovimentos, ResumoFinanceiro, formatoMoeda } =
    useContext(AppContext);

  const [load, setLoad] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [item, setItem] = useState(null);
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    try {
      setLoad(true);
      const snap = await getDoc(doc(db, "registros", id));
      if (!snap.exists()) {
        Alert.alert("Erro", "Registro não encontrado.");
        navigation.goBack();
        return;
      }

      const data = { id: snap.id, ...snap.data() };
      const criado = data.createdAt || data.reg || 0;

      if (Date.now() - Number(criado) > LIMITE_MS) {
        Alert.alert(
          "Edição bloqueada",
          "Só é possível editar registros nas primeiras 24 horas."
        );
        navigation.goBack();
        return;
      }

      setItem(data);
      setDescricao(data.descricao || "");
      setObservacao(data.observacao || "");
      setValorTotal(String(data.valorTotal ?? "").replace(".", ","));
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar o registro.");
      navigation.goBack();
    } finally {
      setLoad(false);
    }
  }

  async function salvar() {
    if (!item) return;

    const criado = item.createdAt || item.reg || 0;
    if (Date.now() - Number(criado) > LIMITE_MS) {
      Alert.alert(
        "Edição bloqueada",
        "O prazo de 24 horas para edição encerrou."
      );
      return;
    }

    const novoTotal = parseNumero(valorTotal);
    if (!descricao.trim()) {
      Alert.alert("Atenção", "Informe a descrição.");
      return;
    }
    if (novoTotal <= 0) {
      Alert.alert("Atenção", "Informe um valor total válido.");
      return;
    }

    const pago =
      Number(item.valorPagoTotal || item.valorRecebidoTotal || 0) || 0;
    if (novoTotal < pago) {
      Alert.alert(
        "Atenção",
        `O total não pode ser menor que o já pago/recebido (R$ ${formatoMoeda.format(
          pago
        )}).`
      );
      return;
    }

    setSalvando(true);
    try {
      const status = novoTotal <= pago ? "quitada" : "aberta";

      await updateDoc(doc(db, "registros", item.id), {
        descricao: descricao.trim(),
        observacao: (observacao || "").trim(),
        valorTotal: novoTotal,
        status,
        atualizadoEm: Date.now(),
      });

      await Promise.all([HistoricoMovimentos(), ResumoFinanceiro?.()]);
      Alert.alert("Sucesso", "Registro atualizado.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (load) return <Load />;

  const horasRestantes = item
    ? Math.max(
        0,
        (Number(item.createdAt || item.reg) + LIMITE_MS - Date.now()) /
          3600000
      )
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Você pode editar por mais ~{horasRestantes.toFixed(1)} h
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Descrição"
          placeholderTextColor="#aaa"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Valor total</Text>
        <TextInput
          style={styles.input}
          value={valorTotal}
          onChangeText={setValorTotal}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor="#aaa"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Observação</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={observacao}
          onChangeText={setObservacao}
          multiline
          placeholder="Opcional"
          placeholderTextColor="#aaa"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.saveBtn,
          { backgroundColor: colors.principal },
          salvando && { opacity: 0.7 },
        ]}
        onPress={salvar}
        disabled={salvando}
      >
        <Text style={styles.saveText}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: "#fff3e0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#e65100",
  },
  field: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#1f2933",
    padding: 0,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
});
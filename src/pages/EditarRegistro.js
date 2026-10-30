import { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useNavigation, useRoute, useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
} from "firebase/firestore";
import { db } from "../firebaseConnection";
import { AppContext } from "../context/AppContext";
import Load from "../componentes/Load";
import { LIMITE_MS } from "../utils/registroEdit";

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

function tsParaDate(ts) {
  const n = Number(ts) || 0;
  const d = n ? new Date(n) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatarData(d) {
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function alinharDatasLista(lista, dataAntiga, dataNova) {
  if (!Array.isArray(lista) || lista.length === 0) return lista;

  if (lista.length === 1) {
    return [{ ...lista[0], data: dataNova }];
  }

  return lista.map((p) => {
    const ts = Number(p?.data || 0);
    if (!ts || ts === dataAntiga) return { ...p, data: dataNova };
    return p;
  });
}

function alinharParcelasPagas(parcelas, dataAntiga, dataNova) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return parcelas;

  const pagas = parcelas.filter(
    (p) => p?.status === "paga" || p?.status === "quitada" || p?.pago
  );

  return parcelas.map((p) => {
    const paga = p?.status === "paga" || p?.status === "quitada" || p?.pago;
    if (!paga) return p;

    const ts = Number(p.dataPagamento || p.pagoEm || 0);
    const unica = pagas.length === 1;
    if (unica || !ts || ts === dataAntiga) {
      return { ...p, dataPagamento: dataNova, pagoEm: dataNova };
    }
    return p;
  });
}

function montarDevolucoesCaixinha(item) {
  const map = new Map();

  const add = (cxId, valor) => {
    if (!cxId || !(valor > 0)) return;
    map.set(cxId, arred((map.get(cxId) || 0) + valor));
  };

  const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
  pagos.forEach((p) => {
    if (p?.origemPagamento === "caixinha" && p.caixinhaId) {
      add(p.caixinhaId, Number(p.valor) || 0);
    }
  });

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  parcelas.forEach((p) => {
    if (
      p?.status === "paga" &&
      p?.origemPagamento === "caixinha" &&
      p.caixinhaId
    ) {
      const jaNoPagos = pagos.some(
        (vp) =>
          vp.parcelaNumero === p.numero &&
          vp.origemPagamento === "caixinha" &&
          vp.caixinhaId === p.caixinhaId
      );
      if (!jaNoPagos) {
        add(p.caixinhaId, Number(p.valor) || 0);
      }
    }
  });

  if (
    item.tipoMovimento === "saida" &&
    item.origemPagamento === "caixinha" &&
    item.caixinhaId &&
    pagos.length === 0
  ) {
    add(
      item.caixinhaId,
      Number(item.valorPagoTotal) || Number(item.valorTotal) || 0
    );
  }

  return map;
}

export default function EditarRegistro() {
  const { id } = useRoute().params || {};
  const navigation = useNavigation();
  const { colors, dark } = useTheme();
  const {
    HistoricoMovimentos,
    ResumoFinanceiro,
    formatoMoeda,
    getIgrejaId,
    igrejaAtiva,
    podeEditarFinanceiro,
    CarregarCaixinhas,
    DepositarNaCaixinha,
  } = useContext(AppContext);

  const [load, setLoad] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [item, setItem] = useState(null);
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [data, setData] = useState(new Date());
  const [showDate, setShowDate] = useState(false);

  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;
  const podeEditar = podeEditarFinanceiro?.() !== false;

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#9aa0a6");
  const card = colors.card;
  const bg = colors.background;
  const placeholder = muted;
  const deleteBorder = dark ? "#5c2b2b" : "#ffcdd2";
  const deleteTextColor = dark ? "#E57373" : "#C62828";
  const deleteBg = dark ? "#2a1a1a" : card;

  useEffect(() => {
    carregar();
  }, [id, igrejaId]);

  async function carregar() {
    try {
      setLoad(true);

      if (!podeEditar) {
        Alert.alert(
          "Somente leitura",
          "Seu perfil não permite editar registros."
        );
        navigation.goBack();
        return;
      }

      if (!id) {
        Alert.alert("Erro", "Registro inválido.");
        navigation.goBack();
        return;
      }

      const snap = await getDoc(doc(db, "registros", id));
      if (!snap.exists()) {
        Alert.alert("Erro", "Registro não encontrado.");
        navigation.goBack();
        return;
      }

      const dataDoc = { id: snap.id, ...snap.data() };

      if (igrejaId && dataDoc.igrejaId && dataDoc.igrejaId !== igrejaId) {
        Alert.alert(
          "Acesso negado",
          "Este registro não pertence à igreja selecionada."
        );
        navigation.goBack();
        return;
      }

      const criado = dataDoc.createdAt || dataDoc.reg || 0;
      if (Date.now() - Number(criado) > LIMITE_MS) {
        Alert.alert(
          "Edição bloqueada",
          "Só é possível editar registros nas primeiras 24 horas."
        );
        navigation.goBack();
        return;
      }

      setItem(dataDoc);
      setDescricao(dataDoc.descricao || "");
      setObservacao(dataDoc.observacao || "");
      setValorTotal(String(dataDoc.valorTotal ?? "").replace(".", ","));
      setData(tsParaDate(dataDoc.data || dataDoc.createdAt || dataDoc.reg));
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar o registro.");
      navigation.goBack();
    } finally {
      setLoad(false);
    }
  }

  function onChangeData(event, selected) {
    if (Platform.OS === "android") setShowDate(false);
    if (event?.type === "dismissed") return;
    if (selected) setData(selected);
  }

  async function salvar() {
    if (!item) return;

    if (!podeEditar) {
      Alert.alert(
        "Somente leitura",
        "Seu perfil não permite editar registros."
      );
      return;
    }

    if (igrejaId && item.igrejaId && item.igrejaId !== igrejaId) {
      Alert.alert(
        "Acesso negado",
        "Este registro não pertence à igreja selecionada."
      );
      return;
    }

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
    if (!data || Number.isNaN(data.getTime())) {
      Alert.alert("Atenção", "Informe uma data válida.");
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
      const dataAntiga = Number(item.data || 0);
      const dataNova = data.getTime();

      const patch = {
        descricao: descricao.trim(),
        observacao: (observacao || "").trim(),
        valorTotal: novoTotal,
        data: dataNova,
        status,
        atualizadoEm: Date.now(),
      };

      if (Array.isArray(item.valoresPagos) && item.valoresPagos.length) {
        patch.valoresPagos = alinharDatasLista(
          item.valoresPagos,
          dataAntiga,
          dataNova
        );
      }

      if (
        Array.isArray(item.valoresRecebidos) &&
        item.valoresRecebidos.length
      ) {
        patch.valoresRecebidos = alinharDatasLista(
          item.valoresRecebidos,
          dataAntiga,
          dataNova
        );
      }

      if (Array.isArray(item.parcelas) && item.parcelas.length) {
        patch.parcelas = alinharParcelasPagas(
          item.parcelas,
          dataAntiga,
          dataNova
        );
      }

      await updateDoc(doc(db, "registros", item.id), patch);
      await Promise.all([HistoricoMovimentos(), ResumoFinanceiro?.()]);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExcluir() {
    if (!item || !podeEditar) return;

    const criado = item.createdAt || item.reg || 0;
    if (Date.now() - Number(criado) > LIMITE_MS) {
      Alert.alert(
        "Exclusão bloqueada",
        "Só é possível excluir registros nas primeiras 24 horas."
      );
      return;
    }

    const devolucoes = montarDevolucoesCaixinha(item);
    let extra = "";
    if (devolucoes.size > 0) {
      const totalDev = [...devolucoes.values()].reduce((a, b) => a + b, 0);
      extra = `\n\nValores pagos com caixinha (R$ ${formatoMoeda.format(
        totalDev
      )}) serão devolvidos às caixinhas.`;
    }

    Alert.alert(
      "Excluir registro",
      `Tem certeza? O lançamento será removido e o saldo será recalculado.${extra}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: excluir,
        },
      ]
    );
  }

  async function devolverParaCaixinhas(itemAtual) {
    const devolucoes = montarDevolucoesCaixinha(itemAtual);
    if (devolucoes.size === 0) return;

    for (const [caixinhaId, valor] of devolucoes.entries()) {
      if (typeof DepositarNaCaixinha === "function") {
        await DepositarNaCaixinha(caixinhaId, valor);
      } else {
        const ref = doc(db, "caixinhas", caixinhaId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const atual = Number(snap.data().valor) || 0;
        await updateDoc(ref, {
          valor: arred(atual + valor),
          atualizadoEm: Date.now(),
        });
      }
    }
  }

  async function excluir() {
    if (!item) return;

    setExcluindo(true);
    try {
      await devolverParaCaixinhas(item);

      try {
        const { id: _id, ...resto } = item;
        await addDoc(collection(db, "lixeira"), {
          ...resto,
          registroIdOriginal: item.id,
          dataexclusao: Date.now(),
          igrejaId: item.igrejaId || igrejaId || null,
          idUsuario: item.idUsuario || null,
        });
      } catch (eLixo) {
        console.log("Aviso lixeira:", eLixo);
      }

      await deleteDoc(doc(db, "registros", item.id));

      await Promise.all([
        HistoricoMovimentos(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);

      Alert.alert("Excluído", "Registro removido e saldo atualizado.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  if (load) return <Load />;

  const ocupado = salvando || excluindo;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={[styles.field, { backgroundColor: card }]}
        onPress={() => !ocupado && setShowDate(true)}
        activeOpacity={0.8}
        disabled={ocupado}
      >
        <Text style={[styles.label, { color: muted }]}>Data</Text>
        <Text style={[styles.input, { color: text }]}>{formatarData(data)}</Text>
      </TouchableOpacity>

      {showDate && (
        <DateTimePicker
          value={data}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeData}
          // Android dark: tema do sistema; iOS spinner acompanha o SO
        />
      )}

      {Platform.OS === "ios" && showDate ? (
        <TouchableOpacity
          style={styles.dateOk}
          onPress={() => setShowDate(false)}
        >
          <Text style={[styles.dateOkText, { color: principal }]}>
            Confirmar data
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.field, { backgroundColor: card }]}>
        <Text style={[styles.label, { color: muted }]}>Descrição</Text>
        <TextInput
          style={[styles.input, { color: text }]}
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Descrição"
          placeholderTextColor={placeholder}
          editable={!ocupado}
        />
      </View>

      <View style={[styles.field, { backgroundColor: card }]}>
        <Text style={[styles.label, { color: muted }]}>Valor total</Text>
        <TextInput
          style={[styles.input, { color: text }]}
          value={valorTotal}
          onChangeText={setValorTotal}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={placeholder}
          editable={!ocupado}
        />
      </View>

      <View style={[styles.field, { backgroundColor: card }]}>
        <Text style={[styles.label, { color: muted }]}>Observação</Text>
        <TextInput
          style={[
            styles.input,
            { color: text, minHeight: 80, textAlignVertical: "top" },
          ]}
          value={observacao}
          onChangeText={setObservacao}
          multiline
          placeholder="Opcional"
          placeholderTextColor={placeholder}
          editable={!ocupado}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.saveBtn,
          { backgroundColor: principal },
          ocupado && { opacity: 0.7 },
        ]}
        onPress={salvar}
        disabled={ocupado}
      >
        <Text style={styles.saveText}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.deleteBtn,
          {
            backgroundColor: deleteBg,
            borderColor: deleteBorder,
          },
          ocupado && { opacity: 0.7 },
        ]}
        onPress={confirmarExcluir}
        disabled={ocupado}
      >
        <Text style={[styles.deleteText, { color: deleteTextColor }]}>
          {excluindo ? "Excluindo..." : "Excluir registro"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
  },
  content: {
    paddingVertical: 14,
  },
  field: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    padding: 0,
  },
  dateOk: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  dateOkText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
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
  deleteBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderWidth: 1,
  },
  deleteText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
});
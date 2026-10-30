import { useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConnection";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

const MS_30_DIAS = 30 * 24 * 60 * 60 * 1000;

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

function formatarData(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR");
}

function diasRestantes(previstaEm) {
  if (!previstaEm) return 0;
  const diff = previstaEm - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export default function Configuracoes() {
  const { colors, dark } = useTheme();
  const { uid } = useAuth();
  const {
    igrejaAtiva,
    atualizarNomeIgreja,
    criarIgreja,
    getIgrejaId,
    HistoricoMovimentos,
    ResumoFinanceiro,
    carregarIgrejasDoUsuario,
    ocultarNomesDoadores,
    setOcultarNomesDoadores,
  } = useContext(AppContext);

  const [nome, setNome] = useState("");
  const [saldoInicialId, setSaldoInicialId] = useState(null);
  const [valorSaldo, setValorSaldo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  const nomeSalvoRef = useRef("");
  const saldoSalvoRef = useRef(null);
  const saldoIdRef = useRef(null);
  const nomeAtualRef = useRef("");
  const valorAtualRef = useRef("");
  const salvandoRef = useRef(false);

  const semIgreja = !igrejaAtiva?.id;
  const isAdmin = igrejaAtiva?.papel === "admin";
  const podeFinanceiro =
    igrejaAtiva?.papel === "admin" || igrejaAtiva?.papel === "tesoureiro";
  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;

  const exclusaoPrevistaEm = Number(igrejaAtiva?.exclusaoPrevistaEm) || 0;
  const exclusaoAgendada = exclusaoPrevistaEm > 0;
  const dias = diasRestantes(exclusaoPrevistaEm);

  const principal = colors.principal || colors.primary || "#65C556";
  const placeholder = colors.muted || (dark ? "#666" : "#bbb");
  const muted = colors.muted || placeholder;

  useEffect(() => {
    nomeAtualRef.current = nome;
  }, [nome]);

  useEffect(() => {
    valorAtualRef.current = valorSaldo;
  }, [valorSaldo]);

  useEffect(() => {
    saldoIdRef.current = saldoInicialId;
  }, [saldoInicialId]);

  useEffect(() => {
    carregar();
  }, [igrejaId, igrejaAtiva?.nome, igrejaAtiva?.exclusaoPrevistaEm]);

  async function carregar() {
    setCarregando(true);
    try {
      const n = igrejaAtiva?.nome || "";
      setNome(n);
      nomeSalvoRef.current = n;
      nomeAtualRef.current = n;

      if (!igrejaId) {
        setSaldoInicialId(null);
        setValorSaldo("");
        saldoSalvoRef.current = null;
        saldoIdRef.current = null;
        valorAtualRef.current = "";
        return;
      }

      const q = query(
        collection(db, "registros"),
        where("igrejaId", "==", igrejaId),
        where("tipo", "==", "Saldo inicial")
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setSaldoInicialId(null);
        setValorSaldo("");
        saldoSalvoRef.current = null;
        saldoIdRef.current = null;
        valorAtualRef.current = "";
      } else {
        const d = snap.docs[0];
        const data = d.data();
        const valor =
          Number(data.valorRecebidoTotal) || Number(data.valorTotal) || 0;
        const txt = String(valor).replace(".", ",");
        setSaldoInicialId(d.id);
        setValorSaldo(txt);
        saldoSalvoRef.current = arred(valor);
        saldoIdRef.current = d.id;
        valorAtualRef.current = txt;
      }
    } catch (e) {
      console.log("Erro carregar Configurações:", e);
    } finally {
      setCarregando(false);
    }
  }

  async function handleCriarIgreja() {
    const limpo = String(nome || "").trim();
    if (!limpo) {
      Alert.alert("Atenção", "Informe o nome da igreja.");
      return;
    }
    if (!criarIgreja) {
      Alert.alert("Erro", "Função de criar igreja indisponível.");
      return;
    }
    if (criando) return;

    try {
      setCriando(true);
      await criarIgreja(limpo);
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível criar a igreja.");
    } finally {
      setCriando(false);
    }
  }

  async function persistirNome(nomeNovo) {
    if (semIgreja || !isAdmin) return;
    const limpo = String(nomeNovo || "").trim();
    if (!limpo) return;
    if (limpo === nomeSalvoRef.current) return;
    if (salvandoRef.current) return;

    try {
      salvandoRef.current = true;
      await atualizarNomeIgreja(limpo);
      nomeSalvoRef.current = limpo;
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar o nome.");
    } finally {
      salvandoRef.current = false;
    }
  }

  async function persistirSaldo(textoValor) {
    if (semIgreja || !podeFinanceiro || !uid || !igrejaId) return;

    const valor = arred(parseNumero(textoValor));
    if (valor < 0) return;

    if (!String(textoValor || "").trim() && saldoSalvoRef.current == null) {
      return;
    }

    if (
      saldoSalvoRef.current != null &&
      Math.abs(valor - saldoSalvoRef.current) < 0.001
    ) {
      return;
    }

    if (salvandoRef.current) return;

    try {
      salvandoRef.current = true;
      const idAtual = saldoIdRef.current;

      if (idAtual) {
        await updateDoc(doc(db, "registros", idAtual), {
          valorTotal: valor,
          valorRecebidoTotal: valor,
          valoresRecebidos: [
            { valor, data: Date.now(), id: Date.now().toString() },
          ],
          status: "quitada",
          updatedAt: Date.now(),
        });
      } else {
        const agora = Date.now();
        const ref = await addDoc(collection(db, "registros"), {
          igrejaId,
          idUsuario: uid,
          tipoMovimento: "entrada",
          tipo: "Saldo inicial",
          data: agora,
          descricao: "Saldo inicial",
          valorTotal: valor,
          valoresRecebidos: [{ valor, data: agora, id: String(agora) }],
          valorRecebidoTotal: valor,
          observacao: "",
          status: "quitada",
          reg: agora,
          createdAt: agora,
        });
        setSaldoInicialId(ref.id);
        saldoIdRef.current = ref.id;
      }

      saldoSalvoRef.current = valor;
      await Promise.all([HistoricoMovimentos(), ResumoFinanceiro?.()]);
    } catch (e) {
      Alert.alert(
        "Erro",
        e?.message || "Não foi possível salvar o saldo inicial."
      );
    } finally {
      salvandoRef.current = false;
    }
  }

  function pedirAgendarExclusao() {
    if (!isAdmin || !igrejaId || processandoExclusao) return;

    const nomeIg = igrejaAtiva?.nome || "esta igreja";
    const prevista = formatarData(Date.now() + MS_30_DIAS);

    Alert.alert(
      "Agendar exclusão",
      `A igreja "${nomeIg}" será excluída permanentemente em 30 dias (${prevista}).\n\nAté lá você pode cancelar a exclusão. Depois dessa data, registros, caixinhas e membros serão apagados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Agendar exclusão",
          style: "destructive",
          onPress: agendarExclusao,
        },
      ]
    );
  }

  async function agendarExclusao() {
    if (!igrejaId) return;

    try {
      setProcessandoExclusao(true);
      const agora = Date.now();
      await updateDoc(doc(db, "igrejas", igrejaId), {
        exclusaoAgendadaEm: agora,
        exclusaoPrevistaEm: agora + MS_30_DIAS,
        exclusaoSolicitadaPor: uid || null,
        updatedAt: agora,
      });

      if (typeof carregarIgrejasDoUsuario === "function") {
        await carregarIgrejasDoUsuario();
      }

      Alert.alert(
        "Exclusão agendada",
        `A igreja será excluída em ${formatarData(
          agora + MS_30_DIAS
        )}. Você pode cancelar antes disso nesta tela.`
      );
    } catch (e) {
      console.log("Erro agendar exclusão:", e);
      Alert.alert(
        "Erro",
        e?.message || "Não foi possível agendar a exclusão."
      );
    } finally {
      setProcessandoExclusao(false);
    }
  }

  function pedirCancelarExclusao() {
    if (!isAdmin || !igrejaId || processandoExclusao) return;

    Alert.alert(
      "Cancelar exclusão",
      "A igreja deixará de estar marcada para exclusão e continuará ativa normalmente.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Manter igreja",
          onPress: cancelarExclusao,
        },
      ]
    );
  }

  async function cancelarExclusao() {
    if (!igrejaId) return;

    try {
      setProcessandoExclusao(true);
      await updateDoc(doc(db, "igrejas", igrejaId), {
        exclusaoAgendadaEm: null,
        exclusaoPrevistaEm: null,
        exclusaoSolicitadaPor: null,
        updatedAt: Date.now(),
      });

      if (typeof carregarIgrejasDoUsuario === "function") {
        await carregarIgrejasDoUsuario();
      }

      Alert.alert("Exclusão cancelada", "A igreja permanece ativa.");
    } catch (e) {
      console.log("Erro cancelar exclusão:", e);
      Alert.alert(
        "Erro",
        e?.message || "Não foi possível cancelar a exclusão."
      );
    } finally {
      setProcessandoExclusao(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!semIgreja) {
          persistirNome(nomeAtualRef.current);
          persistirSaldo(valorAtualRef.current);
        }
      };
    }, [semIgreja, isAdmin, podeFinanceiro, uid, igrejaId])
  );

  if (carregando) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={principal} />
      </View>
    );
  }

  if (semIgreja) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Nome da igreja
            </Text>
            <TextInput
              style={[styles.rowInput, { color: colors.text }]}
              value={nome}
              maxLength={25}
              onChangeText={setNome}
              placeholder="Ex.: Igreja Central"
              placeholderTextColor={placeholder}
              autoCapitalize="words"
              textAlign="right"
              returnKeyType="done"
              onSubmitEditing={handleCriarIgreja}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: principal },
            criando && { opacity: 0.7 },
          ]}
          onPress={handleCriarIgreja}
          disabled={criando}
          activeOpacity={0.85}
        >
          {criando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Criar igreja</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {exclusaoAgendada && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: dark ? "#3e2723" : "#FFF3E0",
            },
          ]}
        >
          <Text
            style={[
              styles.warningTitle,
              { color: dark ? "#FFB74D" : "#E65100" },
            ]}
          >
            Exclusão agendada
          </Text>
          <Text
            style={[
              styles.warningText,
              { color: dark ? "#FFCCBC" : "#BF360C" },
            ]}
          >
            Esta igreja será excluída em{" "}
            {dias > 0 ? `${dias} dia(s)` : "breve"} (
            {formatarData(exclusaoPrevistaEm)}). Até lá você pode cancelar.
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Nome da igreja
          </Text>
          <TextInput
            style={[
              styles.rowInput,
              { color: colors.text },
              !isAdmin && styles.inputDisabled,
            ]}
            value={nome}
            maxLength={25}
            onChangeText={setNome}
            placeholder="—"
            placeholderTextColor={placeholder}
            editable={isAdmin && !exclusaoAgendada}
            autoCapitalize="words"
            textAlign="right"
            onBlur={() => persistirNome(nome)}
            returnKeyType="done"
            onSubmitEditing={() => persistirNome(nome)}
          />
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Saldo inicial
          </Text>
          <View style={styles.valorWrap}>
            <Text style={[styles.prefixo, { color: muted }]}>R$</Text>
            <TextInput
              style={[
                styles.rowInput,
                { color: colors.text },
                (!podeFinanceiro || exclusaoAgendada) && styles.inputDisabled,
              ]}
              value={valorSaldo}
              onChangeText={setValorSaldo}
              placeholder="0,00"
              placeholderTextColor={placeholder}
              keyboardType="decimal-pad"
              editable={podeFinanceiro && !exclusaoAgendada}
              textAlign="right"
              onBlur={() => persistirSaldo(valorSaldo)}
              returnKeyType="done"
              onSubmitEditing={() => persistirSaldo(valorSaldo)}
            />
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.rowSwitch}>
          <View style={styles.switchTextWrap}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Ocultar nomes no relatório
            </Text>
            <Text style={[styles.switchHint, { color: muted }]}>
              Dízimos e ofertas como Diz. *** / Oferta ***
            </Text>
          </View>
          <Switch
            value={!!ocultarNomesDoadores}
            onValueChange={(v) => setOcultarNomesDoadores?.(v)}
            trackColor={{
              false: dark ? "#555" : "#ccc",
              true: principal + "99",
            }}
            thumbColor={ocultarNomesDoadores ? principal : "#f4f3f4"}
          />
        </View>
      </View>

      <Text style={[styles.hint, { color: muted }]}>
        As alterações são salvas ao sair do campo ou da página.
      </Text>

      {isAdmin && (
        <View style={styles.dangerZone}>
          {exclusaoAgendada ? (
            <>
              <TouchableOpacity
                style={[
                  styles.cancelDeleteBtn,
                  {
                    borderColor: principal,
                    backgroundColor: colors.card,
                  },
                  processandoExclusao && { opacity: 0.6 },
                ]}
                onPress={pedirCancelarExclusao}
                disabled={processandoExclusao}
                activeOpacity={0.85}
              >
                {processandoExclusao ? (
                  <ActivityIndicator color={principal} />
                ) : (
                  <Text style={[styles.cancelDeleteBtnText, { color: principal }]}>
                    Cancelar exclusão
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.deleteHint, { color: muted }]}>
                A exclusão definitiva está marcada para{" "}
                {formatarData(exclusaoPrevistaEm)}.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: dark ? "#5d1f1f" : "#ffcdd2",
                  },
                  processandoExclusao && { opacity: 0.6 },
                ]}
                onPress={pedirAgendarExclusao}
                disabled={processandoExclusao}
                activeOpacity={0.85}
              >
                {processandoExclusao ? (
                  <ActivityIndicator color={colors.negativo || "#C62828"} />
                ) : (
                  <Text
                    style={[
                      styles.deleteBtnText,
                      { color: colors.negativo || "#C62828" },
                    ]}
                  >
                    Excluir igreja em 30 dias
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.deleteHint, { color: muted }]}>
                Os dados não são apagados agora. Após 30 dias da confirmação,
                igreja, registros, caixinhas e membros serão removidos
                automaticamente.
              </Text>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
  },
  content: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  warningBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  warningTitle: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 10,
    gap: 12,
  },
  rowSwitch: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 12,
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  switchHint: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    lineHeight: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Light",
    flexShrink: 0,
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 80,
  },
  valorWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  prefixo: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
  inputDisabled: {
    opacity: 0.55,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  createBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  hint: {
    marginTop: 12,
    paddingHorizontal: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    lineHeight: 18,
  },
  dangerZone: {
    marginTop: 32,
    paddingTop: 8,
  },
  deleteBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  cancelDeleteBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  cancelDeleteBtnText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  deleteHint: {
    marginTop: 10,
    paddingHorizontal: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    lineHeight: 18,
  },
});
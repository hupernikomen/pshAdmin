import { useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
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

export default function Configuracoes() {
  const { colors } = useTheme();
  const { uid } = useAuth();
  const {
    igrejaAtiva,
    atualizarNomeIgreja,
    getIgrejaId,
    HistoricoMovimentos,
    ResumoFinanceiro,
  } = useContext(AppContext);

  const [nome, setNome] = useState("");
  const [saldoInicialId, setSaldoInicialId] = useState(null);
  const [valorSaldo, setValorSaldo] = useState("");
  const [carregando, setCarregando] = useState(true);

  // valores “oficiais” já gravados (para comparar e só salvar se mudou)
  const nomeSalvoRef = useRef("");
  const saldoSalvoRef = useRef(null); // number | null
  const saldoIdRef = useRef(null);
  const nomeAtualRef = useRef("");
  const valorAtualRef = useRef("");
  const salvandoRef = useRef(false);

  const isAdmin = igrejaAtiva?.papel === "admin";
  const podeFinanceiro =
    igrejaAtiva?.papel === "admin" || igrejaAtiva?.papel === "tesoureiro";
  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;

  // mantém refs sincronizadas com o estado (para o cleanup ao sair)
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
  }, [igrejaId, igrejaAtiva?.nome]);

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

  async function persistirNome(nomeNovo) {
    if (!isAdmin) return;
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
    if (!podeFinanceiro || !uid || !igrejaId) return;

    const valor = arred(parseNumero(textoValor));
    if (valor < 0) return;

    // se campo vazio e nunca teve saldo, não grava
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

  // ao sair da tela, grava o que estiver diferente
  useFocusEffect(
    useCallback(() => {
      return () => {
        persistirNome(nomeAtualRef.current);
        persistirSaldo(valorAtualRef.current);
      };
    }, [isAdmin, podeFinanceiro, uid, igrejaId])
  );

  if (carregando) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.principal || "#65C556"} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {/* Nome */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Nome da igreja</Text>
          <TextInput
            style={[styles.rowInput, !isAdmin && styles.inputDisabled]}
            value={nome}
            maxLength={25}
            onChangeText={setNome}
            placeholder="—"
            placeholderTextColor="#bbb"
            editable={isAdmin}
            autoCapitalize="words"
            textAlign="right"
            onBlur={() => persistirNome(nome)}
            returnKeyType="done"
            onSubmitEditing={() => persistirNome(nome)}
          />
        </View>

        <View style={styles.separator} />

        {/* Saldo inicial */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Saldo inicial</Text>
          <View style={styles.valorWrap}>
            <Text style={styles.prefixo}>R$</Text>
            <TextInput
              style={[styles.rowInput, !podeFinanceiro && styles.inputDisabled]}
              value={valorSaldo}
              onChangeText={setValorSaldo}
              placeholder="0,00"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
              editable={podeFinanceiro}
              textAlign="right"
              onBlur={() => persistirSaldo(valorSaldo)}
              returnKeyType="done"
              onSubmitEditing={() => persistirSaldo(valorSaldo)}
            />
          </View>
        </View>
      </View>

      <Text style={styles.hint}>
        As alterações são salvas ao sair do campo ou da página.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal:14
  },
  content: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f5f7",
  },
  card: {
    backgroundColor: "#fff",
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
  rowLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Light",
    flexShrink: 0,
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
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
    color: "#9aa0a6",
  },
  inputDisabled: {
    opacity: 0.55,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ececec",
  },
  hint: {
    marginTop: 12,
    paddingHorizontal: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#9aa0a6",
    lineHeight: 18,
  },
});
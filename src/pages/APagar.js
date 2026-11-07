import { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { db } from "../firebaseConnection";
import {
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDoc,
} from "firebase/firestore";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import { arred, tsDoDia } from "../utils/financeiro";

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
      const ja = pagos.some(
        (vp) =>
          vp.parcelaNumero === p.numero &&
          vp.origemPagamento === "caixinha" &&
          vp.caixinhaId === p.caixinhaId
      );
      if (!ja) add(p.caixinhaId, Number(p.valor) || 0);
    }
  });

  return map;
}

/** Primeira parcela ainda aberta deste registro. */
function proximaParcelaAberta(item) {
  const parcelas = Array.isArray(item?.parcelas) ? item.parcelas : [];
  const abertas = parcelas
    .filter((p) => p.status === "aberta" || !p.status)
    .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
  return abertas[0] || null;
}

/** Só a próxima da fila pode receber baixa. */
function podeBaixarParcela(item) {
  if (!item?.isParcela) return true;
  const proxima = proximaParcelaAberta(item);
  if (!proxima) return true;
  return Number(proxima.numero) === Number(item.parcelaNumero);
}

/** Verifica se o registro já teve alguma prestação/pagamento efetuado. */
function temPrestacaoPaga(item) {
  const pagoTotal = Number(item.valorPagoTotal) || 0;
  if (pagoTotal > 0) return true;

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  return parcelas.some((p) => p.status === "paga" || p.status === "quitada" || !!p.pagoEm);
}

export default function APagar() {
  const {
    dadosFinancas,
    load,
    setLoad,
    financasProntas,
    HistoricoMovimentos,
    formatoMoeda,
    caixinhas,
    saldoDisponivel,
    RetirarDaCaixinha,
    DepositarNaCaixinha,
    CarregarCaixinhas,
    ResumoFinanceiro,
    podeEditarFinanceiro,
    igrejaAtiva,
    getIgrejaId,
  } = useContext(AppContext);

  const { showAlert } = useAppAlert();
  const { colors, dark } = useTheme();
  const { uid, authPronto } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [abertoId, setAbertoId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSel, setItemSel] = useState(null);
  const [valorPago, setValorPago] = useState("");
  const [origemPagamento, setOrigemPagamento] = useState("geral");
  const [caixinhaId, setCaixinhaId] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = podeEditarFinanceiro?.() !== false;
  const igrejaId = getIgrejaId?.() || igrejaAtiva?.id || null;

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const surface = dark ? "#2a2a2a" : "#f4f5f7";
  const border = colors.border || (dark ? "#333" : "#ececec");
  const danger = dark ? "#E57373" : "#C62828";
  const tintDanger = dark ? "#3D1F1F" : "#FFEBEE";

  const onRefresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setRefreshing(false);
  };

  const pendentes = useMemo(() => {
    const lista = [];

    (dadosFinancas || []).forEach((i) => {
      if (i.tipoMovimento !== "saida") return;
      if (i.status === "quitada") return;

      const parcelas = Array.isArray(i.parcelas) ? i.parcelas : [];

      if (parcelas.length > 0) {
        parcelas.forEach((p) => {
          if (p.status !== "aberta") return;
          lista.push({
            ...i,
            isParcela: true,
            rowId: `${i.id}_p${p.numero}`,
            parcelaNumero: p.numero,
            parcelaTotal: i.quantidadeParcelas || parcelas.length,
            falta: arred(p.valor),
            vencimento: p.vencimento,
            parcelaRef: p,
          });
        });
        return;
      }

      const total = Number(i.valorTotal) || 0;
      const pago = Number(i.valorPagoTotal) || 0;
      if (total > pago) {
        lista.push({
          ...i,
          isParcela: false,
          rowId: i.id,
          falta: arred(total - pago),
        });
      }
    });

    return lista.sort((a, b) => {
      const da = a.vencimento || a.data || 0;
      const db_ = b.vencimento || b.data || 0;
      return da - db_;
    });
  }, [dadosFinancas]);

  function avisarForaDeOrdem(item) {
    const proxima = proximaParcelaAberta(item);
    const n = proxima?.numero || 1;
    const total = item.parcelaTotal || item.quantidadeParcelas || "?";
    showAlert({
      title: "Fora de ordem",
      message: `Quite primeiro a parcela ${n}/${total}. A ${item.parcelaNumero}/${total} só pode ser paga depois.`,
    });
  }

  function abrirPagar(item) {
    if (!podeEditar) {
      showAlert({
        title: "Somente leitura",
        message: "Seu perfil não permite registrar pagamentos.",
      });
      return;
    }
    if (!podeBaixarParcela(item)) {
      avisarForaDeOrdem(item);
      return;
    }
    setItemSel(item);
    setValorPago(String(item.falta).replace(".", ","));
    setOrigemPagamento("geral");
    setCaixinhaId(null);
    setDataPagamento(new Date());
    setShowDatePicker(false);
    setModalVisible(true);
    setAbertoId(null);
  }

  function fecharModal() {
    setModalVisible(false);
    setItemSel(null);
    setValorPago("");
    setCaixinhaId(null);
    setShowDatePicker(false);
  }

  function onChangeData(event, selected) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event?.type === "dismissed") return;
    if (selected) setDataPagamento(selected);
  }

  function pedirExcluir(item) {
    if (!podeEditar) {
      showAlert({
        title: "Somente leitura",
        message: "Seu perfil não permite excluir.",
      });
      return;
    }

    // Segurança extra: impede exclusão se houver prestação paga
    if (temPrestacaoPaga(item)) {
      showAlert({
        title: "Ação não permitida",
        message: "Este registro possui prestações pagas e não pode mais ser excluído.",
      });
      return;
    }

    const pago = Number(item.valorPagoTotal) || 0;
    const extra =
      pago > 0
        ? `\n\nJá existem R$ ${formatoMoeda.format(
          pago
        )} pagos neste registro. Valores de caixinha serão devolvidos e o lançamento inteiro será removido.`
        : item.isParcela
          ? "\n\nTodo o registro (incluindo outras parcelas) será removido."
          : "";

    showAlert({
      title: "Excluir registro",
      message: `Remover "${item.descricao || "este lançamento"}"?${extra}`,
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => excluirRegistro(item),
        },
      ],
    });
    setAbertoId(null);
  }

  async function devolverParaCaixinhas(item) {
    const devolucoes = montarDevolucoesCaixinha(item);
    if (devolucoes.size === 0) return;

    for (const [cxId, valor] of devolucoes.entries()) {
      if (typeof DepositarNaCaixinha === "function") {
        await DepositarNaCaixinha(cxId, valor);
      } else {
        const ref = doc(db, "caixinhas", cxId);
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

  async function excluirRegistro(item) {
    if (!item?.id) return;
    try {
      setLoad(true);
      await devolverParaCaixinhas(item);

      try {
        const { id: _id, isParcela, rowId, parcelaRef, falta, ...resto } =
          item;
        await addDoc(collection(db, "lixeira"), {
          ...resto,
          registroIdOriginal: item.id,
          dataexclusao: Date.now(),
          igrejaId: item.igrejaId || igrejaId || null,
          idUsuario: item.idUsuario || uid || null,
        });
      } catch (e) {
        console.log("Aviso lixeira:", e);
      }

      await deleteDoc(doc(db, "registros", item.id));
      await Promise.all([
        HistoricoMovimentos(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);
      showAlert({ title: "Excluído", message: "Registro removido." });
    } catch (e) {
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível excluir.",
      });
    } finally {
      setLoad(false);
    }
  }

  async function confirmarPagamento() {
    if (!uid) {
      showAlert({ title: "Atenção", message: "Faça login novamente." });
      return;
    }
    if (!podeEditar) {
      showAlert({
        title: "Somente leitura",
        message: "Sem permissão para pagar.",
      });
      return;
    }
    if (!itemSel) return;
    if (!podeBaixarParcela(itemSel)) {
      avisarForaDeOrdem(itemSel);
      fecharModal();
      return;
    }

    const valor = itemSel.isParcela
      ? arred(itemSel.falta)
      : parseNumero(valorPago);

    if (valor <= 0) {
      showAlert({ title: "Atenção", message: "Informe um valor válido." });
      return;
    }
    if (!itemSel.isParcela && valor > itemSel.falta + 0.001) {
      showAlert({
        title: "Atenção",
        message: `Máximo: R$ ${formatoMoeda.format(itemSel.falta)}`,
      });
      return;
    }

    if (origemPagamento === "geral") {
      if (valor > (Number(saldoDisponivel) || 0) + 0.001) {
        showAlert({
          title: "Saldo insuficiente",
          message: `Caixa livre: R$ ${formatoMoeda.format(
            saldoDisponivel || 0
          )}`,
        });
        return;
      }
    } else {
      if (!caixinhaId) {
        showAlert({ title: "Atenção", message: "Selecione a caixinha." });
        return;
      }
      const cx = (caixinhas || []).find((c) => c.id === caixinhaId);
      if (!cx || valor > (Number(cx.valor) || 0) + 0.001) {
        showAlert({
          title: "Saldo insuficiente",
          message: "Saldo insuficiente na caixinha.",
        });
        return;
      }
    }

    const cxSel = (caixinhas || []).find((c) => c.id === caixinhaId);
    const dataPagTs = tsDoDia(dataPagamento);
    const idPag = `${dataPagTs}_${Date.now()}`;

    setSalvando(true);
    try {
      if (itemSel.isParcela) {
        const parcelas = (itemSel.parcelas || []).map((p) => {
          if (p.numero !== itemSel.parcelaNumero) return p;
          return {
            ...p,
            status: "paga",
            pagoEm: dataPagTs,
            dataPagamento: dataPagTs,
            origemPagamento,
            caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
            caixinhaNome:
              origemPagamento === "caixinha" ? cxSel?.nome || null : null,
          };
        });

        const listaAtual = itemSel.valoresPagos || [];
        const novoTotal = arred((Number(itemSel.valorPagoTotal) || 0) + valor);
        const todasPagas = parcelas.every((p) => p.status === "paga");

        await updateDoc(doc(db, "registros", itemSel.id), {
          parcelas,
          valoresPagos: [
            ...listaAtual,
            {
              valor,
              data: dataPagTs,
              id: idPag,
              parcelaNumero: itemSel.parcelaNumero,
              origemPagamento,
              caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
              caixinhaNome:
                origemPagamento === "caixinha" ? cxSel?.nome || null : null,
            },
          ],
          valorPagoTotal: novoTotal,
          status: todasPagas ? "quitada" : "aberta",
          updatedAt: Date.now(),
        });
      } else {
        const listaAtual = itemSel.valoresPagos || [];
        const novoTotal = arred((Number(itemSel.valorPagoTotal) || 0) + valor);

        await updateDoc(doc(db, "registros", itemSel.id), {
          valoresPagos: [
            ...listaAtual,
            {
              valor,
              data: dataPagTs,
              id: idPag,
              origemPagamento,
              caixinhaId: origemPagamento === "caixinha" ? caixinhaId : null,
              caixinhaNome:
                origemPagamento === "caixinha" ? cxSel?.nome || null : null,
            },
          ],
          valorPagoTotal: novoTotal,
          status:
            novoTotal >= (Number(itemSel.valorTotal) || 0) - 0.001
              ? "quitada"
              : "aberta",
          updatedAt: Date.now(),
        });
      }

      if (origemPagamento === "caixinha" && caixinhaId) {
        await RetirarDaCaixinha(caixinhaId, valor);
      }

      await Promise.all([
        HistoricoMovimentos(),
        ResumoFinanceiro?.(),
        CarregarCaixinhas?.(),
      ]);

      fecharModal();
      showAlert({ title: "Sucesso", message: "Pagamento registrado." });
    } catch (e) {
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível registrar.",
      });
    } finally {
      setSalvando(false);
    }
  }

  const caixinhasComSaldo = (caixinhas || []).filter(
    (c) => (Number(c.valor) || 0) > 0
  );

  if (!authPronto) return <Load />;
  if (!financasProntas && !refreshing) return <Load />;
  if (load && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={pendentes}
        keyExtractor={(item) => item.rowId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIcon, { backgroundColor: card }]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color={muted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: muted }]}>
              Nada a pagar
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              {!uid
                ? "Faça login para ver os valores."
                : "Quando houver despesas em aberto, elas aparecem aqui."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dataRef = item.vencimento || item.data;
          const dataStr = dataRef
            ? new Date(dataRef).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })
            : "--/--/--";

          const liberada = podeBaixarParcela(item);
          const jaTemPagamento = temPrestacaoPaga(item);

          const meta = item.isParcela
            ? `${item.parcelaNumero}/${item.parcelaTotal} · ${dataStr}`
            : `${item.tipo || "Saída"} · ${dataStr}`;

          // Constrói a lista de ações: se já houver pagamento efetuado, omite o botão de excluir
          const actions = [];
          if (podeEditar) {
            actions.push({
              key: "pagar",
              icon: liberada ? "card-outline" : "lock-closed-outline",
              label: liberada ? "Pagar" : "Bloqueada",
              backgroundColor: liberada ? principal : muted,
              onPress: () => abrirPagar(item),
            });

            if (!jaTemPagamento) {
              actions.push({
                key: "excluir",
                icon: "trash-outline",
                label: "Excluir",
                backgroundColor: danger,
                onPress: () => pedirExcluir(item),
              });
            }
          }

          return (
            <SwipeCard
              icon="arrow-up-outline"
              iconColor={danger}
              tint={tintDanger}
              title={item.descricao || "Sem descrição"}
              subtitle={meta}
              value={`R$ ${formatoMoeda.format(item.falta)}`}
              actions={actions}
              open={abertoId === item.rowId}
              onOpenChange={(isOpen) =>
                setAbertoId(isOpen ? item.rowId : null)
              }
            />
          );
        }}
        ListFooterComponent={<View style={{ height: 28 }} />}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <Pressable style={styles.modalOverlay} onPress={fecharModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable
              style={[styles.modalCard, { backgroundColor: card }]}
              onPress={() => { }}
            >
              <Text style={[styles.modalTitle, { color: text }]}>
                {itemSel?.isParcela ? "Pagar parcela" : "Registrar pagamento"}
              </Text>
              <Text style={[styles.modalSub, { color: muted }]}>
                {itemSel?.descricao || ""}
                {itemSel?.isParcela
                  ? ` · Parcela ${itemSel.parcelaNumero}/${itemSel.parcelaTotal}`
                  : ""}{" "}
                · R$ {formatoMoeda.format(itemSel?.falta || 0)}
              </Text>

              <Text style={[styles.inputLabel, { color: muted }]}>
                Data do pagamento
              </Text>
              <TouchableOpacity
                style={[styles.dateBox, { backgroundColor: surface }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={muted} />
                <Text style={[styles.dateText, { color: text }]}>
                  {dataPagamento.toLocaleDateString("pt-BR")}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dataPagamento}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={onChangeData}
                />
              )}

              {Platform.OS === "ios" && showDatePicker && (
                <TouchableOpacity
                  style={styles.dateOk}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={[styles.dateOkText, { color: principal }]}>
                    OK
                  </Text>
                </TouchableOpacity>
              )}

              {!itemSel?.isParcela && (
                <>
                  <Text style={[styles.inputLabel, { color: muted }]}>
                    Valor
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: surface,
                        color: text,
                        borderColor: border,
                      },
                    ]}
                    value={valorPago}
                    onChangeText={setValorPago}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={muted}
                  />
                </>
              )}

              <Text style={[styles.inputLabel, { color: muted }]}>
                Pagar com
              </Text>
              <View style={[styles.segment, { backgroundColor: surface }]}>
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
              ) : (
                <>
                  {caixinhasComSaldo.length === 0 ? (
                    <Text style={[styles.hint, { color: muted }]}>
                      Nenhuma caixinha com saldo
                    </Text>
                  ) : (
                    caixinhasComSaldo.map((cx) => {
                      const ativo = caixinhaId === cx.id;
                      return (
                        <TouchableOpacity
                          key={cx.id}
                          style={[
                            styles.cxItem,
                            {
                              backgroundColor: surface,
                              borderColor: ativo ? principal : "transparent",
                            },
                          ]}
                          onPress={() => setCaixinhaId(cx.id)}
                        >
                          <Text style={[styles.cxNome, { color: text }]}>
                            {cx.nome}
                          </Text>
                          <Text style={[styles.cxValor, { color: muted }]}>
                            R$ {formatoMoeda.format(cx.valor || 0)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btnCancel, { backgroundColor: surface }]}
                  onPress={fecharModal}
                >
                  <Text style={[styles.btnCancelText, { color: muted }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnOk,
                    { backgroundColor: principal },
                    salvando && { opacity: 0.7 },
                  ]}
                  onPress={confirmarPagamento}
                  disabled={salvando}
                >
                  <Text style={styles.btnOkText}>
                    {salvando ? "Salvando..." : "Confirmar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14 },
  content: { paddingTop: 12, paddingBottom: 20, gap: 8 },
  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: "Roboto-Medium",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
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
    borderRadius: 22,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
  },
  modalSub: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 4,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },
  dateOk: {
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dateOkText: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  segment: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 10,
  },
  cxItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  cxNome: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  cxValor: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  btnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOkText: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
    color: "#fff",
  },
});
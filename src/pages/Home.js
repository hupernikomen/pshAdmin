import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import Load from "../componentes/Load";
import Saldo from "../componentes/Saldo";
import Menu from "../componentes/Menu";
import SwipeCard from "../componentes/SwipeCard";
import { useAppTheme } from "../context/ThemeContext";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  valorAPagarItem,
} from "../utils/financeiro";

function noMes(ts, mes, ano) {
  if (!ts) return false;
  const d = new Date(ts);
  return d.getMonth() === mes && d.getFullYear() === ano;
}

function entradasNoMes(item, mes, ano, limiteHoje) {
  if (item?.tipoMovimento !== "entrada") return 0;
  if (item?.tipo === "Saldo inicial") return 0;

  const lista = Array.isArray(item.valoresRecebidos) ? item.valoresRecebidos : [];
  if (lista.length > 0) {
    return lista.reduce((acc, r) => {
      const ts = Number(r.data || 0);
      if (ts && ts <= limiteHoje && noMes(ts, mes, ano)) {
        return acc + (Number(r.valor) || 0);
      }
      return acc;
    }, 0);
  }
  const ts = dataDoItem(item);
  if (ts && ts <= limiteHoje && noMes(ts, mes, ano)) {
    return Number(item.valorRecebidoTotal) || 0;
  }
  return 0;
}

function saidasNoMes(item, mes, ano, limiteHoje) {
  if (item?.tipoMovimento !== "saida") return 0;

  const pagos = Array.isArray(item.valoresPagos) ? item.valoresPagos : [];
  if (pagos.length > 0) {
    return pagos.reduce((acc, p) => {
      const ts = Number(p.data || 0);
      if (ts && ts <= limiteHoje && noMes(ts, mes, ano)) {
        return acc + (Number(p.valor) || 0);
      }
      return acc;
    }, 0);
  }

  const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
  const pagas = parcelas.filter(
    (p) => p.status === "paga" || p.status === "quitada" || !!p.pago
  );
  if (pagas.length > 0) {
    return pagas.reduce((acc, p) => {
      const ts = Number(p.dataPagamento || p.pagoEm || p.data || 0);
      if (ts && ts <= limiteHoje && noMes(ts, mes, ano)) {
        return acc + (Number(p.valor) || 0);
      }
      return acc;
    }, 0);
  }

  const ts = dataDoItem(item);
  if (ts && ts <= limiteHoje && noMes(ts, mes, ano)) {
    return Number(item.valorPagoTotal) || 0;
  }
  return 0;
}

function inicioMediaDizimos(createdAt) {
  const d = new Date(Number(createdAt) || 0);
  if (!createdAt || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

function mesesHorizonteProjecao(lista) {
  const agora = new Date();
  const agoraTs = agora.getTime();
  let maxTs = 0;

  for (const item of lista || []) {
    if (item?.tipoMovimento === "entrada") {
      const falta = valorAReceberItem(item);
      if (!(falta > 0.001)) continue;
      const ts = dataDoItem(item);
      if (ts && ts > agoraTs) maxTs = Math.max(maxTs, ts);
      continue;
    }

    if (item?.tipoMovimento !== "saida") continue;

    const falta = valorAPagarItem(item);
    if (!(falta > 0.001)) continue;

    const parcelas = Array.isArray(item.parcelas) ? item.parcelas : [];
    let pegouParcela = false;

    for (const p of parcelas) {
      const aberta =
        p.status === "aberta" ||
        (p.status !== "paga" &&
          p.status !== "quitada" &&
          !p.pago &&
          !p.dataPagamento &&
          !p.pagoEm);

      if (!aberta) continue;
      const ts = Number(p.vencimento || p.data || 0);
      if (ts) {
        maxTs = Math.max(maxTs, ts);
        pegouParcela = true;
      }
    }

    if (pegouParcela) continue;
    if (item.tipo === "Sem Prazo" && !item.vencimento) continue;

    const ts = Number(item.vencimento || item.data || dataDoItem(item) || 0);
    if (ts && ts > agoraTs) maxTs = Math.max(maxTs, ts);
  }

  if (!maxTs) return 1;

  const fim = new Date(maxTs);
  const meses =
    (fim.getFullYear() - agora.getFullYear()) * 12 +
    (fim.getMonth() - agora.getMonth());

  return Math.max(1, meses);
}

function HomeTopo({
  foto,
  nome,
  igrejaNome,
  principal,
  text,
  ocultarValores,
  toggleOcultarValores,
  isDark,
  toggleLightDark,
  onPressAvatar,
  paddingTop,
}) {
  return (
    <View style={[styles.topo, { paddingTop }]}>
      <TouchableOpacity
        onPress={onPressAvatar}
        style={styles.topoLeft}
        activeOpacity={0.8}
      >
        {foto ? (
          <Image source={{ uri: foto }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: principal },
            ]}
          >
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}

        <View style={styles.topoTextos}>
          <Text style={[styles.topoOla, { color: text }]} numberOfLines={1}>
            Olá, {String(nome || "").trim().split(" ")[0] || "Conta"}
          </Text>
          {!!igrejaNome && (
            <Text style={[styles.topoIgreja, { color: text }]} numberOfLines={1}>
              {igrejaNome}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.topoRight}>
        <TouchableOpacity
          onPress={() => toggleOcultarValores?.()}
          style={styles.topoBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={ocultarValores ? "eye-off-outline" : "eye-outline"}
            size={22}
            color={text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleLightDark}
          style={styles.topoBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={22}
            color={text}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Home() {
  const {
    saldo,
    saldoDisponivel,
    totalReservado,
    totalAReceber,
    totalAPagar,
    saldoProjetado,
    caixinhas,
    dadosFinancas,
    load,
    setLoad,
    financasProntas,
    HistoricoMovimentos,
    CarregarCaixinhas,
    formatoMoeda,
    igrejaAtiva,
    igrejasDoUsuario,
    selecionarIgreja,
    ocultarValores,
    toggleOcultarValores,
  } = useContext(AppContext);

  const { showAlert } = useAppAlert();
  const { isDark, toggleLightDark } = useAppTheme();
  const { user, logout } = useAuth();
  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalIgrejas, setModalIgrejas] = useState(false);
  const [cardAbertoId, setCardAbertoId] = useState(null);

  const foto = user?.photoURL || null;
  const nome = user?.displayName || "Conta";
  const variasIgrejas = (igrejasDoUsuario || []).length > 1;
  const semIgreja = !igrejaAtiva?.id;

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onRefresh = async () => {
    if (semIgreja) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setRefreshing(false);
  };

  async function handleLogout() {
    setMenuAberto(false);
    try {
      await logout();
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Não foi possível sair.",
      });
    }
  }

  function abrirMembros() {
    setMenuAberto(false);
    navigation.navigate("Membros");
  }

  function abrirConfiguracoes() {
    setMenuAberto(false);
    navigation.navigate("Configuracoes");
  }

  function abrirProjecao() {
    setMenuAberto(false);
    navigation.navigate("Projecao");
  }

  function abrirTrocarIgreja() {
    setMenuAberto(false);
    setModalIgrejas(true);
  }

  async function escolherIgreja(igrejaId) {
    setModalIgrejas(false);
    if (igrejaId === igrejaAtiva?.id) return;
    await selecionarIgreja(igrejaId);
  }

  const lista = dadosFinancas || [];
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const limiteHoje = fimDoDiaTs(agora);

  const entradasMesAtual = lista.reduce(
    (acc, i) => acc + entradasNoMes(i, mesAtual, anoAtual, limiteHoje),
    0
  );

  const saidasMesAtual = lista.reduce(
    (acc, i) => acc + saidasNoMes(i, mesAtual, anoAtual, limiteHoje),
    0
  );

  const saldoAtual = Number(saldo) || 0;
  const caixaGeral = Number(saldoDisponivel) || 0;
  const emCaixinhas = Number(totalReservado) || 0;
  const qtdCaixinhas = (caixinhas || []).length;
  const saldoAnterior = arred(saldoAtual - entradasMesAtual + saidasMesAtual);

  const aReceberTotal = arred(Number(totalAReceber) || 0);
  const despesasFuturas = arred(Number(totalAPagar) || 0);
  const projecaoFutura = arred(
    Number(saldoProjetado) || saldoAtual + aReceberTotal - despesasFuturas
  );
  const projecaoMeses = mesesHorizonteProjecao(lista);

  const totalDizimosMes = lista
    .filter((i) => {
      if (i.tipoMovimento !== "entrada") return false;
      const t = String(i.tipo || "").toLowerCase();
      return t.includes("dizimo") || t.includes("dízimo");
    })
    .reduce(
      (acc, i) => acc + entradasNoMes(i, mesAtual, anoAtual, limiteHoje),
      0
    );

  let mediaDizimosFechados = 0;
  const inicioMedia = inicioMediaDizimos(igrejaAtiva?.createdAt);

  if (inicioMedia) {
    const siAno = inicioMedia.getFullYear();
    const siMes = inicioMedia.getMonth();
    const idxInicio = siAno * 12 + siMes;
    const idxAtual = anoAtual * 12 + mesAtual;
    const idxUltimoFechado = idxAtual - 1;
    const mesesFechados = idxUltimoFechado - idxInicio + 1;

    if (mesesFechados >= 1) {
      const fimUltimoFechado = new Date(
        Math.floor(idxUltimoFechado / 12),
        (idxUltimoFechado % 12) + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime();

      const totalDizimosFechados = lista
        .filter((i) => {
          if (i.tipoMovimento !== "entrada") return false;
          const t = String(i.tipo || "").toLowerCase();
          return t.includes("dizimo") || t.includes("dízimo");
        })
        .reduce((acc, i) => {
          const recebidos = Array.isArray(i.valoresRecebidos)
            ? i.valoresRecebidos
            : [];

          if (recebidos.length > 0) {
            return (
              acc +
              recebidos.reduce((s, r) => {
                const ts = Number(r.data || 0);
                if (!ts || ts > limiteHoje) return s;
                if (ts < inicioMedia.getTime()) return s;
                if (ts > fimUltimoFechado) return s;
                const d = new Date(ts);
                const idx = d.getFullYear() * 12 + d.getMonth();
                if (idx >= idxInicio && idx <= idxUltimoFechado) {
                  return s + (Number(r.valor) || 0);
                }
                return s;
              }, 0)
            );
          }

          const ts = dataDoItem(i);
          if (!ts || ts > limiteHoje || ts < inicioMedia.getTime()) return acc;
          if (ts > fimUltimoFechado) return acc;
          const d = new Date(ts);
          const idx = d.getFullYear() * 12 + d.getMonth();
          if (idx >= idxInicio && idx <= idxUltimoFechado) {
            return acc + (Number(i.valorRecebidoTotal) || 0);
          }
          return acc;
        }, 0);

      mediaDizimosFechados = totalDizimosFechados / mesesFechados;
    }
  } else if (mesAtual >= 1) {
    let total = 0;
    lista
      .filter((i) => {
        if (i.tipoMovimento !== "entrada") return false;
        const t = String(i.tipo || "").toLowerCase();
        return t.includes("dizimo") || t.includes("dízimo");
      })
      .forEach((i) => {
        for (let m = 0; m < mesAtual; m++) {
          total += entradasNoMes(i, m, anoAtual, limiteHoje);
        }
      });
    mediaDizimosFechados = total / mesAtual;
  }

  const resumoItens = useMemo(
    () => [
      {
        id: "1",
        label: "A receber",
        sub: "Valores em aberto",
        value: `R$ ${formatoMoeda.format(aReceberTotal)}`,
        icon: "arrow-down-outline",
        tint: dark ? "#1B3D2F" : "#E8F5E9",
        iconColor: dark ? "#81C784" : "#2E7D32",
        route: "AReceber",
      },
      {
        id: "2",
        label: "A pagar",
        sub: "Despesas pendentes",
        value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
        icon: "arrow-up-outline",
        tint: dark ? "#3D1B1B" : "#FFEBEE",
        iconColor: dark ? "#E57373" : "#C62828",
        route: "APagar",
      },
      {
        id: "3",
        label: "Dízimos no mês",
        sub: "Arrecadado neste mês",
        value: `R$ ${formatoMoeda.format(totalDizimosMes)}`,
        icon: "hand-left-outline",
        tint: dark ? "#1A2A3D" : "#E3F2FD",
        iconColor: dark ? "#64B5F6" : "#1565C0",
        route: "Dizimos",
      },
      {
        id: "4",
        label: "Média de dízimos",
        sub: `Média geral`,
        value: `R$ ${formatoMoeda.format(mediaDizimosFechados)}`,
        icon: "stats-chart-outline",
        tint: dark ? "#3D2E1A" : "#FFF3E0",
        iconColor: dark ? "#FFB74D" : "#EF6C00",
      },
    ],
    [
      aReceberTotal,
      despesasFuturas,
      totalDizimosMes,
      mediaDizimosFechados,
      formatoMoeda,
      dark,
    ]
  );

  const topoProps = {
    foto,
    nome,
    igrejaNome: igrejaAtiva?.nome,
    principal,
    text,
    ocultarValores,
    toggleOcultarValores,
    isDark,
    toggleLightDark,
    onPressAvatar: () => setMenuAberto(true),
    paddingTop: Math.max(insets.top, 8) + 14,
  };

  if (!semIgreja && !financasProntas && !refreshing) return <Load />;
  if (load && !refreshing && !semIgreja) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {semIgreja ? (
        <View style={{ flex: 1 }}>
          <HomeTopo {...topoProps} />
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: card }]}>
              <Ionicons name="business-outline" size={28} color={muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: text }]}>
              Nenhuma igreja criada
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              Para começar a usar o App, crie uma igreja.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: principal }]}
              onPress={() => navigation.navigate("Configuracoes")}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Criar Igreja</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={resumoItens}
          keyExtractor={(item) => item.id}
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
          ListHeaderComponent={
            <View>
              <HomeTopo {...topoProps} />
              <Saldo
                caixaGeral={caixaGeral}
                saldoAtual={saldoAtual}
                saldoAnterior={saldoAnterior}
                projecaoFutura={projecaoFutura}
                projecaoMeses={projecaoMeses}
                qtdCaixinhas={qtdCaixinhas}
                emCaixinhas={emCaixinhas}
              />
            </View>
          }
          renderItem={({ item }) => (
            <SwipeCard
              key={item.id || item.label}
              icon={item.icon}
              iconColor={item.iconColor}
              tint={item.tint}
              title={item.label}
              subtitle={item.sub}
              value={item.value}
              open={cardAbertoId === (item.id || item.label)}
              onOpenChange={(isOpen) => {
                if (isOpen) {
                  setCardAbertoId(item.id || item.label);
                } else if (cardAbertoId === (item.id || item.label)) {
                  setCardAbertoId(null);
                }
              }}
              actions={
                item.route
                  ? [
                      {
                        key: "go",
                        icon: "arrow-forward",
                        backgroundColor: principal,
                        onPress: () => navigation.navigate(item.route),
                      },
                    ]
                  : []
              }
              onPress={
                item.route ? () => navigation.navigate(item.route) : undefined
              }
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      <Menu
        visible={menuAberto}
        onClose={() => setMenuAberto(false)}
        user={user}
        igrejaAtiva={igrejaAtiva}
        variasIgrejas={variasIgrejas}
        onOpenProjecao={abrirProjecao}
        onOpenMembros={abrirMembros}
        onOpenConfiguracoes={abrirConfiguracoes}
        onOpenTrocarIgreja={abrirTrocarIgreja}
        onLogout={handleLogout}
      />

      <Modal
        visible={modalIgrejas}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setModalIgrejas(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setModalIgrejas(false)}
        >
          <Pressable
            style={[styles.sheetCard, { backgroundColor: card }]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: text }]} />
            <Text style={[styles.modalIgrejaTitulo, { color: text }]}>
              Suas igrejas
            </Text>
            {(igrejasDoUsuario || []).map((ig) => {
              const ativa = ig.igrejaId === igrejaAtiva?.id;
              return (
                <TouchableOpacity
                  key={ig.igrejaId}
                  style={[
                    styles.igrejaItem,
                    ativa && {
                      backgroundColor: dark ? "#2a2a2a" : "#f4f5f7",
                    },
                  ]}
                  onPress={() => escolherIgreja(ig.igrejaId)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.igrejaItemNome, { color: text }]}>
                      {ig.nome}
                    </Text>
                    <Text style={[styles.igrejaItemPapel, { color: muted }]}>
                      {ig.papel}
                    </Text>
                  </View>
                  {ativa && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={principal}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: 8,
    paddingHorizontal: 14,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 14,
  },
  topoLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    marginRight: 10,
  },
  topoTextos: {
    flex: 1,
    minWidth: 0,
  },
  topoOla: {
    fontSize: 18,
    fontFamily: "Roboto-Bold",
  },
  topoIgreja: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginTop: 1,
  },
  topoRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topoBtn: {
    padding: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Roboto-Medium",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  modalIgrejaTitulo: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  igrejaItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  igrejaItemNome: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  igrejaItemPapel: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginTop: 2,
    textTransform: "capitalize",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 48,
    maxHeight: "70%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
});
// src/screens/Home.js
import { useContext, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useAppAlert } from "../context/AlertContext";
import Load from "../componentes/Load";
import Saldo from "../componentes/Saldo";
import SwipeCard from "../componentes/SwipeCard";
import HomeTopo from "../componentes/HomeTopo";
import HomeEmptyState from "../componentes/HomeEmptyState";
import { useAppTheme } from "../context/ThemeContext";
import {
  arred,
  fimDoDiaTs,
  dataDoItem,
  valorAReceberItem,
  valorAPagarItem,
} from "../utils/financeiro";

// (Mantidas as funções auxiliares: noMes, entradasNoMes, saidasNoMes, inicioMediaDizimos, mesesHorizonteProjecao)
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

    const ts = Number(p.vencimento || p.data || dataDoItem(item) || 0);
    if (ts && ts > agoraTs) maxTs = Math.max(maxTs, ts);
  }

  if (!maxTs) return 1;

  const fim = new Date(maxTs);
  const meses =
    (fim.getFullYear() - agora.getFullYear()) * 12 +
    (fim.getMonth() - agora.getMonth());

  return Math.max(1, meses);
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
    financasProntas,
    HistoricoMovimentos,
    CarregarCaixinhas,
    formatoMoeda,
    igrejaAtiva,
  } = useContext(AppContext);

  const { isDark, toggleLightDark } = useAppTheme();
  const { user, logout } = useAuth();
  const { showAlert } = useAppAlert();
  const { colors, dark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [cardAbertoId, setCardAbertoId] = useState(null);

  const foto = user?.photoURL || null;
  const nome = user?.displayName || "Conta";
  const semIgreja = !igrejaAtiva?.id;

  const principal = colors.principal || colors.primary;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const bg = colors.background;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Não foi possível sair.",
      });
    }
  }

  const onRefresh = async () => {
    if (semIgreja) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await Promise.all([HistoricoMovimentos(), CarregarCaixinhas?.()]);
    setRefreshing(false);
  };

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
        tint: dark ? "#11221c" : "#F0FDF4",
        iconColor: "#10B981",
        route: "AReceber",
      },
      {
        id: "2",
        label: "A pagar",
        sub: "Despesas pendentes",
        value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
        icon: "arrow-up-outline",
        tint: dark ? "#2A1515" : "#FEF2F2",
        iconColor: "#EF4444",
        route: "APagar",
      },
      {
        id: "3",
        label: "Dízimos no mês",
        sub: "Arrecadado neste mês",
        value: `R$ ${formatoMoeda.format(totalDizimosMes)}`,
        icon: "hand-left-outline",
        tint: dark ? "#111C2E" : "#EFF6FF",
        iconColor: "#3B82F6",
        route: "Dizimos",
      },
      {
        id: "4",
        label: "Média de dízimos",
        sub: `Média geral`,
        value: `R$ ${formatoMoeda.format(mediaDizimosFechados)}`,
        icon: "stats-chart-outline",
        tint: dark ? "#2B1D11" : "#FFF7ED",
        iconColor: "#F59E0B",
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
    principal,
    text: colors.text,
    isDark,
    toggleLightDark,
    onPressAvatar: () => navigation.navigate("Menu"),
    onPressPaywall: () => navigation.navigate("Paywall"),
    paddingTop: Math.max(insets.top, 8) + 10,
  };

  if (!semIgreja && !financasProntas && !refreshing) return <Load />;
  if (load && !refreshing && !semIgreja) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {semIgreja ? (
        <HomeEmptyState
          principal={principal}
          text={colors.text}
          muted={muted}
          onPressCriar={() => navigation.navigate("Configuracoes")}
          onPressSair={handleLogout}
          paddingTop={insets.top + 30}
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: 10,
    paddingHorizontal: 16,
  },
});
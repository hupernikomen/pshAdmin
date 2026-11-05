import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";
import Load from "../componentes/Load";
import SwipeCard from "../componentes/SwipeCard";
import SeletorMesAno from "../componentes/SeletorMesAno";
import { arred, dataDoItem } from "../utils/financeiro";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function isDizimo(item) {
  const t = String(item?.tipo || "").toLowerCase();
  return t.includes("dizimo") || t.includes("dízimo");
}

function montarDizimosDoMes(lista, mes, ano) {
  const linhas = [];

  (lista || []).forEach((item) => {
    if (item?.tipoMovimento !== "entrada") return;
    if (!isDizimo(item)) return;

    const recebidos = Array.isArray(item.valoresRecebidos)
      ? item.valoresRecebidos
      : [];

    if (recebidos.length > 0) {
      recebidos.forEach((r, idx) => {
        const ts = Number(r.data || item.data || 0);
        if (!ts) return;
        const d = new Date(ts);
        if (d.getMonth() !== mes || d.getFullYear() !== ano) return;
        linhas.push({
          rowId: `${item.id}_rec_${r.id || idx}`,
          id: item.id,
          descricao: item.descricao || "Dízimo",
          data: ts,
          valor: Number(r.valor) || 0,
        });
      });
      return;
    }

    const ts = dataDoItem(item);
    if (!ts) return;
    const d = new Date(ts);
    if (d.getMonth() !== mes || d.getFullYear() !== ano) return;

    linhas.push({
      rowId: item.id,
      id: item.id,
      descricao: item.descricao || "Dízimo",
      data: ts,
      valor: Number(item.valorRecebidoTotal || item.valorTotal) || 0,
    });
  });

  return linhas.sort((a, b) => (b.data || 0) - (a.data || 0));
}

export default function Dizimos() {
  const {
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors, dark } = useTheme();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth());
  const [ano, setAno] = useState(agora.getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const tint = dark ? "#1A2A3D" : "#E3F2FD";
  const iconColor = dark ? "#64B5F6" : "#1565C0";

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoad(true);
    await HistoricoMovimentos();
    setLoad(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await HistoricoMovimentos();
    setRefreshing(false);
  };

  const linhas = useMemo(
    () => montarDizimosDoMes(dadosFinancas, mes, ano),
    [dadosFinancas, mes, ano]
  );

  const totalMes = arred(linhas.reduce((acc, i) => acc + (i.valor || 0), 0));

  if (load && !refreshing) return <Load />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={linhas}
        keyExtractor={(item) => item.rowId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[principal]}
            tintColor={principal}
          />
        }
        ListHeaderComponent={
          <View style={[styles.block, { backgroundColor: card }]}>
            <SeletorMesAno
              mes={mes}
              ano={ano}
              onChangeMes={setMes}
              onChangeAno={setAno}
            />

            <View style={[styles.totalWrap, { borderTopColor: colors.border || (dark ? "#333" : "#ececec") }]}>
              <Text style={[styles.totalLabel, { color: muted }]}>
                {MESES[mes]} {ano}
              </Text>
              <Text style={[styles.totalValue, { color: text }]}>
                R$ {formatoMoeda.format(totalMes)}
              </Text>
     
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeCard
            icon="hand-left-outline"
            iconColor={iconColor}
            tint={tint}
            title={item.descricao}
            subtitle={new Date(item.data).toLocaleDateString("pt-BR")}
            value={`R$ ${formatoMoeda.format(item.valor)}`}
            actions={[]}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: card }]}>
              <Ionicons name="hand-left-outline" size={28} color={muted} />
            </View>
            <Text style={[styles.emptyTitle, { color: text }]}>
              Nenhum dízimo
            </Text>
            <Text style={[styles.emptyText, { color: muted }]}>
              Não há dízimos registrados em {MESES[mes]} de {ano}.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 14 },
  listContent: {
    paddingTop: 10,
    paddingBottom: 40,
    gap: 8,
  },
  header: {
    marginBottom: 8,
  },
  totalCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 6,
  },
  block: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  totalWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Roboto-Bold",
    letterSpacing: -0.4,
  },
  totalQtd: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
  },
  emptyContainer: {
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
});
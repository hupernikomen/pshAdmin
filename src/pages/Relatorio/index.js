import { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Relatorio() {
  const { dadosFinancas, load, HistoricoMovimentos, formatoMoeda } =
    useContext(AppContext);
  const { colors } = useTheme();
  const [mesSelecionadoKey, setMesSelecionadoKey] = useState(null);

  useEffect(() => {
    HistoricoMovimentos();
  }, []);

  // Agrupa registros por mês/ano
  const meses = useMemo(() => {
    const mapa = {};

    (dadosFinancas || []).forEach((item) => {
      const dataRef = item.data || item.createdAt || item.reg;
      if (!dataRef) return;

      const date = new Date(dataRef);
      if (isNaN(date.getTime())) return;

      const ano = date.getFullYear();
      const mes = date.getMonth();
      const key = `${ano}-${mes}`;

      if (!mapa[key]) {
        mapa[key] = {
          key,
          ano,
          mes,
          nomeMes: NOMES_MES[mes],
          entradas: 0,
          saidas: 0,
          porTipoEntrada: {},
          porTipoSaida: {},
          quantidade: 0,
        };
      }

      const valor =
        item.valorRecebidoTotal ||
        item.valorPagoTotal ||
        item.valorTotal ||
        0;

      const tipo = item.tipo || "Outros";

      if (item.tipoMovimento === "entrada") {
        mapa[key].entradas += valor;
        mapa[key].porTipoEntrada[tipo] =
          (mapa[key].porTipoEntrada[tipo] || 0) + valor;
      } else if (item.tipoMovimento === "saida") {
        mapa[key].saidas += valor;
        mapa[key].porTipoSaida[tipo] =
          (mapa[key].porTipoSaida[tipo] || 0) + valor;
      }

      mapa[key].quantidade += 1;
    });

    return Object.values(mapa).sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.mes - b.mes;
    });
  }, [dadosFinancas]);

  useEffect(() => {
    if (meses.length > 0) {
      const ultimo = meses[meses.length - 1];
      setMesSelecionadoKey(ultimo.key);
    }
  }, [meses]);

  const mesSelecionado = meses.find((m) => m.key === mesSelecionadoKey);

  if (load && meses.length === 0) return <Load />;

  if (!mesSelecionado) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhum dado disponível para relatório</Text>
      </View>
    );
  }

  const saldoMes = mesSelecionado.entradas - mesSelecionado.saidas;

  const listaEntradas = Object.entries(mesSelecionado.porTipoEntrada)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  const listaSaidas = Object.entries(mesSelecionado.porTipoSaida)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={styles.container}>
      {/* Seletor de meses */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.monthSelector}
        contentContainerStyle={styles.monthContent}
      >
        {meses.map((mes) => {
          const ativo = mes.key === mesSelecionadoKey;
          return (
            <TouchableOpacity
              key={mes.key}
              style={[
                styles.monthButton,
                ativo && { backgroundColor: colors.principal },
              ]}
              onPress={() => setMesSelecionadoKey(mes.key)}
            >
              <Text style={[styles.monthText, ativo && { color: "#fff" }]}>
                {mes.nomeMes.substring(0, 3).toUpperCase()}
              </Text>
              <Text style={[styles.monthYear, ativo && { color: "#fff" }]}>
                {mes.ano}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Título do mês */}
        <Text style={styles.mesTitulo}>
          {mesSelecionado.nomeMes} de {mesSelecionado.ano}
        </Text>
        <Text style={styles.mesSub}>
          {mesSelecionado.quantidade} registro
          {mesSelecionado.quantidade !== 1 ? "s" : ""} neste mês
        </Text>

        {/* Cards resumo */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entradas</Text>
            <Text style={[styles.summaryValue, { color: colors.principal }]}>
              R$ {formatoMoeda.format(mesSelecionado.entradas)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saídas</Text>
            <Text style={[styles.summaryValue, { color: colors.destaque }]}>
              R$ {formatoMoeda.format(mesSelecionado.saidas)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: saldoMes >= 0 ? colors.principal : colors.destaque },
              ]}
            >
              R$ {formatoMoeda.format(saldoMes)}
            </Text>
          </View>
        </View>

        {/* Detalhe entradas */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Entradas por tipo</Text>
          {listaEntradas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma entrada neste mês</Text>
          ) : (
            listaEntradas.map((item) => (
              <View key={item.tipo} style={styles.row}>
                <Text style={styles.rowLabel}>{item.tipo}</Text>
                <Text style={[styles.rowValue, { color: colors.principal }]}>
                  + R$ {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Detalhe saídas */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Saídas por tipo</Text>
          {listaSaidas.length === 0 ? (
            <Text style={styles.emptySection}>Nenhuma saída neste mês</Text>
          ) : (
            listaSaidas.map((item) => (
              <View key={item.tipo} style={styles.row}>
                <Text style={styles.rowLabel}>{item.tipo}</Text>
                <Text style={[styles.rowValue, { color: colors.destaque }]}>
                  - R$ {formatoMoeda.format(item.total)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthSelector: {
    maxHeight: 72,
    marginTop: 8,
  },
  monthContent: {
    paddingHorizontal: 20,
    alignItems: "center",
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginRight: 8,
    alignItems: "center",
    elevation: 1,
    minWidth: 70,
  },
  monthText: {
    fontSize: 13,
    fontFamily: "Roboto-Medium",
    color: "#444",
  },
  monthYear: {
    fontSize: 11,
    fontFamily: "Roboto-Light",
    color: "#888",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  mesTitulo: {
    fontSize: 18,
    fontFamily: "Roboto-Bold",
    color: "#222",
  },
  mesSub: {
    fontSize: 13,
    fontFamily: "Roboto-Light",
    color: "#888",
    marginBottom: 16,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    color: "#777",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#333",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: "#444",
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  emptySection: {
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    color: "#999",
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#888",
    textAlign: "center",
  },
});
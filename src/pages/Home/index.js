import { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
} from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";
import { AppContext } from "../../context/AppContext";
import Load from "../../componentes/Load";

export default function Home() {
  const {
    saldo,
    dadosFinancas,
    load,
    setLoad,
    HistoricoMovimentos,
    formatoMoeda,
  } = useContext(AppContext);

  const { colors } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

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

  const lista = dadosFinancas || [];
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();






  const totalEntradas = lista
    .filter((i) => i.tipoMovimento === "entrada")
    .reduce((acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0), 0);

  const totalSaidas = lista
    .filter((i) => i.tipoMovimento === "saida")
    .reduce((acc, i) => acc + (i.valorPagoTotal || i.valorTotal || 0), 0);

  // Movimentos do mês atual (para estimar saldo anterior)
  const entradasMesAtual = lista
    .filter((i) => {
      if (i.tipoMovimento !== "entrada" || !i.data) return false;
      const d = new Date(i.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0), 0);

  const saidasMesAtual = lista
    .filter((i) => {
      if (i.tipoMovimento !== "saida" || !i.data) return false;
      const d = new Date(i.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, i) => acc + (i.valorPagoTotal || i.valorTotal || 0), 0);

  const saldoAtual = saldo || 0;
  const saldoAnterior = saldoAtual - entradasMesAtual + saidasMesAtual;

  // Valores ainda em aberto (futuros)
  const entradasFuturas = lista
    .filter((i) => i.tipoMovimento === "entrada" && i.status === "aberta")
    .reduce((acc, i) => {
      const falta = (i.valorTotal || 0) - (i.valorRecebidoTotal || 0);
      return acc + (falta > 0 ? falta : 0);
    }, 0);

  const despesasFuturas = lista
    .filter((i) => i.tipoMovimento === "saida" && i.status === "aberta")
    .reduce((acc, i) => {
      const falta = (i.valorTotal || 0) - (i.valorPagoTotal || 0);
      return acc + (falta > 0 ? falta : 0);
    }, 0);

  const projecaoFutura = saldoAtual + entradasFuturas - despesasFuturas;

  const abertos = lista.filter((i) => i.status === "aberta").length;



  // Dízimos do mês atual
  const dizimosMes = lista.filter((i) => {
    if (i.tipoMovimento !== "entrada" || i.tipo !== "Dízimo" || !i.data) return false;
    const d = new Date(i.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalDizimosMes = dizimosMes.reduce(
    (acc, i) => acc + (i.valorRecebidoTotal || i.valorTotal || 0),
    0
  );

  const mediaDizimosMes =
    dizimosMes.length > 0 ? totalDizimosMes / dizimosMes.length : 0;



  // 1. Monta os itens do resumo
  const resumoItens = [

    {
      id: "1",
      label: "A receber",
      value: `R$ ${formatoMoeda.format(entradasFuturas)}`,
    },
    {
      id: "2",
      label: "A pagar",
      value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
    },
    {
      id: "3",
      label: "Média de dízimos (mês)",
      value: `R$ ${formatoMoeda.format(mediaDizimosMes)}`,
    },
    {
      id: "4",
      label: "Registros pendentes",
      value: `${abertos}`,
    },
    {
      id: "5",
      label: "A pagar",
      value: `R$ ${formatoMoeda.format(despesasFuturas)}`,
    },
    {
      id: "6",
      label: "Média de dízimos (mês)",
      value: `R$ ${formatoMoeda.format(mediaDizimosMes)}`,
    },
    {
      id: "7",
      label: "Registros pendentes",
      value: `${abertos}`,
    },
  ];

  if (load && !refreshing) return <Load />

  return (
    <View
      style={styles.container}

    >
      <View style={styles.saldoCard}>
        <View style={styles.saldoItem}>
          <Text style={styles.saldoLabel}>Saldo Anterior</Text>
          <Text style={styles.saldoValorSecundario}>
            R$ {formatoMoeda.format(saldoAnterior)}
          </Text>
        </View>

        <View style={styles.divisorVertical} />

        <View style={styles.saldoItem}>
          <Text style={styles.saldoLabel}>Saldo Atual</Text>
          <Text style={styles.saldoValorPrincipal}>
            R$ {formatoMoeda.format(saldoAtual)}
          </Text>
        </View>

        <View style={styles.divisorVertical} />

        <View style={styles.saldoItem}>
          <Text style={styles.saldoLabel}>Projeção Futura</Text>
          <Text
            style={[
              styles.saldoValorSecundario,
            ]}
          >
            R$ {formatoMoeda.format(projecaoFutura)}
          </Text>
        </View>
      </View>



      <View style={styles.chartCard}>
        <Text style={styles.infoTitle}>Cabo de força</Text>
        <Text style={styles.chartSubtitle}>
          Quem puxa mais o saldo: entradas ou saídas
        </Text>

        <View style={styles.tugHeader}>
          <View>
            <Text style={styles.tugSideLabel}>Entradas</Text>
            <Text style={styles.tugSideValue}>
              R$ {formatoMoeda.format(totalEntradas)}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.tugSideLabel}>Saídas</Text>
            <Text style={[styles.tugSideValue]}>
              R$ {formatoMoeda.format(totalSaidas)}
            </Text>
          </View>
        </View>

        <View style={styles.tugTrack}>
          <View style={styles.tugEmpate} />
          <View
            style={[
              styles.tugEntrada,
              {
                flex: totalEntradas > 0 ? totalEntradas : 0.0001,
                backgroundColor: colors.principal,
              },
            ]}
          />
          <View style={styles.tugCenter} />
          <View
            style={[
              styles.tugSaida,
              {
                flex: totalSaidas > 0 ? totalSaidas : 0.0001,
                backgroundColor: colors.destaque,
              },
            ]}
          />
        </View>


      </View>





      <View style={styles.listaWrapper}>

      <View pointerEvents="none" style={styles.fadeTop}>
          <View style={[styles.fadeFaixa, { opacity: 1 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.9 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.7 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.5 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.3 }]} />
      </View>

        <FlatList
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.principal]}
            />
          }
          data={resumoItens}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.listaScroll}
          ListHeaderComponent={

            <Text style={styles.infoTitle}>Resumo geral</Text>
          }
          contentContainerStyle={styles.listaContent}
          renderItem={({ item }) => (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          )}
        />

        <View pointerEvents="none" style={styles.fadeBottom}>
          <View style={[styles.fadeFaixa, { opacity: 0.3 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.5 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.7 }]} />
          <View style={[styles.fadeFaixa, { opacity: 0.9 }]} />
          <View style={[styles.fadeFaixa, { opacity: 1 }]} />
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap:14,
    paddingVertical:14
  },

  saldoCard: {
    paddingVertical: 21,
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  saldoItem: {
    paddingHorizontal: 6,
    flex: 1,
    alignItems: "center",
  },
  divisorVertical: {
    width: 1,
    height: 35,
    backgroundColor: "#ececec",
  },
  saldoLabel: {
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
    fontFamily: "Roboto-Light",
  },
  saldoValorPrincipal: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
    textAlign: "center",
  },
  saldoValorSecundario: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    textAlign: "center",
  },
  saldoLegenda: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },

  // Cards de informação
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Roboto-Light",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    textAlign: "right",
  },

  // Cabo de força
  chartCard: {
    backgroundColor: "#fff",
    elevation: 3,
    borderRadius: 14,
    paddingHorizontal: 21,
    paddingVertical: 35,
    marginHorizontal: 14,
  },
  chartSubtitle: {
    fontSize: 13,
    fontFamily: "Roboto-Light",
    marginBottom: 16,
    marginTop: -6,
  },
  tugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  tugSideLabel: {
    fontSize: 12,
    fontFamily: "Roboto-Light",
    marginBottom: 2,
  },
  tugSideValue: {
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  tugTrack: {
    height: 5,
    borderRadius: 10,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor:'#ddd'
  },

  tugEmpate:{
  width:2,
  height:10,
  backgroundColor:'#fff',
  position:"absolute",
  marginLeft:'50%',
  marginRight:'50%',
  zIndex:99,
  
},
  tugEntrada: {
    height: "90%",
  },
  tugSaida: {
    height: "90%",
    alignSelf:'center'
  },
  tugCenter: {
    width: 3,
    backgroundColor: "#fff",
  },
  tugResult: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },

  // Últimos registros
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  link: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemTipo: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
    color: "#222",
  },
  itemData: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    marginTop: 3,
  },
  itemValor: {
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  empty: {
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    marginVertical: 16,
  },

  // Botão
  btn: {
    marginTop: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Roboto-Medium",
  },



  listaWrapper: {
    marginHorizontal: 14,
    padding: 21,
    height: 280, // altura visível da área de estatísticas
    position: "relative",
  },
  listaScroll: {
    flex: 1,
  },
  listaContent: {
    paddingTop: 35,
    paddingBottom: 35,
  },

  fadeBottom: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    zIndex: 2,
  },
    fadeTop: {
    position: 'absolute',
    zIndex: 2,
    left: 0,
    right: 0,
    top: 20,
    height: 28,
  },
  fadeFaixa: {
    height: 10,
    backgroundColor: "#fff",
  },
});
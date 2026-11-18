// src/screens/PaywallScreen.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConnection";
import { PLAN_CONFIG } from "../constants/appConfig";
import { gerarPagamentoPix, verificarStatusPagamento } from "../services/mercadoPagoService";
import { useAppAlert } from "../context/AlertContext";
import { calcularDataExpiracao, verificarStatusAssinatura } from "../utils/assinatura";
import { AppContext } from "../context/AppContext";

export default function PaywallScreen({ route }) {
  const { showAlert } = useAppAlert();
  const { igrejaAtiva, atualizarIgrejaLocal } = useContext(AppContext) || {};
  const { colors, dark } = useTheme();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [dadosPix, setDadosPix] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [statusPagamento, setStatusPagamento] = useState("");
  const [planoEscolhido, setPlanoEscolhido] = useState(null);

  const emailUsuario = route?.params?.emailUsuario || "tesoureiro@apptig.com";
  const nomeIgreja = igrejaAtiva?.nome || route?.params?.nomeIgreja || "Minha Igreja";

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;
  const border = colors.border || (dark ? "#333" : "#ececec");

  const lockConfig = PLAN_CONFIG.PREMIUM_LOCK || {};
  const lockColor = dark ? lockConfig.colorDark : lockConfig.colorLight;

  // Validação centralizada via PLAN_CONFIG
  const statusPlano = PLAN_CONFIG.verificarStatus(igrejaAtiva);
  const statusAssinatura = verificarStatusAssinatura(igrejaAtiva);
  const jaEhAtivo = statusAssinatura.isPremium;
  const textoStatus = statusAssinatura.tempoRestanteTexto;

  const tipoPlanoAtivo = statusPlano.tipo; // "TRIAL", "PAGO", "VITALICIO", "EXPIRADO"
  const ehVitalicio = tipoPlanoAtivo === "VITALICIO";

  // Informações dinâmicas extraídas diretamente de PLAN_CONFIG
  const limiteHistoricoGrats = PLAN_CONFIG.FREE_LIMITES.LIMITE_HISTORICO;
  const permiteCaixinhasGratis = PLAN_CONFIG.FREE_LIMITES.PERMITE_CAIXINHAS;
  const maxUsuariosGratis = PLAN_CONFIG.FREE_LIMITES.MAX_USUARIOS;

  const maxUsuariosPremium = PLAN_CONFIG.PREMIUM_LIMITES.MAX_USUARIOS;
  const diasTrialGratuito = PLAN_CONFIG.DIAS_TRIAL_GRATUITO;

  const valorMes = PLAN_CONFIG.PRECO_MES;
  const valorAnual = PLAN_CONFIG.PRECO_ANUAL;

  const valorTotalMensal12Meses = valorMes * 12;
  const economiaAnual = valorTotalMensal12Meses - valorAnual;
  const economiaFormatada = economiaAnual.toFixed(2).replace(".", ",");

  useEffect(() => {
    let tituloHeader = "Planos e Preços";
    if (tipoPlanoAtivo === "TRIAL") tituloHeader = "Período de Teste";
    else if (tipoPlanoAtivo === "PAGO" || tipoPlanoAtivo === "VITALICIO") tituloHeader = "Plano Premium";

    navigation.setOptions({
      headerShown: true,
      title: tituloHeader,
      headerTintColor: text,
    });
  }, [navigation, text, card, tipoPlanoAtivo]);

  const timestampExpiracao = igrejaAtiva?.dataExpiracaoPremium ? Number(igrejaAtiva.dataExpiracaoPremium) : null;
  const dataExpiracaoFormatada = timestampExpiracao && !isNaN(timestampExpiracao)
    ? new Date(timestampExpiracao).toLocaleDateString("pt-BR")
    : null;

  const handleAssinar = async (tipoPlano) => {
    setPlanoEscolhido(tipoPlano);
    setLoading(true);
    const valor =
      tipoPlano === "MENSAL" ? valorMes : valorAnual;

    const resultado = await gerarPagamentoPix({
      plano: tipoPlano,
      valor: valor,
      emailUsuario: emailUsuario,
      nomeIgreja: nomeIgreja,
      igrejaId: igrejaAtiva?.id,
    });

    setLoading(false);

    if (resultado.sucesso) {
      setDadosPix(resultado);
      setPaymentId(resultado.paymentId);
      setStatusPagamento(resultado.status);
    } else {
      showAlert({
        title: "Erro no Pagamento",
        message: resultado.erro,
        buttons: [{ text: "OK" }],
      });
    }
  };

  useEffect(() => {
    let intervalo = null;

    if (paymentId && statusPagamento !== "approved") {
      intervalo = setInterval(async () => {
        const verificacao = await verificarStatusPagamento(paymentId);
        setStatusPagamento(verificacao.status);

        if (verificacao.aprovado) {
          clearInterval(intervalo);

          const novaExpiracao = calcularDataExpiracao(planoEscolhido);

          try {
            if (igrejaAtiva?.id) {
              const igrejaRef = doc(db, "igrejas", igrejaAtiva.id);
              await updateDoc(igrejaRef, {
                isPremium: true,
                dataExpiracaoPremium: novaExpiracao,
              });
            }
          } catch (e) {
            console.log("Erro ao salvar assinatura no Firestore:", e);
          }

          if (typeof atualizarIgrejaLocal === "function") {
            atualizarIgrejaLocal({
              isPremium: true,
              dataExpiracaoPremium: novaExpiracao,
            });
          }

          showAlert({
            title: "Pagamento Aprovado! 🎉",
            message: "Seu acesso completo foi liberado com sucesso.",
            buttons: [
              {
                text: "OK",
                onPress: () => {
                  if (navigation && navigation.goBack) {
                    navigation.goBack();
                  }
                },
              },
            ],
          });
        }
      }, 4000);
    }

    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }, [paymentId, statusPagamento, planoEscolhido, igrejaAtiva]);

  const copiarCodigoPix = () => {
    if (dadosPix?.qrCode) {
      try {
        const Clipboard = require("react-native").Clipboard || require("@react-native-clipboard/clipboard").default;
        Clipboard.setString(dadosPix.qrCode);
        showAlert({
          title: "Copiado!",
          message: "Código Pix Copia e Cola copiado com sucesso. Cole no aplicativo do seu banco.",
          buttons: [{ text: "OK" }],
        });
      } catch (e) {
        console.log("Erro ao copiar:", e);
      }
    }
  };

  let tituloCard = "Desbloqueie o App Completo";
  let subtituloCard = "Libere relatórios em PDF ilimitados, criação de caixinhas e todas as funções avançadas para a sua igreja.";
  let tituloBoxAtivo = "Plano Ativo";

  if (tipoPlanoAtivo === "TRIAL") {
    tituloCard = "Teste Gratuito";
    subtituloCard = `Aproveite todas as funcionalidades avançadas para ${nomeIgreja} durante os dias de avaliação.`;
    tituloBoxAtivo = "Status: Período de Teste";
  } else if (tipoPlanoAtivo === "PAGO") {
    tituloCard = "Sua Igreja é Premium!";
    subtituloCard = `Parabéns! Todos os recursos avançados e relatórios ilimitados estão ativos para ${nomeIgreja}.`;
    tituloBoxAtivo = "Plano Premium Ativo";
  } else if (tipoPlanoAtivo === "VITALICIO") {
    tituloCard = "Acesso Vitalício Ativo";
    subtituloCard = `Sua igreja possui acesso permanente e ilimitado a todas as ferramentas de gestão.`;
    tituloBoxAtivo = "Plano Definitivo";
  } else if (tipoPlanoAtivo === "EXPIRADO") {
    tituloCard = "Seu Período Expirou";
    subtituloCard = "Para continuar utilizando os recursos avançados e gerando relatórios, escolha um plano abaixo.";
    tituloBoxAtivo = "Acesso Bloqueado";
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.block, { backgroundColor: card }]}>
          <View style={styles.headerBox}>
            {/* {jaEhAtivo && (
              <View style={[styles.iconHeaderBox, { backgroundColor: lockColor + "15" }]}>
                <Ionicons name={lockConfig.icon || "sparkles"} size={32} color={lockColor} />
              </View>
            )} */}

            {/* <Text style={[styles.title, { color: text }]}>
              {jaEhAtivo ? tituloCard : (tipoPlanoAtivo === "EXPIRADO" ? tituloCard : "Desbloqueie o App Completo")}
            </Text> */}
            <Text style={[styles.subtitle, { color: muted }]}>
              {jaEhAtivo ? subtituloCard : subtituloCard}
            </Text>
          </View>

          {jaEhAtivo ? (
            <View style={styles.premiumAtivoContainer}>
              <View style={[styles.statusBoxAtivoElegante, { borderColor: principal, backgroundColor: principal + "10" }]}>
                <View style={[styles.statusIconWrap, { backgroundColor: principal + "20" }]}>
                  <Ionicons name="shield-checkmark" size={22} color={principal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusAtivoTitulo, { color: principal }]}>{tituloBoxAtivo}</Text>
                  <Text style={[styles.statusAtivoDescricaoElegante, { color: text }]}>
                    {textoStatus}
                  </Text>
                  {dataExpiracaoFormatada && (
                    <Text style={[styles.statusAtivoDataElegante, { color: muted }]}>
                      Válido até: <Text style={{ fontFamily: "Roboto-Bold", color: text }}>{dataExpiracaoFormatada}</Text>
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ) : !dadosPix ? (
            <View style={styles.planosContainer}>
              {!ehVitalicio && (
                <View style={styles.comparativoWrapper}>
                  <Text style={[styles.comparativoHeaderTitle, { color: text }]}>Conheça os Planos</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carrosselContainer}
                  >
                    {/* 1. Card Limitado / Grátis */}
                    <View style={[styles.cardComparativo, { borderColor: border, backgroundColor: dark ? "#202020" : "#fafafa" }]}>
                      <View style={styles.cardTopContent}>
                        <View style={[styles.badgePlanoType, { backgroundColor: muted + "20" }]}>
                          <Text style={[styles.badgePlanoTypeText, { color: muted }]}>ATUAL</Text>
                        </View>
                        <Text style={[styles.comparativoTitulo, { color: text }]}>Grátis</Text>
                        <View style={styles.comparativoTopicos}>
                          <View style={styles.topicoRow}>
                            <Ionicons name="time" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: muted }]}>{diasTrialGratuito} dias grátis</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: muted }]}>Até {limiteHistoricoGrats} históricos</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name={permiteCaixinhasGratis ? "checkmark-circle" : "close-circle"} size={16} color={permiteCaixinhasGratis ? principal : "#ef4444"} />
                            <Text style={[styles.topicoText, { color: muted }]}>Caixinhas {permiteCaixinhasGratis ? "liberadas" : "bloqueadas"}</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="people" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: muted }]}>Até {maxUsuariosGratis} {maxUsuariosGratis === 1 ? 'usuário' : 'usuários'}</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="close-circle" size={16} color="#ef4444" />
                            <Text style={[styles.topicoText, { color: muted }]}>Sem relatórios PDF</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.cardFooterArea}>
                        <Text style={[styles.cardPrecoTexto, { color: muted }]}>R$ 0,00</Text>
                      </View>
                    </View>

                    {/* 2. Card Básico (30 dias) */}
                    <View style={[styles.cardComparativo, { borderColor: border, backgroundColor: dark ? "#252525" : "#fcfcfc" }]}>
                      <View style={styles.cardTopContent}>
                        <View style={[styles.badgePlanoType, { backgroundColor: principal + "20" }]}>
                          <Text style={[styles.badgePlanoTypeText, { color: principal }]}>POPULAR</Text>
                        </View>
                        <Text style={[styles.comparativoTitulo, { color: text }]}>Básico</Text>
                        <View style={styles.comparativoTopicos}>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Validade: 30 dias</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Histórico Ilimitado</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Caixinhas e Reservas</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="people" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Até {maxUsuariosPremium} usuários</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Relatórios em PDF</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.cardFooterArea}>
                        <Text style={[styles.cardPrecoValor, { color: principal }]}>
                          R$ {valorMes.toFixed(2).replace(".", ",")}
                        </Text>
                        <TouchableOpacity
                          style={[styles.queroEsseBtn, { backgroundColor: principal }]}
                          onPress={() => handleAssinar("MENSAL")}
                          disabled={loading}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.queroEsseBtnTextDestaque}>Quero Esse</Text>
                          <Ionicons name="arrow-forward" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 3. Card Premium (1 ano) */}
                    <View style={[styles.cardComparativo, styles.cardComparativoDestaque, { borderColor: principal, backgroundColor: principal + "06" }]}>
                      <View style={styles.cardTopContent}>
                        <View style={[styles.badgePlanoType, { backgroundColor: principal }]}>
                          <Text style={[styles.badgePlanoTypeTextDestaque]}>MELHOR VALOR</Text>
                        </View>
                        <Text style={[styles.comparativoTitulo, { color: text }]}>Premium</Text>
                        <View style={styles.comparativoTopicos}>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Validade: 1 ano</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Histórico Ilimitado</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Caixinhas e Reservas</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="people" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Até {maxUsuariosPremium} usuários</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="checkmark-circle" size={16} color={principal} />
                            <Text style={[styles.topicoText, { color: text }]}>Relatórios em PDF</Text>
                          </View>
                          <View style={styles.topicoRow}>
                            <Ionicons name="pricetag" size={16} color={principal} />
                            <Text style={[styles.topicoTextDestaque, { color: principal }]}>
                              Economia de R$ {economiaFormatada}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.cardFooterArea}>
                        <Text style={[styles.cardPrecoValor, { color: principal }]}>
                          R$ {valorAnual.toFixed(2).replace(".", ",")}
                        </Text>
                        <TouchableOpacity
                          style={[styles.queroEsseBtn, { backgroundColor: principal }]}
                          onPress={() => handleAssinar("ANUAL")}
                          disabled={loading}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.queroEsseBtnTextDestaque}>Quero Esse</Text>
                          <Ionicons name="arrow-forward" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              )}

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={principal} />
                  <Text style={[styles.loadingText, { color: muted }]}>Gerando seu Pix...</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.pixContainer}>
              <Text style={[styles.pixInstrucao, { color: text }]}>
                Escaneie o QR Code abaixo ou copie o código Pix para pagar no app do seu banco:
              </Text>

              {dadosPix.qrCodeBase64 && (
                <View style={[styles.qrCodeWrapper, { borderColor: border }]}>
                  <Image
                    source={{ uri: `data:image/png;base64,${dadosPix.qrCodeBase64}` }}
                    style={styles.qrCodeImage}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.pdfBtn, { backgroundColor: principal }]}
                onPress={copiarCodigoPix}
                activeOpacity={0.85}
              >
                <Ionicons name="copy-outline" size={20} color="#fff" />
                <Text style={styles.pdfBtnText}>Copiar Código Pix (Copia e Cola)</Text>
              </TouchableOpacity>

              <View style={styles.statusBox}>
                <ActivityIndicator size="small" color={muted} />
                <Text style={[styles.statusText, { color: muted }]}>
                  Aguardando pagamento... ({statusPagamento})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={() => {
                  setDadosPix(null);
                  setPaymentId(null);
                  setPlanoEscolhido(null);
                }}
              >
                <Text style={styles.botaoCancelarText}>Escolher outro plano</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40, paddingHorizontal: 14, paddingTop: 12 },
  block: { borderRadius: 18 },
  headerBox: { alignItems: "center", marginBottom: 20, padding: 14 },
  iconHeaderBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Roboto-Bold", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: "Roboto-Regular", textAlign: "center", lineHeight: 18, paddingHorizontal: 8 },
  
  premiumAtivoContainer: { width: "100%", alignItems: "center", marginTop: 4, paddingHorizontal: 4 },
  statusBoxAtivoElegante: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", borderWidth: 1, borderRadius: 14, padding: 14 },
  statusIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusAtivoTitulo: { fontSize: 12, fontFamily: "Roboto-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  statusAtivoDescricaoElegante: { fontSize: 14, fontFamily: "Roboto-Medium", marginTop: 2, lineHeight: 18 },
  statusAtivoDataElegante: { fontSize: 12, fontFamily: "Roboto-Regular", marginTop: 3 },
  
  comparativoWrapper: { width: "100%", marginBottom: 6 },
  comparativoHeaderTitle: { fontSize: 15, fontFamily: "Roboto-Bold", marginBottom: 12, textAlign: "left", paddingHorizontal: 14 },
  carrosselContainer: { gap: 14, paddingBottom: 6, paddingHorizontal: 14, alignItems: "stretch" },
  
  cardComparativo: { width: 205, borderWidth: 1, borderRadius: 16, padding: 14, justifyContent: "space-between", height: 385 },
  cardComparativoDestaque: { borderWidth: 1.5 },
  cardTopContent: { flex: 1 },
  
  badgePlanoType: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  badgePlanoTypeText: { fontSize: 11, fontFamily: "Roboto-Bold" },
  badgePlanoTypeTextDestaque: { color: "#fff", fontSize: 11, fontFamily: "Roboto-Bold" },
  
  comparativoTitulo: { fontSize: 18, fontFamily: "Roboto-Bold", marginBottom: 10 },
  
  comparativoTopicos: { gap: 8, marginTop: 4 },
  topicoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  topicoText: { fontSize: 12, fontFamily: "Roboto-Regular" },
  topicoTextDestaque: { fontSize: 12, fontFamily: "Roboto-Bold" },
  
  cardFooterArea: { height: 48, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#646363ff", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPrecoTexto: { fontSize: 14, fontFamily: "Roboto-Bold" },
  cardPrecoValor: { fontSize: 13, fontFamily: "Roboto-Bold" },
  
  queroEsseBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  queroEsseBtnTextDestaque: { color: "#fff", fontSize: 11, fontFamily: "Roboto-Bold" },

  planosContainer: { width: "100%", gap: 12 },
  loadingContainer: { marginTop: 16, alignItems: "center" },
  loadingText: { marginTop: 8, fontFamily: "Roboto-Regular", fontSize: 13 },
  pixContainer: { alignItems: "center", width: "100%", paddingTop: 4 },
  pixInstrucao: { fontSize: 13, fontFamily: "Roboto-Regular", textAlign: "center", marginBottom: 16, lineHeight: 18 },
  qrCodeWrapper: { padding: 12, borderRadius: 14, borderStyle: "solid", borderWidth: 1, backgroundColor: "#fff", marginBottom: 16 },
  qrCodeImage: { width: 180, height: 180, resizeMode: "contain" },
  pdfBtn: { marginTop: 4, height: 50, width: "100%", borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  pdfBtnText: { color: "#fff", fontSize: 15, fontFamily: "Roboto-Bold" },
  statusBox: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  statusText: { fontFamily: "Roboto-Regular", fontSize: 12 },
  botaoCancelar: { padding: 8 },
  botaoCancelarText: { color: "#ef4444", fontSize: 13, fontFamily: "Roboto-Medium" },
});
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

  // Configura o título da página no header do React Navigation
  useEffect(() => {
    navigation.setOptions({
      headerShown: true, // Garante que o header apareça se desejar exibir o título nativo
      title: "Premium",
      headerTintColor: text,
      headerStyle: {
        backgroundColor: card,
      },
    });
  }, [navigation, text, card]);

  // Valida se o plano atual da igreja está ativo
  const statusAssinatura = verificarStatusAssinatura(igrejaAtiva);
  const jaEhPremium = statusAssinatura.isPremium;

  const dataExpiracaoFormatada = igrejaAtiva?.dataExpiracaoPremium
    ? new Date(Number(igrejaAtiva.dataExpiracaoPremium)).toLocaleDateString("pt-BR")
    : null;

  const valorTotalMensal12Meses = PLAN_CONFIG.PRECO_MES * 12;
  const economiaAnual = valorTotalMensal12Meses - PLAN_CONFIG.PRECO_ANUAL;
  const economiaFormatada = economiaAnual.toFixed(2).replace(".", ",");

  const handleAssinar = async (tipoPlano) => {
    setPlanoEscolhido(tipoPlano);
    setLoading(true);
    const valor =
      tipoPlano === "MENSAL" ? PLAN_CONFIG.PRECO_MES : PLAN_CONFIG.PRECO_ANUAL;

    const resultado = await gerarPagamentoPix({
      plano: tipoPlano,
      valor: valor,
      emailUsuario: emailUsuario,
      nomeIgreja: nomeIgreja,
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

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.block, { backgroundColor: card }]}>
          <View style={styles.headerBox}>
            <View style={[styles.iconHeaderBox, { backgroundColor: lockColor + "15" }]}>
              <Ionicons name={lockConfig.icon || "sparkles"} size={32} color={lockColor} />
            </View>
            <Text style={[styles.title, { color: text }]}>
              {jaEhPremium ? "Sua Igreja é Premium!" : "Desbloqueie o App Completo"}
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              {jaEhPremium
                ? `Parabéns! Todos os recursos avançados, caixinhas e relatórios ilimitados estão ativos para ${nomeIgreja}.`
                : "Libere relatórios em PDF ilimitados, criação de caixinhas e todas as funções avançadas para a sua igreja."}
            </Text>
          </View>

          {jaEhPremium ? (
            <View style={styles.premiumAtivoContainer}>
              <View style={[styles.statusBoxAtivo, { borderColor: principal, backgroundColor: principal + "10" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusAtivoTitulo, { color: text }]}>Plano Ativo</Text>
                  <Text style={[styles.statusAtivoDescricao, { color: muted }]}>
                    {dataExpiracaoFormatada
                      ? `Válido até ${dataExpiracaoFormatada}`
                      : "Acesso vitalício ou por período ativo"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.voltarBtn, { backgroundColor: principal }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <Text style={styles.voltarBtnText}>Voltar ao Início</Text>
              </TouchableOpacity>
            </View>
          ) : !dadosPix ? (
            <View style={styles.planosContainer}>
              <TouchableOpacity
                style={[styles.cardPlano, { borderColor: border, backgroundColor: dark ? "#252525" : "#fcfcfc" }]}
                onPress={() => handleAssinar("MENSAL")}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={styles.cardInfo}>
                  <Text style={[styles.planoNome, { color: text }]}>Acesso por 30 dias</Text>
                  <Text style={[styles.planoDetalhe, { color: muted }]}>Liberação imediata de todas as funções</Text>
                </View>
                <Text style={[styles.planoPreco, { color: principal }]}>
                  R$ {PLAN_CONFIG.PRECO_MES.toFixed(2).replace(".", ",")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cardPlano, styles.cardDestaque, { borderColor: principal, backgroundColor: principal + "08" }]}
                onPress={() => handleAssinar("ANUAL")}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={[styles.badgeEconomia, { backgroundColor: principal }]}>
                  <Text style={styles.badgeText}>MELHOR VALOR · 1 ANO</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.planoNome, { color: text }]}>Acesso por 1 ano</Text>
                  <Text style={[styles.planoDetalhe, { color: muted }]}>Funções completas por 365 dias</Text>
                  <Text style={[styles.textoEconomia, { color: principal }]}>
                    Você está economizando R$ {economiaFormatada}
                  </Text>
                </View>
                <Text style={[styles.planoPreco, { color: principal }]}>
                  R$ {PLAN_CONFIG.PRECO_ANUAL.toFixed(2).replace(".", ",")}
                </Text>
              </TouchableOpacity>

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
                <Text style={styles.botaoCancelarText}>Escolher outro período</Text>
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
  block: { borderRadius: 18, padding: 16 },
  headerBox: { alignItems: "center", marginBottom: 20, paddingTop: 8 },
  iconHeaderBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Roboto-Bold", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: "Roboto-Regular", textAlign: "center", lineHeight: 18, paddingHorizontal: 8 },
  premiumAtivoContainer: { width: "100%", alignItems: "center", gap: 16, marginTop: 8 },
  statusBoxAtivo: { flexDirection: "row", alignItems: "center", gap: 14, width: "100%", borderWidth: 1, borderRadius: 14, padding: 16 },
  statusAtivoTitulo: { fontSize: 15, fontFamily: "Roboto-Bold" },
  statusAtivoDescricao: { fontSize: 12, fontFamily: "Roboto-Regular", marginTop: 2 },
  voltarBtn: { height: 50, width: "100%", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  voltarBtnText: { color: "#fff", fontSize: 15, fontFamily: "Roboto-Bold" },
  planosContainer: { width: "100%", gap: 12 },
  cardPlano: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, padding: 16 },
  cardDestaque: { borderWidth: 1.5 },
  badgeEconomia: { position: "absolute", top: -10, right: 16, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: "Roboto-Bold" },
  cardInfo: { flex: 1, paddingRight: 10 },
  planoNome: { fontSize: 15, fontFamily: "Roboto-Bold" },
  planoDetalhe: { fontSize: 12, fontFamily: "Roboto-Regular", marginTop: 2 },
  textoEconomia: { fontSize: 11, fontFamily: "Roboto-Bold", marginTop: 4 },
  planoPreco: { fontSize: 18, fontFamily: "Roboto-Bold" },
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
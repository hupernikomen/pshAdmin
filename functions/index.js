const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Coloque o mesmo Access Token de Produção do seu mercadoPagoService.js
const MP_ACCESS_TOKEN = "APP_USR-1753230368810875-110710-251b3962190a747a39c04206cbd4c0d2-291045128";

exports.mercadoPagoWebhook = onRequest(async (req, res) => {
  // O Mercado Pago envia o ID do pagamento na query (?data.id=123) ou no body
  const topic = req.query.topic || req.query.type || req.body?.type;
  const paymentId = req.query["data.id"] || req.query.id || req.body?.data?.id;

  if (topic === "payment" && paymentId) {
    try {
      // 1. Consulta os detalhes reais do pagamento direto no Mercado Pago
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      });

      const paymentData = await response.json();

      // 2. Verifica se o pagamento foi realmente aprovado
      if (paymentData.status === "approved") {
        const igrejaId = paymentData.external_reference || paymentData.metadata?.igreja_id;
        const plano = paymentData.metadata?.plano || "MENSAL";

        if (igrejaId) {
          // Calcula a nova data de expiração (mesma lógica do utils/assinatura.js)
          const agora = new Date();
          if (plano === "ANUAL") {
            agora.setDate(agora.getDate() + 365);
          } else {
            agora.setDate(agora.getDate() + 30);
          }
          const novaExpiracao = agora.getTime();

          // 3. Atualiza o documento da igreja no Firestore na nuvem
          const igrejaRef = db.collection("igrejas").doc(igrejaId);
          await igrejaRef.update({
            isPremium: true,
            dataExpiracaoPremium: novaExpiracao,
            ultimoPagamentoId: String(paymentId),
            ultimoPagamentoEm: Date.now(),
          });

          console.log(`Sucesso: Igreja ${igrejaId} liberada (Plano ${plano}, Pagamento ${paymentId}).`);
        }
      }
    } catch (error) {
      console.error("Erro ao processar webhook do Mercado Pago:", error);
      return res.status(500).send("Erro interno");
    }
  }

  // Sempre retorna 200 OK para o Mercado Pago não ficar reenviando a notificação
  return res.status(200).send("OK");
});
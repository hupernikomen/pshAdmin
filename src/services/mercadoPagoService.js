// src/services/mercadoPagoService.js

// ATENÇÃO: Em produção idealmente isso fica em um backend seguro para não expor seu Access Token,
// mas para testes diretos no app, você pode colocar seu Access Token de Produção/Teste do Mercado Pago aqui.
const ACCESS_TOKEN = "APP_USR-1753230368810875-110710-251b3962190a747a39c04206cbd4c0d2-291045128";  // Produção
// const ACCESS_TOKEN = "APP_USR-304393783626850-110710-bc36ec801aabcc6bc71d195943d18710-3821189963";  // Teste

export async function gerarPagamentoPix({ plano, valor, emailUsuario, nomeIgreja }) {
  const dadosPagamento = {
    transaction_amount: Number(valor),
    description: `Assinatura TIG - Plano ${plano} (${nomeIgreja || "Igreja"})`,
    payment_method_id: "pix",
    payer: {
      email: emailUsuario || "tesoureiro@apptig.com",
    },
  };

  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${Date.now()}` // Evita cobrança duplicada
      },
      body: JSON.stringify(dadosPagamento),
    });

    const data = await response.json();

    if (data.status && data.point_of_interaction) {
      return {
        sucesso: true,
        paymentId: data.id,
        qrCode: data.point_of_interaction.transaction_data.qr_code, // O Pix Copia e Cola
        qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64, // Imagem em Base64 do QR Code
        status: data.status // Ex: "pending"
      };
    } else {
      return { 
        sucesso: false, 
        erro: data.message || data. cauza?.[0]?.description || "Erro ao gerar cobrança Pix." 
      };
    }
  } catch (error) {
    console.error("Erro na requisição Pix Mercado Pago:", error);
    return { sucesso: false, erro: "Não foi possível conectar ao Mercado Pago." };
  }
}

export async function verificarStatusPagamento(paymentId) {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const data = await response.json();
    
    return {
      status: data.status, // "approved", "pending", "rejected", etc.
      aprovado: data.status === "approved"
    };
  } catch (error) {
    console.error("Erro ao verificar status do pagamento:", error);
    return { aprovado: false, status: "error" };
  }
}
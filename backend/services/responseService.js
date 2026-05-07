// IMPORTANTE: Importe a função SEGURA de envio, não o getClientSession
import { sendWWebJSMessage } from './wwebjsService.js';
import { sendWhatsAppMessage } from './twilioService.js'; // Se tiver o Twilio

/* Envia uma mensagem unificada, independente do provedor.
   @param {string} to - Número de destino (ex: 5511999999999)
   @param {string} message - Texto da mensagem
   @param {string} provider - 'wwebjs' ou 'twilio'
   @param {string} businessId - ID da empresa (obrigatório para WWebJS)
 */
async function sendUnifiedMessage(to, message, provider, businessId) {
  try {
    // console.log(`📤 Enviando via [${provider.toUpperCase()}] para ${to}`);

    if (provider === 'wwebjs') {
      if (!businessId) {
        console.error('❌ Erro: Tentativa de envio WWebJS sem businessId definido.');
        return false;
      }
      return await sendWWebJSMessage(businessId, to, message);
    } 
    else if (provider === 'twilio') {
       return await sendWhatsAppMessage(to, message);
    }
  } catch (error) {
    console.error(`💥 Erro ao enviar mensagem unificada (${provider}):`, error.message);
    return false; // Retorna false para quem chamou saber que falhou
  }
}

export { sendUnifiedMessage };
// IMPORTANTE: Importe a função SEGURA de envio, não o getClientSession
import { sendText } from './whatsapp/client.js';
import { sendWhatsAppMessage } from './twilioService.js'; // Se tiver o Twilio

/* Envia uma mensagem unificada, independente do provedor.
   @param {string} to - Número de destino (ex: 5511999999999)
   @param {string} message - Texto da mensagem
   @param {string} provider - 'wwebjs' (via squamata-whatsapp) ou 'twilio'
   @param {string} businessId - ID da empresa (obrigatório para o serviço Go)

   Nota (D14): durante a migração o valor persistido continua 'wwebjs', agora
   significando "via squamata-whatsapp". O rename fica para a fase F8.
 */
async function sendUnifiedMessage(to, message, provider, businessId) {
  try {
    // console.log(`📤 Enviando via [${provider.toUpperCase()}] para ${to}`);

    if (provider === 'wwebjs' || provider === 'squamata') {
      if (!businessId) {
        console.error('❌ Erro: Tentativa de envio pelo squamata-whatsapp sem businessId definido.');
        return false;
      }
      return await sendText(businessId, to, message);
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
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';

async function saveMessage(identifier, role, content, messageType = 'text', visionResult = null, businessId, channel = 'whatsapp', pushName = null) {
  try {
    if (!businessId) {
      console.error("❌ ERRO GRAVE: Tentativa de salvar mensagem sem businessId!");
      return;
    }

    // 1. Busca ou Cria contato
    let query = { businessId };
    if (channel === 'web') {
        query.sessionId = identifier;
    } else {
        query.phone = identifier;
    }

    let contact = await Contact.findOne(query);

    // AUTO-UPDATE NAME LOGIC
    // Se temos um pushName válido (vindo do WhatsApp) e o nome atual é genérico ou número, atualizamos.
    if (contact && role === 'user' && pushName && pushName !== 'Cliente' && pushName !== 'Visitante') {
        const currentName = contact.name || '';
        const isGeneric = ['Visitante', 'Cliente', 'Visitante Web'].includes(currentName);
        // Verifica se é número (remove não dígitos e compara, ou regex básico)
        const isPhone = (contact.phone && currentName.replace(/\D/g, '') === contact.phone.replace(/\D/g, '')) || /^\+?\d[\d\s-]*$/.test(currentName);

        if (isGeneric || isPhone) {
            console.log(`📝 Auto-updating contact name from "${currentName}" to "${pushName}"`);
            contact.name = pushName;
            // O save() final já vai persistir isso junto com outras mudanças
        }
    }

    if (!contact) {
      // Create new contact
      const newContactData = {
        businessId,
        totalMessages: 0,
        followUpStage: 0,
        followUpActive: false,
        channel
      };

      if (channel === 'web') {
          newContactData.sessionId = identifier;
          newContactData.name = 'Visitante Web';
          delete newContactData.phone; // Garantir que não envia null
      } else {
          newContactData.phone = identifier;
          // Se tivermos o pushName logo de cara, já usamos
          if (pushName && pushName !== 'Cliente' && pushName !== 'Visitante') {
             newContactData.name = pushName;
          }
          // Name defaults to Visitante if not provided (handled by Schema default)
      }

      contact = await Contact.create(newContactData);
    }

    // 2. Atualiza estatísticas básicas
    contact.totalMessages += 1;
    contact.lastInteraction = new Date();
    contact.lastSender = role;

    // === 3. LÓGICA DO FOLLOW-UP (A CORREÇÃO) ===
    
    if (role === 'user') {
      // CENÁRIO: Cliente falou
      // Ação: O cliente quebrou o silêncio. Paramos de perseguir.
      contact.followUpStage = 0; 
      contact.followUpActive = false; // Desativa o scheduler para este contato
      console.log(`👤 [${identifier}] Cliente respondeu. Follow-up pausado.`);
    } 
    else if (role === 'bot') {
      // CENÁRIO: Bot falou (resposta da IA ou mensagem automática)
      // Ação: Começamos a contar o tempo para o cliente responder.
      contact.followUpActive = true; // Ativa o scheduler
      contact.lastResponseTime = new Date(); // O relógio começa AGORA
      console.log(`🤖 [${identifier}] Bot respondeu. Follow-up armado.`);
    }

    // Salva as alterações no Contato
    await contact.save();

    // 4. Cria o registro da mensagem no histórico
    const msgData = {
      contactId: contact._id,
      role,
      content,
      messageType,
      channel
    };

    if (channel === 'web') {
        msgData.sessionId = identifier;
    } else {
        msgData.phone = identifier;
    }

    if (visionResult) {
      msgData.aiAnalysis = {
        isAnalyzed: true,
        description: visionResult,
        modelUsed: 'gemini-2.5-flash'
      };
    }

    await Message.create(msgData);

  } catch (error) {
    console.error('💥 Erro ao salvar mensagem:', error);
  }
}

async function getImageHistory(identifier, businessId, channel = 'whatsapp') {
  try {
    if (!businessId) return [];

    let query = { businessId };
    if (channel === 'web') {
        query.sessionId = identifier;
    } else {
        query.phone = identifier;
    }

    const contact = await Contact.findOne(query);
    if (!contact) return [];

    return await Message.find({
      contactId: contact._id,
      'aiAnalysis.isAnalyzed': true
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('content aiAnalysis timestamp')
      .lean();
  } catch (error) {
    console.error('Erro ao buscar histórico de imagens:', error);
    return [];
  }
}

async function getLastMessages(identifier, limit = 15, businessId, channel = 'whatsapp') {
  try {
    if (!businessId) return [];

    let query = { businessId };
    if (channel === 'web') {
        query.sessionId = identifier;
    } else {
        query.phone = identifier;
    }

    const contact = await Contact.findOne(query);
    if (!contact) return [];

    return await Message.find({ contactId: contact._id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('💥 Erro ao buscar mensagens:', error);
    return [];
  }
}

// === ADMIN CHAT (Fase 3) ===

async function getConversations(businessId) {
  try {
    // Busca contatos do negócio ordenados por última interação
    const contacts = await Contact.find({ businessId })
      .sort({ lastInteraction: -1 })
      .select('_id name phone channel lastInteraction sessionId avatarUrl tags isHandover funnelStage dealValue notes') // Projection
      .lean();

    return contacts;
  } catch (error) {
    console.error('Erro getConversations:', error);
    return [];
  }
}

async function getMessagesForContact(contactId, businessId) {
  try {
    // 1. Validar propriedade (Segurança)
    const contact = await Contact.findOne({ _id: contactId, businessId });
    if (!contact) throw new Error('Contato não encontrado ou não pertence a este negócio.');

    // 2. Buscar histórico
    const messages = await Message.find({ contactId: contact._id })
      .sort({ timestamp: 1 }) // Ordem cronológica para chat
      .lean();

    return messages;
  } catch (error) {
    console.error('Erro getMessagesForContact:', error);
    throw error;
  }
}

async function deleteMessages(contactId, businessId) {
  try {
    const contact = await Contact.findOne({ _id: contactId, businessId });
    if (!contact) throw new Error('Unauthorized or not found');

    await Message.deleteMany({ contactId: contact._id });

    // Reset basic stats but keep the contact
    contact.totalMessages = 0;
    contact.lastInteraction = new Date(); // Updates interaction so it doesn't disappear from top
    contact.lastSender = null; // Reset last sender
    await contact.save();

    return true;
  } catch (error) {
    console.error('Erro deleteMessages:', error);
    throw error;
  }
}

export { saveMessage, getImageHistory, getLastMessages, getConversations, getMessagesForContact, deleteMessages };

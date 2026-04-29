import express from 'express';
const router = express.Router();
import BusinessConfig from '../models/BusinessConfig.js';
import IndustryPreset from '../models/IndustryPreset.js';
import CustomPrompt from '../models/CustomPrompt.js';
import Contact from '../models/Contact.js';
import Tag from '../models/Tag.js';
import authenticateToken from '../middleware/auth.js';
import * as messageService from '../services/message.js';
import { sendWWebJSMessage } from '../services/wwebjsService.js';
import axios from 'axios';

// === CONFIGURAÇÕES GERAIS ===

// GET /api/business/tags
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Negócio não encontrado' });

    const tags = await Tag.find({ businessId: config._id }).sort({ name: 1 });
    res.json(tags);
  } catch (error) {
    console.error('Erro GET /tags:', error);
    res.status(500).json({ message: 'Erro ao buscar tags' });
  }
});

// GET /api/business/config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    // DO NOT return legacy tags (availableTags). Use Tag collection instead.
    let config = await BusinessConfig.findOne({ userId: req.user.userId }).select('-availableTags');

    // Se não existir, cria um padrão
    if (!config) {
      config = await BusinessConfig.create({ userId: req.user.userId, businessName: 'Meu Negócio' });
    } else {
      // Lazy Migration: Ensure new fields exist
      let dirty = false;
      if (!config.aiResponseMode) { config.aiResponseMode = 'all'; dirty = true; }
      if (!config.aiWhitelistTags) { config.aiWhitelistTags = []; dirty = true; }
      if (!config.aiBlacklistTags) { config.aiBlacklistTags = []; dirty = true; }

      if (dirty) await config.save();
    }

    res.json(config);
  } catch (error) {
    console.error('Erro GET config:', error);
    res.status(500).json({ message: 'Erro config' });
  }
});

router.put('/config', authenticateToken, async (req, res) => {
  try {
    console.log('📦 [PUT Config] Atualizando configurações para o usuário:', req.user.userId);

    // Criamos o payload de atualização. 
    // Removemos toda a lógica antiga de comparação e deleção de imagens do Firebase
    const updatePayload = {
      ...req.body,
      updatedAt: new Date()
    };

    // O comando findOneAndUpdate com 'upsert: true' cria o registro caso ele não exista
    const config = await BusinessConfig.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updatePayload },
      { new: true, upsert: true }
    );

    console.log('💾 [PUT Config] Configurações salvas com sucesso no MongoDB');
    res.json(config);
  } catch (error) {
    console.error('❌ Erro no PUT /api/business/config:', error);
    res.status(500).json({ message: 'Erro ao salvar configurações do negócio' });
  }
});

// === PRESETS (NICHOS DE MERCADO) ===

// GET /api/business/presets
router.get('/presets', authenticateToken, async (req, res) => {
  try {
    const presets = await IndustryPreset.find({}).select('key name icon botName toneOfVoice customInstructions').sort({ name: 1 });
    res.json(presets);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar presets' });
  }
});

// POST /api/business/apply-preset
router.post('/apply-preset', authenticateToken, async (req, res) => {
  try {
    const { presetKey } = req.body;
    const preset = await IndustryPreset.findOne({ key: presetKey });

    if (!preset) return res.status(404).json({ message: 'Modelo não encontrado' });

    const updatedConfig = await BusinessConfig.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: {
          botName: preset.botName,
          toneOfVoice: preset.toneOfVoice,
          customInstructions: preset.customInstructions,
          'prompts.chatSystem': preset.prompts?.chatSystem || "",
          'prompts.visionSystem': preset.prompts?.visionSystem || "",
          followUpSteps: preset.followUpSteps
        }
      },
      { new: true }
    );
    res.json({ message: 'Personalidade aplicada!', config: updatedConfig });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao aplicar preset' });
  }
});

// === MEUS MODELOS (CUSTOM PROMPTS) ===

// GET /api/business/custom-prompts
router.get('/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const prompts = await CustomPrompt.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar modelos' });
  }
});

// POST /api/business/custom-prompts
router.post('/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const {
      name, prompts, followUpSteps,
      botName, toneOfVoice, customInstructions,
      aiResponseMode, aiWhitelistTags, aiBlacklistTags
    } = req.body;

    const newPrompt = await CustomPrompt.create({
      userId: req.user.userId,
      name, prompts, followUpSteps,
      botName, toneOfVoice, customInstructions,
      aiResponseMode, aiWhitelistTags, aiBlacklistTags
    });
    res.json(newPrompt);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Nome duplicado.' });
    res.status(500).json({ message: 'Erro ao salvar modelo' });
  }
});

// DELETE /api/business/custom-prompts/:id
router.delete('/custom-prompts/:id', authenticateToken, async (req, res) => {
  try {
    await CustomPrompt.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Modelo removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' });
  }
});

// ==========================================
// 🔔 ROTAS DE REGRAS DE NOTIFICAÇÃO (Fase 2)
// ==========================================

// POST /api/business/config/notifications
router.post('/config/notifications', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    const newRule = {
      id: uuidv4(),
      ...req.body // name, triggerOffset, etc.
    };

    if (!config.notificationRules) config.notificationRules = [];
    config.notificationRules.push(newRule);

    await config.save();
    res.json(newRule);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao adicionar regra');
  }
});

// PUT /api/business/config/notifications/:ruleId
router.put('/config/notifications/:ruleId', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    if (!config.notificationRules) config.notificationRules = [];
    const ruleIndex = config.notificationRules.findIndex(r => r.id === req.params.ruleId);

    if (ruleIndex === -1) return res.status(404).json({ message: 'Regra não encontrada' });

    // Atualiza campos permitidos
    const fields = ['name', 'triggerOffset', 'triggerUnit', 'triggerDirection', 'messageTemplate', 'isActive'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        config.notificationRules[ruleIndex][f] = req.body[f];
      }
    });

    await config.save();
    res.json(config.notificationRules[ruleIndex]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao editar regra');
  }
});

// DELETE /api/business/config/notifications/:ruleId
router.delete('/config/notifications/:ruleId', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    if (config.notificationRules) {
      config.notificationRules = config.notificationRules.filter(r => r.id !== req.params.ruleId);
      await config.save();
    }

    res.json({ message: 'Regra removida' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao remover regra');
  }
});

// ==========================================
// 📸 ROTA DE UPLOAD DE IMAGEM (FIREBASE)
router.post('/request-upload-url', authenticateToken, async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({ message: 'Nome do arquivo e contentType são obrigatórios.' });
    }

    const squamataUrl = process.env.REACT_APP_SQUAMATA_UPLOAD_API_URL || 'http://localhost:3005';
    const squamataKey = process.env.REACT_APP_SQUAMATA_UPLOAD_API_KEY;

    if (!squamataKey) {
      return res.status(500).json({ message: 'Serviço de upload não configurado' });
    }

    // Chama Squamata para gerar URL assinada (para PUT)
    const response = await axios.post(
      `${squamataUrl}/generate-upload-url`,
      { fileName, contentType },
      { headers: { 'Authorization': squamataKey } }
    );

    // Constrói URL pública para download (sem assinatura - nunca expira)
    const bucketName = process.env.REACT_APP_FIREBASE_BUCKET || 'calango-chatbot.firebasestorage.app';
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(response.data.filePath)}?alt=media`;

    res.json({
      uploadUrl: response.data.uploadUrl,
      filePath: response.data.filePath,
      downloadUrl: downloadUrl
    });
  } catch (error) {
    console.error('Erro ao gerar URL:', error.message);
    res.status(500).json({ message: 'Erro ao gerar URL de upload' });
  }
});

// ==========================================
// 💬 ROTAS DO ADMIN CHAT (Fase 3)
// ==========================================

// GET /conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    // Busca a config do usuário para pegar o ID do Negócio
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.json([]); // Se não tem negócio, não tem conversas

    // Passa o ID do Negócio, pois os Contatos estão vinculados a ele
    const conversations = await messageService.getConversations(config._id);
    res.json(conversations);
  } catch (error) {
    console.error('Erro GET /conversations:', error);
    res.status(500).json({ message: 'Erro ao buscar conversas' });
  }
});

// GET /conversations/:contactId/messages
router.get('/conversations/:contactId/messages', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Negócio não encontrado' });

    const messages = await messageService.getMessagesForContact(req.params.contactId, config._id);
    res.json(messages);
  } catch (error) {
    console.error('Erro GET /messages:', error);
    res.status(500).json({ message: 'Erro ao buscar mensagens' });
  }
});

// POST /conversations/:contactId/messages (Agent Send Message)
router.post('/conversations/:contactId/messages', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const { contactId } = req.params;

    if (!message) return res.status(400).json({ message: 'Mensagem vazia.' });

    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Negócio não encontrado' });

    // 1. Validar e buscar contato
    const contact = await Contact.findOne({ _id: contactId, businessId: config._id });
    if (!contact) return res.status(404).json({ message: 'Contato não encontrado ou não autorizado.' });

    // 2. Enviar Mensagem
    let sent = false;
    if (contact.channel === 'whatsapp') {
      sent = await sendWWebJSMessage(req.user.userId, contact.phone, message);
      if (!sent) {
        // Se falhar o envio (WhatsApp desconectado, etc), avisa o front mas salva?
        // Melhor retornar erro para o agente saber.
        return res.status(500).json({ message: 'Falha ao enviar mensagem para o WhatsApp. Verifique a conexão.' });
      }
    } else if (contact.channel === 'web') {
      if (req.io) {
        req.io.to(contact.sessionId).emit('bot_message', { sender: 'agent', text: message });
        sent = true;
      }
    }

    // 3. Salvar no Banco (Como Agente)
    // identifier, role, content, messageType, visionResult, businessId, channel
    const identifier = contact.channel === 'web' ? contact.sessionId : contact.phone;

    // Usamos 'agent' como role para diferenciar de 'bot' e 'user'
    await messageService.saveMessage(identifier, 'agent', message, 'text', null, config._id, contact.channel);

    res.json({ success: true, message: 'Mensagem enviada.' });

  } catch (error) {
    console.error('Erro POST /messages:', error);
    res.status(500).json({ message: 'Erro interno ao enviar mensagem.' });
  }
});

// DELETE /conversations/:contactId/messages
router.delete('/conversations/:contactId/messages', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Negócio não encontrado' });

    await messageService.deleteMessages(req.params.contactId, config._id);
    res.json({ message: 'Histórico limpo' });
  } catch (error) {
    console.error('Erro DELETE /messages:', error);
    res.status(500).json({ message: 'Erro ao limpar histórico' });
  }
});

// Note: Image deletion is now handled by Firebase Admin SDK via Squamata or
// can be handled directly by the client if needed
// This endpoint is deprecated and will be removed in future versions

// ROTA DE INJEÇÃO DE TESTES (APENAS PARA DESENVOLVIMENTO)
router.post('/test/webhook', async (req, res) => {
  // Trava de segurança: só permite injetar testes se estiver rodando localmente
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: "Proibido em produção" });
  }

  try {
    const { from, body, type, businessId } = req.body;
    const { handleIncomingMessage } = await import('../messageHandler.js');

    const fakeMessage = {
      from: from,
      body: body,
      type: type || 'text',
      provider: 'test_script',
      channel: 'web'
    };

    console.log(`\n➡️ [API TESTE] Injetando mensagem: "${body}"`);

    // Dispara o cérebro do robô e CAPTURA a resposta
    const response = await handleIncomingMessage(fakeMessage, businessId);

    console.log("⬅️ [API TESTE] Retorno do MessageHandler:", response);

    // Define a resposta exata que vai para o Python
    let finalReply = "";
    if (response && response.text) {
      finalReply = response.text;
    } else if (response && response.error) {
      finalReply = `❌ [Bloqueio Interno: ${response.error}]`;
    } else {
      finalReply = "🤫 [Bot ignorou a mensagem intencionalmente (Filtro ou Handover)]";
    }

    // Devolve o JSON no formato exato que o Python está esperando
    res.status(200).json({ reply: finalReply });
  } catch (error) {
    console.error("💥 Erro no webhook de teste:", error);
    res.status(500).json({ reply: `❌ [Crash do Servidor: ${error.message}]` });
  }
});

export default router;

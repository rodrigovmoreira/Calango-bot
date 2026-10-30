import { listLabels, labelChats } from '../services/whatsapp/client.js';
import { canonicalWhatsAppId } from '../utils/phoneUtils.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';

/**
 * Importa as etiquetas do WhatsApp (app state) para o CRM (F6).
 *
 * Antes isso era feito com `client.getLabels()` + `getChatsByLabelId` do
 * whatsapp-web.js. Agora as duas informações vêm do serviço Go, e o @lid já
 * chega resolvido quando possível.
 */
const importLabels = async (req, res) => {
  try {
    const businessId = req.user.activeBusinessId;

    const config = await BusinessConfig.findById(businessId);
    if (!config) {
      return res.status(404).json({ message: 'Negócio não encontrado para este usuário.' });
    }

    let labels = [];
    try {
      labels = await listLabels(businessId);
    } catch (error) {
      console.error('Erro ao buscar etiquetas do serviço de WhatsApp:', error.code || error.message);
      return res.status(502).json({
        message: 'Erro ao buscar etiquetas do WhatsApp. Verifique se a sessão está conectada e se é uma conta Business.',
      });
    }

    if (!labels || labels.length === 0) {
      return res.json({ message: 'Nenhuma etiqueta encontrada.', tagsCreated: 0, contactsUpdated: 0 });
    }

    let tagsCreated = 0;
    let chatsProcessed = 0;
    let contactsUpdated = 0;
    let contactsNotFound = 0;

    // Passo A: sincronizar as definições (Tags locais)
    for (const label of labels) {
      if (!label.name) continue;

      await Tag.findOneAndUpdate(
        { businessId, name: label.name },
        { name: label.name, whatsappId: label.id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      tagsCreated++;
    }

    // Passo B: vincular as etiquetas aos contatos
    for (const label of labels) {
      if (!label.id || !label.name) continue;

      try {
        const chats = await labelChats(businessId, label.id);
        console.log(`   🏷️ [importLabels] Etiqueta "${label.name}": ${chats.length} chats.`);

        for (const rawJid of chats) {
          chatsProcessed++;

          const rawId = canonicalWhatsAppId(rawJid);
          if (!rawId) continue;

          // Grupos, canais e status não entram no CRM.
          if (rawId.includes('@g.us') || rawId.includes('@broadcast') || rawId.includes('@newsletter')) {
            continue;
          }

          const result = await Contact.updateOne(
            {
              businessId,
              $or: [
                { whatsappId: rawId },
                { whatsappId: rawId.replace('@s.whatsapp.net', '@c.us') },
                { phone: rawId.split('@')[0] },
              ],
            },
            { $addToSet: { tags: label.name } }
          );

          if (result.matchedCount === 0) {
            contactsNotFound++;
          } else if (result.modifiedCount > 0) {
            contactsUpdated++;
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar chats da etiqueta ${label.name}:`, error.code || error.message);
      }
    }

    console.log(`🏷️ [importLabels] Resumo: ${tagsCreated} tags, ${chatsProcessed} chats, ${contactsUpdated} vínculos, ${contactsNotFound} não encontrados.`);

    res.json({
      message: 'Importação concluída com sucesso!',
      tagsCreated,
      contactsUpdated,
      chatsProcessed,
      contactsNotFound,
    });
  } catch (error) {
    console.error('Erro geral em importLabels:', error);
    res.status(500).json({ message: 'Erro interno na importação.' });
  }
};

export { importLabels };

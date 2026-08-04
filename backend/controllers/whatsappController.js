import { getClientSession } from '../services/wwebjsService.js';
import { normalizePhone } from '../utils/phoneUtils.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';

const importLabels = async (req, res) => {
  try {
    const businessId = req.user.activeBusinessId;

    // 1. Get BusinessId
    const config = await BusinessConfig.findById(businessId);
    if (!config) {
      return res.status(404).json({ message: 'Negócio não encontrado para este usuário.' });
    }

    // 2. Get Client Session
    const client = getClientSession(businessId);
    if (!client || !client.info) {
        return res.status(400).json({ message: 'WhatsApp não conectado. Conecte-se primeiro.' });
    }

    // 3. Fetch Labels
    let labels = [];
    try {
        labels = await client.getLabels();
        console.log(`🏷️ [importLabels] ${labels.length} etiquetas encontradas no WhatsApp.`);
    } catch (error) {
        console.error('Erro ao buscar labels do WhatsApp:', error);
        return res.status(500).json({ message: 'Erro ao buscar etiquetas do WhatsApp. Certifique-se que é uma conta Business.' });
    }

    if (!labels || labels.length === 0) {
        return res.json({ message: 'Nenhuma etiqueta encontrada.', tagsCreated: 0, contactsUpdated: 0 });
    }

    let tagsCreated = 0;
    let contactsUpdated = 0;
    let chatsProcessed = 0;
    let contactsNotFound = 0;

    // Step A: Sync Definitions (Tags)
    for (const label of labels) {
        if (!label.name) continue;

        const update = {
            name: label.name,
            color: label.hexColor || '#808080',
            whatsappId: label.id  // Salva o ID do WhatsApp para referência
        };

        await Tag.findOneAndUpdate(
            { businessId, name: label.name },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        tagsCreated++;
    }

    // Step B: Sync Contacts — vincula etiquetas aos contatos
    for (const label of labels) {
        if (!label.id || !label.name) continue;

        try {
            const chats = await client.getChatsByLabelId(label.id);
            console.log(`   🏷️ [importLabels] Label "${label.name}": ${chats.length} chats encontrados.`);

            for (const chat of chats) {
                chatsProcessed++;
                
                // 🔧 CORREÇÃO: usa chat.id._serialized (telefone REAL em @c.us),
                // NÃO chat.id.user (Alias ID interno falso de contas Business)
                const rawId = typeof chat.id === 'string' 
                    ? chat.id 
                    : chat.id?._serialized || '';
                if (!rawId) continue;
                
                const cleanPhone = normalizePhone(rawId);

                // Busca alinhada com o formato de salvamento dos contatos
                const result = await Contact.updateOne(
                    { 
                        businessId,
                        $or: [
                            { phone: cleanPhone },
                            { whatsappId: rawId }
                        ]
                    },
                    { $addToSet: { tags: label.name } }
                );

                if (result.matchedCount === 0) {
                    contactsNotFound++;
                    console.warn(`   ⚠️ [importLabels] Contato não encontrado para ${rawId} (label: ${label.name}).`);
                } else if (result.modifiedCount > 0) {
                    contactsUpdated++;
                }
            }
        } catch (err) {
            console.error(`Erro ao buscar chats para label ${label.name}:`, err);
        }
    }

    console.log(`🏷️ [importLabels] Resumo: ${tagsCreated} tags, ${chatsProcessed} chats, ${contactsUpdated} vinculações, ${contactsNotFound} não encontrados.`);

    res.json({
        message: 'Importação concluída com sucesso!',
        tagsCreated,
        contactsUpdated,
        chatsProcessed,
        contactsNotFound
    });

  } catch (error) {
    console.error('Erro geral em importLabels:', error);
    res.status(500).json({ message: 'Erro interno na importação.' });
  }
};

export {
  importLabels
};

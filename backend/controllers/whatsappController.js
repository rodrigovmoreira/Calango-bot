import { getClientSession } from '../services/wwebjsService.js';
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
    } catch (error) {
        console.error('Erro ao buscar labels do WhatsApp:', error);
        return res.status(500).json({ message: 'Erro ao buscar etiquetas do WhatsApp. Certifique-se que é uma conta Business.' });
    }

    if (!labels || labels.length === 0) {
        return res.json({ message: 'Nenhuma etiqueta encontrada.', tagsCreated: 0, contactsUpdated: 0 });
    }

    let tagsCreated = 0;
    let contactsUpdated = 0;

    // Step A: Sync Definitions (Tags)
    for (const label of labels) {
        if (!label.name) continue;

        // Upsert Tag
        const update = {
            name: label.name,
            color: label.hexColor || '#808080' // Default gray if missing
        };

        await Tag.findOneAndUpdate(
            { businessId, name: label.name },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        tagsCreated++;
    }

    // Step B: Sync Contacts
    for (const label of labels) {
        if (!label.id || !label.name) continue;

        try {
            const chats = await client.getChatsByLabelId(label.id);

            for (const chat of chats) {
                const phone = chat.id.user; // e.g. "5511999999999"

                // Update Contact
                const result = await Contact.updateOne(
                    { businessId, phone },
                    { $addToSet: { tags: label.name } }
                );

                if (result.modifiedCount > 0) {
                    contactsUpdated++;
                }
            }
        } catch (err) {
            console.error(`Erro ao buscar chats para label ${label.name}:`, err);
        }
    }

    res.json({
        message: 'Importação concluída com sucesso!',
        tagsCreated, // Total processed
        contactsUpdated
    });

  } catch (error) {
    console.error('Erro geral em importLabels:', error);
    res.status(500).json({ message: 'Erro interno na importação.' });
  }
};

export {
  importLabels
};

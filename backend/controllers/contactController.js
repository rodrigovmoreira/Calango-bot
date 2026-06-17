import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Tag from '../models/Tag.js'; // Kept if needed for future expansions
import * as wwebjsService from '../services/wwebjsService.js';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';


// --- 1. CORE CRUD OPERATIONS (Refactored from Routes) ---

const getContacts = async (req, res) => {
    try {
        const businessId = req.user.activeBusinessId;
        const userId = req.user.userId;
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        // === ROLE-BASED FILTERING (Ponto 3: Assignment) ===
        // Check user role to determine which contacts to return
        const user = await Contact.collection.conn.model('SystemUser').findById(userId).select('businesses activeBusinessId');
        const userBusiness = user?.businesses?.find(b => b.businessId.toString() === businessId.toString());
        const userRole = userBusiness?.role || 'operator'; // Default to operator if role not found

        let filter = { businessId };

        if (userRole === 'operator') {
            // Operators see only contacts assigned to them or unassigned (null)
            filter.$or = [
                { assignedTo: userId },
                { assignedTo: null }
            ];
        }
        // Admins see all contacts (no additional filter)

        const contacts = await Contact.find(filter).sort({ lastInteraction: -1 }).populate('assignedTo', 'name email avatarUrl');
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Error fetching contacts' });
    }
};

const getContact = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const contact = await Contact.findOne({ _id: id, businessId }).populate('assignedTo', 'name email avatarUrl');
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json(contact);
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({ message: 'Error fetching contact' });
    }
};

const updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { __v, tags, name, isHandover, funnelStage, dealValue, notes } = req.body;

        const businessId = req.user.activeBusinessId;
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const updateData = {};
        if (tags !== undefined) updateData.tags = tags;
        if (name !== undefined) updateData.name = name;
        if (isHandover !== undefined) updateData.isHandover = isHandover;
        if (funnelStage !== undefined) updateData.funnelStage = funnelStage;
        if (dealValue !== undefined) updateData.dealValue = Number(dealValue);
        if (notes !== undefined) updateData.notes = notes;

        // Optimistic concurrency check if __v is provided
        const query = { _id: id, businessId };
        if (__v !== undefined) {
            query.__v = __v;
            // Mongoose optimistic concurrency will automatically increment __v when using findOneAndUpdate if not using $inc, but it's simpler to let Mongoose handle it or manually enforce.
            // When using findOneAndUpdate with optimisticConcurrency: true, Mongoose handles __v natively only for .save().
            // Wait, Mongoose handles __v on save(). For findOneAndUpdate, we must do it manually or pass options.
            // Mongoose optimisticConcurrency works on save(). For findOneAndUpdate, it does NOT increment __v automatically unless we tell it to.
            // Let's do the manual check and let the version increment if needed, but since optimistic concurrency is primarily about preventing overwrites, checking __v is key.
        }

        // We use $set to only update modified fields
        const updatedContact = await Contact.findOneAndUpdate(
            query,
            { $set: updateData, $inc: { __v: 1 } },
            { new: true }
        );

        if (!updatedContact) {
            // Check if it exists but version mismatch
            const existingContact = await Contact.findOne({ _id: id, businessId });
            if (existingContact) {
                return res.status(409).json({ message: 'Conflict: This item has been modified by another user or process. Please reload to see the latest updates.' });
            }
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json(updatedContact);
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ message: 'Error updating contact' });
    }
};

// --- 2. CSV IMPORT (Moved from Routes) ---

const importContacts = async (req, res) => {
    try {
        const businessId = req.user.activeBusinessId;
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const stats = { imported: 0, updated: 0, failed: 0 };
        let rows = [];

        // Parse File
        if (req.file.mimetype.includes('csv') || req.file.originalname.endsWith('.csv')) {
            await new Promise((resolve, reject) => {
                const stream = Readable.from(req.file.buffer);
                stream
                    .pipe(csv())
                    .on('data', (data) => rows.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });
        } else {
            // XLSX
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rows = xlsx.utils.sheet_to_json(sheet);
        }

        // Process Rows
        for (const row of rows) {
            const getField = (r, key) => r[key] || r[key.toLowerCase()] || r[key.toUpperCase()];

            let phone = getField(row, 'phone') || getField(row, 'Phone') || getField(row, 'telefone') || getField(row, 'Celular');
            const name = getField(row, 'name') || getField(row, 'Name') || getField(row, 'nome');
            const email = getField(row, 'email') || getField(row, 'Email');
            const tagsRaw = getField(row, 'tags') || getField(row, 'Tags');

            if (!phone) {
                stats.failed++;
                continue;
            }

            phone = String(phone).replace(/\D/g, '');

            if (phone.length < 8) {
                stats.failed++;
                continue;
            }

            const waId = `${phone}@c.us`;

            let contact = await Contact.findOne({ businessId, phone });

            if (contact) {
                if (name) contact.name = name;
                if (email) contact.email = email;
                contact.whatsappId = waId;
                if (tagsRaw) {
                    const newTags = String(tagsRaw).split(',').map(t => t.trim()).filter(t => t);
                    contact.tags = [...new Set([...contact.tags, ...newTags])];
                }
                await contact.save();
                stats.updated++;
            } else {
                const tags = tagsRaw ? String(tagsRaw).split(',').map(t => t.trim()).filter(t => t) : [];
                await Contact.create({
                    businessId,
                    phone,
                    whatsappId: waId,
                    name: name || 'Desconhecido',
                    email,
                    tags,
                    channel: 'whatsapp',
                    followUpStage: 0,
                    dealValue: 0,
                    funnelStage: 'new'
                });
                stats.imported++;
            }
        }

        res.json(stats);

    } catch (error) {
        console.error('Error importing contacts:', error);
        res.status(500).json({ message: 'Error processing import file' });
    }
};

// --- 3. WHATSAPP SYNC (New Feature) ---

const syncContacts = async (req, res) => {
    try {

        const config = await BusinessConfig.findById(req.user.activeBusinessId);

        if (!config) {
            return res.status(404).json({ message: 'Configuração não encontrada.' });
        }

        const businessId = config._id;
        const client = wwebjsService.getClientSession(businessId);

        if (!client || !client.info) {
            return res.status(503).json({ message: 'WhatsApp não está pronto. Aguarde a conexão.' });
        }

        console.log('🔄 Iniciando Sincronização Segura (Via API Nativa)...');

        // Puxa todos os chats através da função nativa estabilizada do WWebJS
        const allChats = await client.getChats();

        // Filtramos do lado do Node (em vez de dentro do navegador)
        const rawChats = allChats
            .filter(chat => {
                const id = chat.id._serialized;
                const user = chat.id.user;

                // Bloqueios de Segurança
                if (chat.isGroup) return false;
                if (chat.id.server === 'broadcast') return false; // Elimina Status e Newsletters
                if (id.includes('@g.us')) return false;
                if (user && user.includes('-')) return false;
                if (user && user.length > 15) return false;

                return true;
            })
            // .timestamp é padrão nativo no retorno do getChats()
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 15) // Pega as Top 15 mais recentes
            .map(chat => ({
                phone: chat.id._serialized,
                name: chat.name, // WWebJS já formata o nome de forma confiável
                pushname: chat.name,
                timestamp: chat.timestamp,
                unread: chat.unreadCount
            }));

        console.log(`✅ Recebidos e filtrados ${rawChats.length} chats recentes de forma segura.`);

        let imported = 0;

        for (const chatData of rawChats) {
            try {
                let rawId = chatData.phone;

                // Desmascarar @lid via método nativo wwebjs
                if (rawId && rawId.includes('@lid')) {
                    if (client) {
                        try {
                            const lidMap = await client.getContactLidAndPhone([rawId]);
                            if (lidMap && lidMap[0] && lidMap[0].pn) {
                                rawId = lidMap[0].pn; // Substitui o @lid pelo @c.us (ou número puro)
                            } else {
                                console.warn(`⚠️ Não foi possível desmascarar @lid para ${rawId}, ignorando.`);
                                continue;
                            }
                        } catch (lidErr) {
                            console.warn(`⚠️ Erro ao tentar desmascarar @lid para ${rawId}: ${lidErr.message}`);
                            continue;
                        }
                    } else {
                        continue; // Sem client WWebJS disponível, pular.
                    }
                }

                const cleanPhone = rawId.split('@')[0].replace(/\D/g, '');

                // Monta o nome
                const displayName = chatData.name || chatData.pushname || `Cliente ${cleanPhone.slice(-4)}`;
                const lastInteraction = new Date(chatData.timestamp * 1000);

                await Contact.findOneAndUpdate(
                    {
                        businessId,
                        $or: [
                            { phone: cleanPhone },
                            { whatsappId: rawId }
                        ]
                    },
                    {
                        $set: {
                            phone: cleanPhone,
                            whatsappId: rawId, // Salva o ID original ex: 5511999999999@c.us
                            name: displayName,
                            pushname: chatData.pushname,
                            isGroup: false,
                            lastInteraction: lastInteraction,
                            // profilePicUrl: null // Evita buscar foto para não pesar
                        },
                        $setOnInsert: {
                            channel: 'whatsapp',
                            followUpStage: 0,
                            dealValue: 0,
                            funnelStage: 'new',
                            profilePicUrl: null
                        }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                imported++;
            } catch (err) {
                console.warn(`⚠️ Erro ao salvar contato ${chatData.phone}: ${err.message}`);
            }
        }

        res.json({
            message: 'Sincronização Otimizada Concluída',
            totalFound: rawChats.length,
            imported: imported
        });

    } catch (error) {
        console.error('Erro no Sync:', error);
        // Se der erro de "pupPage undefined", significa que o cliente caiu
        if (error.message.includes('pupPage')) {
            return res.status(503).json({ message: 'Navegador fechado. Reinicie a conexão.' });
        }
        res.status(500).json({ message: 'Erro ao sincronizar', error: error.message });
    }
};

const createContact = async (req, res) => {
    try {
        const businessId = req.user.activeBusinessId;
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const { name, phone, tags } = req.body;

        if (!phone) {
            return res.status(400).json({ message: 'O número de telefone é obrigatório.' });
        }

        const cleanPhone = String(phone).replace(/\D/g, '');
        const waId = `${cleanPhone}@c.us`;

        const existingContact = await Contact.findOne({ businessId, phone: cleanPhone });

        if (existingContact) {
            return res.status(409).json({ message: 'Este contato já existe na sua base.' });
        }

        const newContact = await Contact.create({
            businessId,
            phone: cleanPhone,
            whatsappId: waId,
            name: name || 'Desconhecido',
            tags: tags || [],
            channel: 'whatsapp',
            followUpStage: 0,
            dealValue: 0,
            funnelStage: 'new'
        });

        res.status(201).json(newContact);
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ message: 'Erro ao criar contato' });
    }
};


const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const deletedContact = await Contact.findOneAndDelete({ _id: id, businessId });

        if (!deletedContact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ message: 'Error deleting contact' });
    }
};

const bulkDeleteContacts = async (req, res) => {
    try {
        const { ids } = req.body;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No contact IDs provided' });
        }

        const result = await Contact.deleteMany({ _id: { $in: ids }, businessId });

        res.json({ message: `${result.deletedCount} contacts deleted successfully` });
    } catch (error) {
        console.error('Error bulk deleting contacts:', error);
        res.status(500).json({ message: 'Error deleting contacts' });
    }
};

const bulkAddTags = async (req, res) => {
    try {
        const { ids, tags } = req.body;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No contact IDs provided' });
        }

        if (!Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({ message: 'No tags provided' });
        }

        const result = await Contact.updateMany(
            { _id: { $in: ids }, businessId },
            { $addToSet: { tags: { $each: tags } } }
        );

        res.json({ message: `Tags added successfully to ${result.modifiedCount} contacts` });
    } catch (error) {
        console.error('Error bulk adding tags:', error);
        res.status(500).json({ message: 'Error adding tags to contacts' });
    }
};

export {
    deleteContact,
    bulkDeleteContacts,
    bulkAddTags,
    getContacts,
    getContact,
    createContact,
    updateContact,
    importContacts,
    syncContacts
};

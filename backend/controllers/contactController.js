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

            let contact = await Contact.findOne({ businessId, phone });

            if (contact) {
                if (name) contact.name = name;
                if (email) contact.email = email;
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

        console.log('🔄 Iniciando Sincronização Cirúrgica (Via Injeção)...');

        const rawChats = await client.pupPage.evaluate(() => {
            const chats = window.Store.Chat.getModelsArray();

            return chats
                .filter(chat => {
                    // --- FILTRO DE BLINDAGEM CONTRA GRUPOS ---
                    const id = chat.id._serialized;
                    const user = chat.id.user;

                    // 1. Elimina Grupos explicitamente
                    if (chat.isGroup) return false;

                    // 2. Elimina Canais e Status
                    if (chat.isNewsletter || id.includes('newsletter') || id.includes('status')) return false;

                    // 3. Elimina Grupos pelo padrão de ID (@g.us)
                    if (id.includes('@g.us')) return false;

                    // 4. Elimina Grupos antigos pelo formato (número-timestamp)
                    if (user.includes('-')) return false;

                    // 5. Elimina números suspeitosamente longos (Grupos tem IDs gigantes)
                    // Um número de telefone tem no máximo 13-14 dígitos (DDI + DDD + 9 + Num)
                    if (user.length > 15) return false;

                    return true;
                })
                .sort((a, b) => b.t - a.t)
                .slice(0, 15) // Top 15 conversas LIMPAS
                .map(chat => ({
                    phone: chat.id.user,
                    name: chat.formattedTitle || chat.name || chat.contact.name || chat.contact.pushname,
                    pushname: chat.contact.pushname,
                    timestamp: chat.t,
                    unread: chat.unreadCount
                }));
        });

        console.log(`✅ Recebidos ${rawChats.length} chats do navegador.`);

        let imported = 0;

        for (const chatData of rawChats) {
            try {
                const rawId = chatData.phone;
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

export {
    getContacts,
    getContact,
    updateContact,
    importContacts,
    syncContacts
};

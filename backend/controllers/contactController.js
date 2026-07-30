import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';
import Tag from '../models/Tag.js'; // Kept if needed for future expansions
import * as wwebjsService from '../services/wwebjsService.js';
import { normalizePhone, toWhatsAppId } from '../utils/phoneUtils.js';
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

            phone = normalizePhone(phone);

            if (phone.length < 8) {
                stats.failed++;
                continue;
            }

            const waId = toWhatsAppId(phone);

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

/**
 * Tenta obter chats do WhatsApp com retry e fallback.
 * A API interna WAWebCollections.Chat pode falhar se o WhatsApp Web
 * atualizou sua estrutura DOM/JS (erro comum: "r: r" do Puppeteer evaluate).
 *
 * Estratégia:
 * 1. Verifica saúde da página (isClosed, crash)
 * 2. Aguarda estabilidade da página (networkidle)
 * 3. Tenta getChats() até 3x com backoff exponencial
 * 4. Fallback: tenta getContacts() (usa WAWebCollections.Contact)
 * 5. Fallback final: page.evaluate direto no window.Store
 */
const fetchChatsWithRetry = async (client) => {
    // --- HEALTH CHECK ---
    if (!client.pupPage || client.pupPage.isClosed()) {
        throw new Error('pupPage fechada. Reinicie a conexão.');
    }

    // Aguarda a página estar estável
    try {
        await client.pupPage.waitForFunction(
            () => document.readyState === 'complete',
            { timeout: 10000 }
        );
    } catch {
        console.warn('⚠️ Timeout aguardando document.readyState, continuando...');
    }

    // Pequena pausa para garantir que scripts internos do WA terminaram de carregar
    await new Promise(r => setTimeout(r, 2000));

    // --- ESTRATÉGIA 1: getChats() com retry ---
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`   🔄 Tentativa ${attempt}/${MAX_RETRIES} - client.getChats()...`);
            const chats = await client.getChats();
            console.log(`   ✅ getChats() retornou ${chats.length} chats.`);
            return chats;
        } catch (err) {
            lastError = err;
            console.warn(`   ⚠️ Tentativa ${attempt} falhou: ${err.message?.slice(0, 100) || err}`);

            if (attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`   ⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(r => setTimeout(r, delay));

                // Se o execution context foi destruído, a página pode ter sido fechada.
                // Neste caso não adianta retentar — propaga o erro.
                if (err.message?.includes('Execution context was destroyed')) {
                    console.warn('   ❌ Execution context destruído — abortando retentativas.');
                    throw err;
                }
            }
        }
    }

    // --- ESTRATÉGIA 2: Fallback via getContacts() + nomes via getChatById ---
    console.log('   🔄 Fallback: Tentando client.getContacts()...');
    try {
        const contacts = await client.getContacts();
        if (contacts && contacts.length > 0) {
            console.log(`   ✅ Fallback getContacts() retornou ${contacts.length} contatos.`);
            // DEBUG: Log das propriedades reais dos primeiros 3 contatos
            if (contacts.length > 0) {
                const sample = contacts.slice(0, 3);
                sample.forEach((c, i) => {
                    console.log(`   🔍 [DEBUG] Contato #${i + 1}:`, JSON.stringify({
                        id: c.id,
                        number: c.number,
                        name: c.name,
                        pushname: c.pushname,
                        shortName: c.shortName,
                        isMe: c.isMe,
                        isUser: c.isUser,
                        isGroup: c.isGroup,
                        isWAContact: c.isWAContact,
                        isBusiness: c.isBusiness,
                        allKeys: Object.keys(c)
                    }));
                });
            }

            // Mapeia contatos para formato compatível
            const mappedContacts = contacts.map(c => ({
                id: c.id || { _serialized: c.number + '@c.us', user: c.number, server: 'c.us' },
                name: c.name || c.pushname || c.shortName || '',
                pushname: c.pushname || c.name || c.shortName || '',
                number: c.number,
                isGroup: false,
                timestamp: Date.now() / 1000,
                unreadCount: 0
            }));

            // Para contatos sem nome, tenta buscar o nome via Chat (getChatById)
            const contactsWithoutName = mappedContacts.filter(c => !c.name && !c.pushname);

            if (contactsWithoutName.length > 0) {
                console.log(`   🔍 ${contactsWithoutName.length} contatos sem nome — tentando buscar via Chat...`);

                // Busca nomes em lotes de 10 para não sobrecarregar
                const BATCH_SIZE = 10;
                for (let i = 0; i < contactsWithoutName.length; i += BATCH_SIZE) {
                    const batch = contactsWithoutName.slice(i, i + BATCH_SIZE);
                    const batchPromises = batch.map(async (c) => {
                        try {
                            const rawId = c.id?._serialized || c.id;
                            if (!rawId) return;

                            // Tenta buscar o Chat individualmente (usa .find() em vez de .getModelsArray())
                            const chat = await client.getChatById(rawId);
                            if (chat && chat.name) {
                                c.name = chat.name;
                                c.pushname = chat.name;
                            }
                        } catch (e) {
                            // getChatById pode falhar também — ignoramos silenciosamente
                        }
                    });
                    await Promise.all(batchPromises);
                }

                const stillNoName = mappedContacts.filter(c => !c.name && !c.pushname).length;
                console.log(`   📊 Após busca via Chat: ${mappedContacts.length - stillNoName} com nome, ${stillNoName} sem nome.`);
            }

            return mappedContacts;
        }
    } catch (contactErr) {
        console.warn(`   ⚠️ Fallback getContacts() também falhou: ${contactErr.message?.slice(0, 100)}`);
    }

    // --- ESTRATÉGIA 3: Fallback final via window.Store ---
    console.log('   🔄 Fallback Final: Acessando window.Store diretamente...');
    try {
        const rawChats = await client.pupPage.evaluate(() => {
            // Tenta acessar Store diretamente (API comum do WhatsApp Web)
            const Store = window.Store || window.require?.('WAWebCollections');
            if (!Store || !Store.Chat) return [];

            const chats = Store.Chat.getModelsArray();
            return chats.map(chat => {
                try {
                    const serialized = chat.serialize ? chat.serialize() : chat;
                    const id = chat.id || serialized.id || {};
                    // Tenta todas as possíveis fontes de nome no modelo do Store
                    const chatName = chat.name || chat.formattedTitle || serialized.name
                        || serialized.formattedTitle || serialized.pushname || '';
                    const chatPushname = chat.pushname || serialized.pushname
                        || chat.contact?.pushname || serialized.contact?.pushname || '';
                    return {
                        id: {
                            _serialized: id._serialized || id.user + '@' + (id.server || 'c.us'),
                            user: id.user || '',
                            server: id.server || 'c.us'
                        },
                        name: chatName,
                        pushname: chatPushname || chatName,
                        isGroup: !!(chat.groupMetadata || serialized.isGroup),
                        timestamp: chat.t || chat.timestamp || serialized.t || 0,
                        unreadCount: chat.unreadCount || serialized.unreadCount || 0
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        });

        if (rawChats && rawChats.length > 0) {
            console.log(`   ✅ Fallback Store retornou ${rawChats.length} chats.`);
            return rawChats;
        }
    } catch (storeErr) {
        console.warn(`   ⚠️ Fallback Store também falhou: ${storeErr.message?.slice(0, 100)}`);
    }

    // Se tudo falhou, lança o erro original
    throw lastError || new Error('Todos os métodos de obtenção de chats falharam.');
};

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

        // Puxa todos os chats com retry e fallback automáticos
        const allChats = await fetchChatsWithRetry(client);

        // Filtramos do lado do Node (em vez de dentro do navegador)
        // Compatível com múltiplos formatos: getChats() (objetos Chat), getContacts() e Store fallback
        const rawChats = allChats
            .filter(chat => {
                try {
                    // Extrai ID de forma defensiva (compatível com múltiplos formatos)
                    const rawId = typeof chat.id === 'string'
                        ? chat.id
                        : chat.id?._serialized || chat.id?.user || '';

                    if (!rawId) return false;

                    const isGroup =
                        chat.isGroup === true ||
                        (typeof chat.id === 'object' && chat.id?.server === 'g.us') ||
                        rawId.includes('@g.us');

                    const isBroadcast =
                        (typeof chat.id === 'object' && chat.id?.server === 'broadcast') ||
                        rawId.includes('@broadcast');

                    // Bloqueios de Segurança
                    if (isGroup) return false;
                    if (isBroadcast) return false; // Elimina Status e Newsletters
                    if (rawId.includes('@g.us')) return false;
                    if (rawId.includes('status@broadcast')) return false;
                    if (rawId.includes('@newsletter')) return false;

                    // Filtra IDs técnicos muito longos (comunidades, etc.)
                    const user = typeof chat.id === 'object' ? chat.id?.user : rawId.split('@')[0];
                    if (user && user.includes('-')) return false;
                    if (user && user.length > 30) return false;

                    return true;
                } catch {
                    return false; // Ignora chats que causam erro na filtragem
                }
            })
            // .timestamp é padrão nativo no retorno do getChats()
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 500) // Pega as Top 500 mais recentes
            .map(chat => {
                const rawId = typeof chat.id === 'string'
                    ? chat.id
                    : chat.id?._serialized || '';

                return {
                    phone: rawId,
                    name: chat.name || chat.pushname || chat.shortName || '',
                    pushname: chat.pushname || chat.name || '',
                    timestamp: chat.timestamp || 0,
                    unread: chat.unreadCount || 0
                };
            });

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

                const cleanPhone = normalizePhone(rawId); // Agora extrai DDD+número (sem código de país)

                // Determina se um nome é "fallback" (vazio ou gerado automaticamente)
                const isFallbackName = (name) => !name || /^Cliente \d{4}$/.test(name);

                // Nome vindo do sync (pode ser vazio se o fallback não conseguiu extrair)
                const syncedName = chatData.name || chatData.pushname || '';
                const lastInteraction = new Date(chatData.timestamp * 1000);

                let displayName;

                if (!isFallbackName(syncedName)) {
                    // Nome REAL veio do WhatsApp → usa ele (é o mais atualizado)
                    displayName = syncedName;
                } else {
                    // Sync não trouxe nome → busca contato existente para preservar nome anterior
                    const existingContact = await Contact.findOne({
                        businessId,
                        $or: [
                            { phone: cleanPhone },
                            { whatsappId: rawId }
                        ]
                    });

                    if (existingContact && existingContact.name && !isFallbackName(existingContact.name)) {
                        // Mantém o nome que já estava salvo (não sobrescreve com vazio)
                        displayName = existingContact.name;
                    } else {
                        // Contato novo sem nome → gera fallback
                        displayName = `Cliente ${cleanPhone.slice(-4)}`;
                    }
                }

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

        const cleanPhone = normalizePhone(phone);
        const waId = toWhatsAppId(cleanPhone);

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

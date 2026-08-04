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

            // 🔧 CORREÇÃO: Busca duplicado por phone (formato novo) OU whatsappId (formato completo)
            let contact = await Contact.findOne({ 
                businessId, 
                $or: [
                    { phone },
                    { whatsappId: waId }
                ]
            });

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
 * REGEX para validar IDs de chat que são contatos reais.
 * Só aceita: DÍGITOS@c.us (ex: 5511999999999@c.us)
 * Rejeita: @g.us, @broadcast, @newsletter, @lid, IDs com hífen, etc.
 */
const VALID_CONTACT_ID = /^\d+@c\.us$/;

/**
 * Tenta obter contatos do WhatsApp com retry e fallback.
 *
 * 🆕 NOVA ESTRATÉGIA (CORRIGIDA):
 * 1. PRIMÁRIO: getContacts() — retorna objetos Contact com número REAL
 * 2. FALLBACK: getChats() — retorna chats, tenta resolver Contact de cada um
 * 3. FALLBACK FINAL: window.Store direto
 *
 * Motivo da mudança: getChats() retorna IDs de chat que NÃO são o número real
 * (ex: Renata Soares Marin → chat ID 114787379875965@c.us mas número real 11963321486).
 * getContacts() retorna o Contact.number CORRETO.
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

    await new Promise(r => setTimeout(r, 2000));

    let lastError = null;

    // ============================================================
    // 🆕 ESTRATÉGIA 1 (PRIMÁRIA): getContacts() — números REAIS
    // ============================================================
    console.log('   🔄 Estratégia 1: client.getContacts() (números reais)...');
    try {
        const contacts = await client.getContacts();
        if (contacts && contacts.length > 0) {
            console.log(`   ✅ getContacts() retornou ${contacts.length} contatos.`);
            
            // DEBUG: Log das propriedades dos primeiros contatos
            if (contacts.length > 0) {
                const sample = contacts.slice(0, 3);
                sample.forEach((c, i) => {
                    console.log(`   🔍 [DEBUG] Contato #${i + 1}:`, JSON.stringify({
                        id: c.id?._serialized || c.id,
                        number: c.number,
                        name: c.name,
                        pushname: c.pushname,
                        isMe: c.isMe,
                        isUser: c.isUser,
                        isMyContact: c.isMyContact,
                        isBusiness: c.isBusiness,
                    }));
                });
            }

            // Filtra e mapeia contatos — AGENDA DE CONTATOS (apenas salvos no telefone)
            // 🔧 REGRA 1: isMyContact === true → só contatos salvos na agenda do telefone
            // 🔧 REGRA 2: c.number é o telefone real (doc oficial do wwebjs)
            // 🔧 REGRA 3: Deduplica por id._serialized (WhatsApp duplica entradas Business)
            const seenIds = new Set();
            
            const mappedContacts = contacts
                .filter(c => {
                    if (c.isMe) return false;                // Não importar a si mesmo
                    if (c.isGroup) return false;              // Não importar grupos
                    if (!c.isMyContact) return false;          // 🆕 SÓ contatos da AGENDA
                    
                    const realId = c.id?._serialized || '';
                    if (!realId || !realId.includes('@c.us')) return false;
                    
                    // Deduplica por id real (entradas Business duplicadas)
                    if (seenIds.has(realId)) return false;
                    seenIds.add(realId);
                    
                    return true;
                })
                .map(c => ({
                    id: { 
                        _serialized: c.id?._serialized || '',
                        user: (c.id?._serialized || '').split('@')[0],  // ✅ Extrai do rawId
                        server: 'c.us' 
                    },
                    name: c.name || c.pushname || c.shortName || '',
                    pushname: c.pushname || c.name || '',
                    number: (c.id?._serialized || '').split('@')[0],     // ✅ rawId, não c.number
                    isMyContact: true,
                    isBusiness: c.isBusiness || false,
                    unreadCount: 0,
                }));

            // Marca a estratégia para o syncContacts saber que veio da agenda
            mappedContacts._strategy = 'contacts';
            
            console.log(`   ✅ ${mappedContacts.length} contatos da AGENDA (isMyContact + isMe/grupos removidos).`);
            
            return mappedContacts;
        }
    } catch (contactErr) {
        lastError = contactErr;
        console.warn(`   ⚠️ getContacts() falhou: ${contactErr.message?.slice(0, 100)}`);
    }

    // ============================================================
    // ESTRATÉGIA 2 (FALLBACK): getChats() — resolve Contact de cada chat
    // ============================================================
    console.log('   🔄 Estratégia 2: client.getChats() (resolve Contact)...');
    const MAX_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`   🔄 Tentativa ${attempt}/${MAX_RETRIES} - client.getChats()...`);
            const chats = await client.getChats();
            console.log(`   ✅ getChats() retornou ${chats.length} chats.`);
            
            // Filtra apenas chats pessoais (DÍGITOS@c.us) e mapeia
            const personalChats = chats.filter(chat => {
                const rawId = typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
                return VALID_CONTACT_ID.test(rawId);
            });
            
            console.log(`   ✅ ${personalChats.length} chats pessoais (de ${chats.length} total).`);
            
            // 🔧 CORREÇÃO: Para cada chat, tenta resolver o Contact real (pega o número correto)
            // Faz em lotes para não sobrecarregar
            const resolvedContacts = [];
            const RESOLVE_BATCH = 15;
            
            for (let i = 0; i < personalChats.length; i += RESOLVE_BATCH) {
                const batch = personalChats.slice(i, i + RESOLVE_BATCH);
                const resolved = await Promise.all(batch.map(async (chat) => {
                    try {
                        const rawId = typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
                        let realNumber = chat.id?.user || rawId.split('@')[0];
                        let realName = chat.name || '';
                        let pushname = chat.pushname || '';
                        let labels = [];
                        
                        // Tenta resolver o Contact real (tem o número correto)
                        try {
                            const contact = await client.getContactById(rawId);
                            if (contact && contact.number) {
                                realNumber = contact.number;  // ✅ NÚMERO REAL
                                realName = contact.name || contact.pushname || realName;
                                pushname = contact.pushname || pushname;
                            }
                            // ⚡ Labels serão buscados depois do limit no syncContacts
                        } catch (e) { /* getContactById pode falhar */ }
                        
                        return {
                            id: { _serialized: realNumber + '@c.us', user: realNumber, server: 'c.us' },
                            name: realName,
                            pushname: pushname,
                            number: realNumber,        // ✅ NÚMERO REAL (resolvido)
                            timestamp: chat.timestamp || 0,
                            unreadCount: chat.unreadCount || 0,
                            _labels: labels,
                        };
                    } catch (e) {
                        return null;
                    }
                }));
                
                resolvedContacts.push(...resolved.filter(Boolean));
            }
            
            console.log(`   ✅ ${resolvedContacts.length} contatos resolvidos com número real.`);
            resolvedContacts._strategy = 'chats';
            return resolvedContacts;
            
        } catch (err) {
            lastError = err;
            console.warn(`   ⚠️ Tentativa ${attempt} falhou: ${err.message?.slice(0, 100) || err}`);
            
            if (attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`   ⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(r => setTimeout(r, delay));
                
                if (err.message?.includes('Execution context was destroyed')) {
                    console.warn('   ❌ Execution context destruído — abortando retentativas.');
                    throw err;
                }
            }
        }
    }

    // ============================================================
    // ESTRATÉGIA 3 (FALLBACK FINAL): window.Store direto
    // ============================================================
    console.log('   🔄 Fallback Final: Acessando window.Store diretamente...');
    try {
        const rawChats = await client.pupPage.evaluate(() => {
            const Store = window.Store || window.require?.('WAWebCollections');
            if (!Store || !Store.Chat) return [];
            const chats = Store.Chat.getModelsArray();
            return chats.map(chat => {
                try {
                    const serialized = chat.serialize ? chat.serialize() : chat;
                    const id = chat.id || serialized.id || {};
                    return {
                        id: {
                            _serialized: id._serialized || id.user + '@' + (id.server || 'c.us'),
                            user: id.user || '',
                            server: id.server || 'c.us'
                        },
                        name: chat.name || chat.formattedTitle || serialized.name || '',
                        pushname: chat.pushname || serialized.pushname || '',
                        isGroup: !!(chat.groupMetadata || serialized.isGroup),
                        timestamp: chat.t || chat.timestamp || serialized.t || 0,
                        unreadCount: chat.unreadCount || serialized.unreadCount || 0
                    };
                } catch (e) { return null; }
            }).filter(Boolean);
        });

        if (rawChats && rawChats.length > 0) {
            console.log(`   ✅ Fallback Store retornou ${rawChats.length} chats.`);
            rawChats._strategy = 'store';
            return rawChats;
        }
    } catch (storeErr) {
        console.warn(`   ⚠️ Fallback Store também falhou: ${storeErr.message?.slice(0, 100)}`);
    }

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
        
        // 🔧 Detecta qual estratégia foi usada (definida em fetchChatsWithRetry)
        const strategy = allChats._strategy || 'unknown';
        console.log(`📌 [Sync] Estratégia utilizada: ${strategy} (${allChats.length} itens)`);

        // Filtramos do lado do Node (em vez de dentro do navegador)
        // Compatível com múltiplos formatos: getChats() (objetos Chat), getContacts() e Store fallback
        
        // 🔍 DIAGNÓSTICO: Conta quantos chats são rejeitados e por quê
        const filterStats = { total: allChats.length, passed: 0, rejected: {
            group: 0, broadcast: 0, newsletter: 0, lid: 0, invalidFormat: 0, tooLong: 0, hyphen: 0, noId: 0, isMe: 0
        }};
        
        // Obtém o ID do próprio WhatsApp para filtrar (não queremos importar a si mesmo)
        const myWid = client.info?.wid?._serialized || '';
        
        let rawChats = allChats
            .filter(chat => {
                try {
                    // Extrai ID de forma defensiva (compatível com múltiplos formatos)
                    const rawId = typeof chat.id === 'string'
                        ? chat.id
                        : chat.id?._serialized || chat.id?.user || '';

                    if (!rawId) { filterStats.rejected.noId++; return false; }
                    
                    // 🔧 Filtra o próprio número (isMe) — não importar a si mesmo como contato
                    if (myWid && rawId === myWid) { filterStats.rejected.isMe++; return false; }

                    // 🔧 CORREÇÃO: Só aceita IDs no formato DÍGITOS@c.us (contatos pessoais reais)
                    // Rejeita TUDO que não for esse padrão: @g.us, @broadcast, @newsletter, @lid, etc.
                    if (!VALID_CONTACT_ID.test(rawId)) {
                        if (rawId.includes('@g.us')) filterStats.rejected.group++;
                        else if (rawId.includes('@broadcast')) filterStats.rejected.broadcast++;
                        else if (rawId.includes('@newsletter')) filterStats.rejected.newsletter++;
                        else if (rawId.includes('@lid')) filterStats.rejected.lid++;
                        else filterStats.rejected.invalidFormat++;
                        return false;
                    }

                    // Extrai a parte numérica (antes do @)
                    const user = rawId.split('@')[0];
                    
                    // Filtra IDs muito longos (comunidades, etc.)
                    if (user.length > 30) { filterStats.rejected.tooLong++; return false; }
                    
                    // Filtra IDs com hífen (IDs técnicos)
                    if (user.includes('-')) { filterStats.rejected.hyphen++; return false; }

                    filterStats.passed++;
                    return true;
                } catch {
                    return false;
                }
            });
        
        // 🔧 REGRA 3: Fluxo condicional por estratégia
        // Se veio da AGENDA (getContacts): NÃO ordena por timestamp (é falso), NÃO aplica slice(500)
        // Se veio de CHATS (getChats/Store): ordena por timestamp + limita a 500
        if (strategy === 'contacts') {
            // Agenda: processa TODOS os contatos, sem ordenação artificial
            console.log(`   📇 [Sync] Modo AGENDA: processando todos os ${rawChats.length} contatos (sem limite de 500).`);
        } else {
            // Chats: ordena por timestamp (real) e limita aos 500 mais recentes
            rawChats = rawChats
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, 500);
            console.log(`   💬 [Sync] Modo CHATS: limitado aos ${rawChats.length} mais recentes.`);
        }
        
        // Mapeia para o formato final
        rawChats = rawChats
            .map(chat => {
                const rawId = typeof chat.id === 'string'
                    ? chat.id
                    : chat.id?._serialized || '';

                return {
                    rawId: rawId,                                    // ✅ Fonte real (ex: 5511999999999@c.us)
                    name: chat.name || chat.pushname || chat.shortName || '',
                    pushname: chat.pushname || chat.name || '',
                    timestamp: chat.timestamp || 0,
                    unread: chat.unreadCount || 0
                };
            });

        // 📊 Log do diagnóstico de filtro
        console.log(`📊 [Sync] Diagnóstico de filtro:`);
        console.log(`   Total recebido: ${filterStats.total}`);
        console.log(`   ✅ Passaram: ${filterStats.passed}`);
        console.log(`   ❌ Rejeitados:`);
        console.log(`      - Grupos (@g.us): ${filterStats.rejected.group}`);
        console.log(`      - Broadcast: ${filterStats.rejected.broadcast}`);
        console.log(`      - Newsletter/Canais: ${filterStats.rejected.newsletter}`);
        console.log(`      - LID (privacidade): ${filterStats.rejected.lid}`);
        console.log(`      - Formato inválido: ${filterStats.rejected.invalidFormat}`);
        console.log(`      - ID muito longo: ${filterStats.rejected.tooLong}`);
        console.log(`      - Com hífen: ${filterStats.rejected.hyphen}`);
        console.log(`      - Sem ID: ${filterStats.rejected.noId}`);
        console.log(`      - Próprio número (isMe): ${filterStats.rejected.isMe}`);

        console.log(`✅ Recebidos e filtrados ${rawChats.length} chats recentes de forma segura.`);

        // 🔖 Busca etiquetas (labels) do WhatsApp (Otimizado via Mapa em Memória)
        if (rawChats.length > 0) {
            console.log(`   🏷️ Buscando etiquetas de forma otimizada para ${rawChats.length} contatos...`);
            let labelsFound = 0;

            try {
                const waLabels = await client.getLabels();
                const labelMap = {};

                if (waLabels && waLabels.length > 0) {
                    // Cria um dicionário de rawId -> array de labels
                    for (const label of waLabels) {
                        if (!label.id || !label.name) continue;
                        try {
                            const chatsWithThisLabel = await client.getChatsByLabelId(label.id);
                            for (const chat of chatsWithThisLabel) {
                                const chatRawId = typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
                                if (chatRawId) {
                                    if (!labelMap[chatRawId]) labelMap[chatRawId] = [];
                                    labelMap[chatRawId].push(label.name);
                                }
                            }
                        } catch (lblErr) {
                            // Ignora falha de uma label específica e continua
                        }
                    }

                    // Aplica o mapa aos contatos do sync
                    for (const c of rawChats) {
                        if (c.rawId && labelMap[c.rawId]) {
                            c._labels = labelMap[c.rawId];
                            labelsFound += c._labels.length;
                        }
                    }
                }
                console.log(`   🏷️ ${labelsFound} etiquetas vinculadas em memória.`);
            } catch (e) {
                console.warn(`   ⚠️ [Labels] Erro geral ao mapear etiquetas: ${e.message}`);
            }
        }

        let imported = 0;
        const isBusinessAccount = !!client.info?.isBusiness;

        for (const chatData of rawChats) {
            try {
                // 🔧 rawId é a fonte real do telefone (ex: 5511989207636@c.us).
                // c.number (realNumber) é um Alias/ID interno falso do WhatsApp (ex: 77825025536062).
                let rawId = chatData.rawId;

                // 🛡️ PROTEÇÃO: Pula entradas sem ID válido
                if (!rawId || rawId.trim() === '') {
                    console.warn(`⚠️ [Sync] Chat sem ID válido — ignorado. Nome: "${chatData.name}"`);
                    continue;
                }

                // Desmascarar @lid via método nativo wwebjs
                if (rawId && rawId.includes('@lid')) {
                    if (client) {
                        try {
                            const lidMap = await client.getContactLidAndPhone([rawId]);
                            if (lidMap && lidMap[0] && lidMap[0].pn) {
                                console.log(`   🔓 [Sync] @lid desmascarado: ${rawId} → ${lidMap[0].pn}`);
                                rawId = lidMap[0].pn;  // Atualiza com o telefone real
                            } else {
                                console.warn(`⚠️ [Sync] Não foi possível desmascarar @lid para ${rawId}, ignorando.`);
                                continue;
                            }
                        } catch (lidErr) {
                            console.warn(`⚠️ [Sync] Erro ao desmascarar @lid para ${rawId}: ${lidErr.message}`);
                            continue;
                        }
                    } else {
                        continue;
                    }
                }

                // Extrai o telefone limpo do rawId (remove @c.us e código do país)
                const cleanPhone = normalizePhone(rawId);
                
                // 🛡️ PROTEÇÃO: Pula se o telefone normalizado ficou vazio ou inválido
                if (!cleanPhone || cleanPhone.length < 8) {
                    console.warn(`⚠️ [Sync] Telefone inválido após normalização: "${rawId}" → "${cleanPhone}" — ignorado.`);
                    continue;
                }

                // 📊 LOG
                console.log(`   💾 [Sync] ${chatData.name || 'sem nome'} | rawId: ${rawId} | phone: ${cleanPhone}`);

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

                // Salva/atualiza o contato com upsert
                const updateData = {
                    $set: {
                        phone: cleanPhone,                    // 📱 Formato nacional para UI
                        whatsappId: rawId,                    // 🔑 ID técnico original para backend/etiquetas
                        name: displayName,
                        pushname: chatData.pushname,
                        isGroup: false,
                        lastInteraction: lastInteraction,
                    },
                    $setOnInsert: {
                        channel: 'whatsapp',
                        followUpStage: 0,
                        dealValue: 0,
                        funnelStage: 'new',
                        profilePicUrl: null,
                    }
                };
                
                // 🔖 Adiciona etiquetas se for conta Business e houver mapeamento
                if (isBusinessAccount && chatData._labels && Array.isArray(chatData._labels) && chatData._labels.length > 0) {
                    updateData.$addToSet = { tags: { $each: chatData._labels } };
                    console.log(`   🏷️ [Sync] ${chatData._labels.length} etiqueta(s): ${chatData._labels.join(', ')}`);
                    
                    // Remove 'tags' do $setOnInsert para não dar Conflito no MongoDB
                    if (updateData.$setOnInsert && updateData.$setOnInsert.tags !== undefined) {
                        delete updateData.$setOnInsert.tags;
                    }
                } else {
                    updateData.$setOnInsert.tags = [];
                }

                await Contact.findOneAndUpdate(
                    {
                        businessId,
                        $or: [
                            { whatsappId: rawId },    // 🥇 Prioridade: ID técnico original
                            { phone: cleanPhone }      // 🥈 Fallback: formato nacional
                        ]
                    },
                    updateData,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                imported++;
            } catch (err) {
                console.error(`❌ [Sync] Erro ao salvar contato. rawId: "${chatData.rawId}", nome: "${chatData.name}"`);
                console.error(`   Detalhes: ${err.message}`);
                if (err.code === 11000) {
                    console.error(`   ⚠️ Erro de chave duplicada (11000). Verifique o índice unique de phone/whatsappId.`);
                }
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

        // 🔧 CORREÇÃO: Busca por phone (formato novo) OU whatsappId (compatível com formato antigo)
        const existingContact = await Contact.findOne({ 
            businessId, 
            $or: [
                { phone: cleanPhone },
                { whatsappId: waId }
            ]
        });

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

import express from 'express';
import axios from 'axios';
import Contact from '../models/Contact.js';
import Tag from '../models/Tag.js';
import BusinessConfig from '../models/BusinessConfig.js';

const router = express.Router();

// 1. Rota de VERIFICAÇÃO (GET) - Mantida intacta
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
            console.log('✅ Webhook da Meta verificado com sucesso!');
            res.status(200).send(challenge);
        } else {
            console.error('❌ Falha na verificação da Meta: Token incorreto.');
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Faltam parâmetros de verificação.');
    }
});

// 2. Rota de RECEBIMENTO DOS DADOS REAIS (POST)
router.post('/webhook', async (req, res) => {

    console.log('\n\n======================================================');
    console.log('🚨 [WEBHOOK META] ALGUÉM BATEU NA PORTA DA ROTA CORRETA!');
    console.log('📦 BODY RECEBIDO:', JSON.stringify(req.body, null, 2));
    console.log('======================================================\n\n');
    
    const body = req.body;

    if (body.object === 'page') {
        // ⚠️ REGRA DE OURO DA META: Devolver status 200 IMEDIATAMENTE antes de processar
        res.status(200).send('EVENT_RECEIVED');

        for (const entry of body.entry) {
            for (const change of entry.changes) {
                if (change.field === 'leadgen') {
                    const leadgenId = change.value.leadgen_id;

                    console.log(`🚀 Novo Lead recebido da Meta! ID: ${leadgenId}`);

                    try {
                        // 1. Buscar os dados reais na Graph API usando o Token
                        const url = `https://graph.facebook.com/v25.0/${leadgenId}?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`;
                        const response = await axios.get(url);
                        const leadData = response.data;

                        // 2. Extrair Nome, Telefone e Email do array field_data
                        let leadName = 'Lead Sem Nome';
                        let leadPhone = '';
                        let leadEmail = '';

                        leadData.field_data.forEach(field => {
                            // Os nomes dos campos podem variar consoante o idioma do formulário
                            if (field.name === 'full_name' || field.name === 'nome') leadName = field.values[0];
                            if (field.name === 'phone_number' || field.name === 'telefone') leadPhone = field.values[0];
                            if (field.name === 'email') leadEmail = field.values[0];
                        });

                        if (!leadPhone) {
                            console.log('⚠️ Lead sem número de telemóvel ignorado.');
                            continue;
                        }

                        // 3. Limpar o número (manter apenas números para compatibilidade com o wwebjs)
                        const cleanPhone = leadPhone.replace(/\D/g, '');

                        // 4. Identificar a Empresa (Como temos Multi-Tenant, usamos a primeira como fallback)
                        let businessConfig = await BusinessConfig.findOne();
                        if (!businessConfig) {
                            throw new Error("Nenhum BusinessConfig encontrado no banco de dados.");
                        }
                        const businessId = businessConfig._id;

                        // 5. Garantir que a Tag "Lead Meta Ads" existe
                        let tagMeta = await Tag.findOne({ businessId, name: 'Lead Meta Ads' });
                        if (!tagMeta) {
                            tagMeta = await Tag.create({ businessId, name: 'Lead Meta Ads', color: '#1877F2' });
                        }

                        // 6. Guardar ou Atualizar o Contato no CRM
                        const novoContato = await Contact.findOneAndUpdate(
                            { businessId, phone: cleanPhone }, // Procura pelo telemóvel dentro da mesma empresa
                            {
                                name: leadName,
                                email: leadEmail,
                                $addToSet: { tags: tagMeta._id } // Adiciona a etiqueta sem duplicar
                            },
                            { upsert: true, new: true } // Cria se não existir, atualiza se existir
                        );

                        console.log(`✅ Sucesso! Lead ${leadName} (${cleanPhone}) guardado no CRM Calango Bot!`);

                    } catch (error) {
                        console.error('❌ Erro ao processar Lead da Meta:', error.response ? error.response.data : error.message);
                    }
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

export default router;
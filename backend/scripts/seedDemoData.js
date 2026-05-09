const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env vars
// Try to find .env in current directory or ../.env or ./backend/.env
const envFile = '.env';
// Caminhos possíveis onde o .env pode estar
const possiblePaths = [
    path.resolve(process.cwd(), envFile),                // Pasta atual
    path.join(__dirname, '..', envFile),                 // Um nível acima do script
    path.join(__dirname, '..', '..', envFile) // Caso esteja rodando de muito longe
];

let envPath = possiblePaths.find(p => fs.existsSync(p));

if (envPath) {
    console.log(`✅ Carregando .env de: ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.warn('⚠️ AVISO: Nenhum arquivo .env encontrado nos caminhos padrões.');
    console.warn('Procurado em:', possiblePaths);
}
// ---------------------------

const SystemUser = require('../models/SystemUser');
const BusinessConfig = require('../models/BusinessConfig');
const Campaign = require('../models/Campaign');

const seedData = async () => {
    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
         console.error('❌ MONGO_URI is not defined in environment variables.');
         process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    }

    try {
        // 1. Find the first available User
        const user = await SystemUser.findOne({});
        if (!user) {
            console.error('❌ No SystemUser found. Please create a user first via the application.');
            process.exit(1);
        }
        console.log(`👤 Found User: ${user.name} (${user.email})`);

        // 2. Find BusinessConfig
        let businessConfig = await BusinessConfig.findOne({ businessName: "Estúdio Tattoo" });
        if (!businessConfig) {
             console.log('⚠️ No BusinessConfig found. Creating a default one...');
             businessConfig = new BusinessConfig({ businessName: "Estúdio Tattoo" });
        }

        // 3. Insert 'QuickAnswers' (menuOptions)
        console.log('🧹 Clearing and Seeding QuickAnswers (menuOptions)...');

        const newQuickAnswers = [
            {
                keyword: '/endereco',
                description: 'Localização',
                response: 'Estamos na Av. Paulista, 1000. Próximo ao metrô! 📍',
                requiresHuman: false,
                useAI: false
            },
            {
                keyword: '/humano',
                description: 'Suporte',
                response: 'Compreendo. Vou transferir você para um de nossos especialistas humanos agora mesmo. 🙋‍♂️',
                requiresHuman: true,
                useAI: false
            },
            {
                keyword: '/pix',
                description: 'Pagamento',
                response: 'Segue nossa chave PIX para garantir o agendamento: cnpj@minhaloja.com 💸',
                requiresHuman: false,
                useAI: false
            },
            {
                keyword: '/horario',
                description: 'Horário',
                response: 'Funcionamos de Seg a Sex das 09h às 18h e Sáb até às 13h. ⏰',
                requiresHuman: false,
                useAI: false
            },
            {
                keyword: '/promo',
                description: 'Promoção',
                response: 'Essa oferta é válida apenas até durarem os estoques! Gostaria de reservar? 🏷️',
                requiresHuman: false,
                useAI: false
            }
        ];

        businessConfig.menuOptions = newQuickAnswers;

        // Merge availableTags
        const campaignTags = ["Inativo", "Sumido", "VIP", "Comprador Recorrente"];
        const quickAnswerTags = ["Localização", "Suporte", "Pagamento", "Horário", "Promoção"];

        const allTags = new Set([...(businessConfig.availableTags || []), ...campaignTags, ...quickAnswerTags]);
        businessConfig.availableTags = Array.from(allTags);

        await businessConfig.save();
        console.log('✅ QuickAnswers and Tags updated.');

        // 4. Insert 'Campaigns'
        console.log('🧹 Clearing existing Campaigns for user...');
        await Campaign.deleteMany({ businessId: businessConfig._id });

        console.log('🌱 Seeding Campaigns...');
        const campaigns = [
            {
                businessId: businessConfig._id,
                name: "Lembrete 24h Antes",
                type: "recurring",
                triggerType: "event",
                eventOffset: 1440,
                eventTargetStatus: ['scheduled'],
                contentMode: "static",
                message: "Olá {nome_cliente}! Passando para confirmar nosso compromisso amanhã às {hora_agendamento}. Posso contar com sua presença?",
                isActive: true
            },
            {
                businessId: businessConfig._id,
                name: "Resgate de Inativos (IA)",
                type: "recurring",
                triggerType: "time",
                targetTags: ["Inativo", "Sumido"],
                schedule: { frequency: 'weekly', days: [5], time: '10:00' },
                contentMode: "ai_prompt",
                message: "Analise o histórico da conversa. O cliente parou de responder há um tempo. Crie uma mensagem curta, casual e bem humorada perguntando se ele 'morreu' ou se tá muito ocupado, e convide para ver as novidades da semana. Use um tom de amigo.",
                isActive: true
            },
            {
                businessId: businessConfig._id,
                name: "Promoção Relâmpago VIP",
                type: "broadcast",
                targetTags: ["VIP", "Comprador Recorrente"],
                contentMode: "static",
                message: "👑 Olá VIP! Liberamos um lote extra com 20% OFF só para quem recebeu essa mensagem. Responda EU QUERO para garantir.",
                isActive: true,
                schedule: { frequency: 'once', time: '09:00', days: [] },
                triggerType: 'time'
            }
        ];

        await Campaign.insertMany(campaigns);
        console.log('✅ Campaigns seeded.');

        console.log('🎉 Demo Data Seeding Complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
};

seedData();

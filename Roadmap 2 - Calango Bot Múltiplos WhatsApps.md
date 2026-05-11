📱 Roadmap Calango Bot Múltiplos WhatsApps (Multi-Profissionais / Setores)
🔌 Ponto 1: Arquitetura Base e Sessões (Backend / whatsapp-web.js)
Objetivo: O servidor precisa rodar múltiplos WhatsApps do mesmo negócio, sabendo exatamente quem é quem.

[ ] 1.1 Refatoração do Client Map (Node.js): Em backend/services/wwebjsService.js, mudar o gerenciamento em memória do objeto de instâncias. Deixar de usar clients[businessId] para usar clients[sessionId].

[ ] 1.2 Inicialização (Boot) em Lote (Node.js): Atualizar o método de inicialização (no wwebjsService.js ou server.js). O servidor deve buscar todas as sessões ativas (status: 'connected') na coleção de Sessions e dar um client.initialize() para cada uma.

[ ] 1.3 Roteamento Bidirecional (Node.js): * Ao receber mensagem (em backend/messageHandler.js), injetar o sessionId no payload para as próximas etapas (IA, gravação no banco).

Ao enviar mensagem manual (POST /api/whatsapp/send no whatsappRoutes.js e whatsappController.js), exigir o sessionId no body da requisição para disparar pelo aparelho correto.

🗄️ Ponto 2: Nova Modelagem de Dados (MongoDB)
Objetivo: Todos os documentos do banco precisam ter o "carimbo" de qual WhatsApp eles pertencem.

[x] 2.1 Refatorar Sessões: No arquivo backend/models/Session.js. Hoje ele tem um relacionamento 1:1 com o negócio (usando apenas o businessId). Vamos manter o businessId, mas transformá-lo em 1:N, adicionando os campos name (ex: "Tatuador A"), phoneNumber e status. O _id dessa sessão (sessionId) é o que guiará todo o resto.

[x] 2.2 Carimbo em Interações: Adicionar o campo sessionId (Referência obrigatória) nos Schemas backend/models/Contact.js e backend/models/Message.js.

[x] 2.3 Carimbo no Catálogo: Adicionar o campo sessionId (Referência opcional) no array de produtos do catálogo (provavelmente dentro de backend/models/BusinessConfig.js). Se for null, o produto é da loja toda. Se tiver ID, pertence só àquele profissional.

[x] 2.4 Carimbo no Calendário: Adicionar o campo sessionId (Referência obrigatória) no Schema backend/models/Appointment.js.

🤖 Ponto 3: A Inteligência Artificial com "Consciência de Canal"
Objetivo: A IA vai usar o mesmo prompt global, mas as funções que ela executa devem ser limitadas ao WhatsApp que o cliente chamou.

[ ] 3.1 Isolamento de Histórico (Node.js): No backend/services/aiService.js, ajustar a busca de mensagens anteriores (Message.find()) para filtrar por businessId + clientPhone + sessionId.

[ ] 3.2 Filtro no Catálogo via Function Calling (Node.js): No backend/services/aiTools.js e backend/services/menuService.js, a função de consultar catálogo deve receber o sessionId em background e buscar no banco: sessionId: { $in: [currentSessionId, null] }. Assim a IA do João não vende a arte da Maria.

[ ] 3.3 Colisão de Agendamento (Node.js): No backend/services/aiTools.js, a lógica de verificar_disponibilidade e a função de agendar devem validar conflitos usando a combinação de Data/Hora + sessionId. Se o João tem cliente às 14h, a IA pode marcar às 14h para a Maria no outro número sem acusar conflito.

🛍️ Ponto 4: Ajustes de Interface - Catálogo e Agendamento (Frontend / React)
Objetivo: Permitir que o Admin configure quem vende o quê.

[ ] 4.1 UI do Catálogo (React/Chakra UI): Em frontend/src/components/dashboard-tabs/CatalogTab.jsx, no modal de Criar/Editar Produto, adicionar um campo Select (opcional): "Este item pertence a um WhatsApp específico?" listando as conexões ativas do negócio, ou "Global (Todos)".

[ ] 4.2 UI do Calendário (React/Chakra UI): Em frontend/src/components/ScheduleTab.jsx, adicionar um filtro rápido no topo (Select) para o Admin visualizar a agenda de "Todos" ou apenas da "Sessão X".

💬 Ponto 5: Gestão de Canais, Inbox e Kanban (Frontend / UI)
Objetivo: O operador humano não pode se perder no meio de tantos canais e leads.

[ ] 5.1 Painel de Aparelhos (React): Refatorar a frontend/src/components/dashboard-tabs/ConnectionTab.jsx para listar as Múltiplas Sessões. O botão "Conectar WhatsApp" deve pedir um Nome (ex: Tatuador A) antes de gerar o QR Code.

[ ] 5.2 Badges Visuais no Chat (React): Em frontend/src/pages/PublicChat.jsx e frontend/src/components/ContactItem.jsx, adicionar uma Tag colorida do Chakra UI mostrando por qual canal o cliente está falando.

[ ] 5.3 Select de Envio Ativo (React): Na tela de Chat, ao clicar no botão de "Nova Conversa" com cliente não-salvo, forçar a escolha de qual número de remetente (sessionId) será usado para disparar a mensagem.

[ ] 5.4 Filtros no Kanban (React): Em frontend/src/pages/SalesFunnel.jsx ou FunnelBoard.jsx, adicionar um Dropdown no topo: "Ver leads de todos os canais" ou "Apenas leads do [Nome da Sessão]".

🧪 Roadmap Calango Bot Testes Automatizados e Qualidade (QA)

> **Status verificado em 2026-10-29 — 2/12 itens concluídos, com diagnóstico completo.**
>
> **Causa raiz das falhas (não era "teste desatualizado", era ambiente):** o `package.json` declara `"type": "module"`, mas **7 das 16 suítes eram CommonJS** (`const x = require(...)`). Rodando com `--experimental-vm-modules`, `.js` é tratado como ESM → **`ReferenceError: require is not defined`** e a suíte nem carrega. Essas suítes estavam mortas há tempo; não era um problema de asserção.
>
> **Baseline medido e progresso:**
>
> | Momento | Suítes passando | Suítes falhando | Testes |
> | :--- | :--- | :--- | :--- |
> | Antes | 6 / 16 | 10 / 16 | 31 passando, 5 falhando |
> | Depois (2026-10-29) | **9 / 16** | **7 / 16** | **46 passando, 5 falhando** |
>
> **Corrigidas:**
> - `unit/messageFilter.test.js` → **11/11**. Os mocks estavam desatualizados: faltava `processConversation` no mock de `aiService` (o `messageHandler` migrou de `callDeepSeek` para `processConversation`) e as asserções apontavam para a função antiga — ou seja, os `not.toHaveBeenCalled()` passavam por **falso positivo**.
> - `tag_protection.test.js` → **3/3**. Convertida para ESM; `req.user` corrigido para incluir `activeBusinessId` (o controller resolve o negócio por ele, não por `userId`); mock de `wwebjsService` removido (o `tagController` não depende dele).
> - `integration/business_config_verification.test.js` → **1/1**. Convertida para ESM; a auth mockada agora injeta `activeBusinessId` dinâmico (antes era fixo e ausente → 404).
>
> **Pendentes (7 suítes):**
> - **ESM com falha de lógica (2):** `unit/sync_verification` (o mock devolve objetos com `phone/name` enquanto o controller lê `chat.id._serialized` — contrato mudou no refactor do Sync) e `unit/campaignScheduler` (4 falhas de agendamento).
> - **CommonJS a converter (5):** `integration/flow`, `integration/import`, `integration/crm`, `automation`, `agent_chat`. **Atenção:** `import`, `crm` e `agent_chat` fazem `require('../server')`, o que **sobe o servidor de verdade** (porta + banco real). Precisam ser reescritas montando os routers num app Express mínimo — o padrão já validado em `tests/integration/membership_offboarding.test.js`.
>
> **Achado operacional:** rodar as suítes de integração em paralelo faz **3+ instâncias do `mongodb-memory-server`** subirem ao mesmo tempo e algumas estouram o timeout de 10s ("Instance failed to start"). Use `npm test -- --runInBand`, ou compartilhe uma única instância no `setup.js`.
🧹 Ponto 1: Auditoria e Revitalização do Legado (A Limpeza da Casa)
Objetivo: Fazer os testes atuais voltarem a passar antes de criar coisas novas, garantindo que o ambiente Jest esteja saudável.

[ ] 1.1 Revisão do Ambiente: Revisar o backend/jest.config.js e o backend/tests/setup.js. Garantir que o banco de dados de teste (in-memory ou DB de testes isolado) está subindo e limpando corretamente a cada execução para não deixar "lixo".

[ ] 1.2 Conserto dos Mocks: Atualizar o backend/tests/mocks/whatsappMock.js e backend/verification/messageServiceMock.js para refletirem a estrutura atual de mensagens recebidas (agora que teremos a questão de sessões/conexões).

[ ] 1.3 Refatoração dos Testes Unitários: Rodar os testes na pasta backend/tests/unit/ (como o rateLimiters.test.js e validators.test.js) e consertar o que estiver quebrado.

🧠 Ponto 2: Testes de "Function Calling" e IA (Integração)
Objetivo: Provar matematicamente que a DeepSeek está chamando as ferramentas certas e que o Node.js está executando as ações no banco.

[ ] 2.1 Teste de Consulta de Catálogo: Criar/Atualizar teste no aiTools.test.js. Enviar a string mockada "Quanto custa a tatuagem de leão?" para o aiService.js, interceptar o payload da DeepSeek e validar se ele acionou o buscar_produto_catalogo e se o menuService.js retornou o valor correto do banco de testes.

[ ] 2.2 Teste de Agendamento (Colisões): Focar no aiTools_checkAvailability.test.js. Tentar agendar dois clientes no mesmo horário e na mesma data. Validar se a primeira chamada grava no Appointment.js e se a segunda chamada retorna um erro/aviso de "Horário Indisponível" para a IA.

[ ] 2.3 Teste de Atualização de Kanban: Validar se a função da IA que avança o Lead no funil (atualizar_status_lead) realmente altera a propriedade funnelStage no documento dentro de Contact.js.

💬 Ponto 3: Testes de Fluxo de Conversa e Roteamento
Objetivo: Garantir que a lógica de "primeiro contato" e as regras de negócio humanas funcionem sem depender do cérebro da IA.

[ ] 3.1 O "Caminho Feliz" do Novo Lead: No messageHandler.js (ou messageHandler_lazy.test.js), simular uma mensagem de um número desconhecido. Validar se o sistema: (1) Cria o Contact no banco, (2) Responde com a saudação inicial do BusinessConfig.js, (3) Sem dar timeout.

[ ] 3.2 Isolamento de Mídia: Simular o recebimento de uma Imagem/Áudio no whatsappMock.js e validar se o sistema processa ou rejeita o formato corretamente, acionando o visionService.js ou transcriptionService.js.

[ ] 3.3 Intervenção Humana (Pausar IA): Simular o comando de um atendente assumindo o chat (mudando status para human). Garantir que as mensagens seguintes do cliente no mock não acionem o callDeepSeek no aiService.js.

🛡️ Ponto 4: Testes de Banco de Dados e API (Segurança e Validações)
Objetivo: Testar se as rotas da API protegem o banco de dados contra envios maliciosos ou dados incompletos.

[ ] 4.1 Validação de Cadastro de Usuário: No arquivo que testa as rotas de Auth (authRoutes.test.js), enviar um POST para registrar usuário faltando a senha, ou com um e-mail já existente. Garantir que o sistema retorna os erros corretos (ex: HTTP 400 ou 409) e não derruba o servidor (crash).

[ ] 4.2 Testes de Permissão (Middlewares): Usar um mock de requisição com o token de um Operador para tentar acessar uma rota de Admin (ex: deletar produto no menuService.js). Validar se o middleware auth.js barra com um erro HTTP 403 (Forbidden).

🚀 Ponto 5: TDD (Test-Driven Development) para os Novos Roadmaps
Objetivo: Já que vamos construir coisas complexas, vamos escrever os testes delas junto com o código novo!

[ ] 5.1 Teste da Concorrência (Multi-Usuários): Criar um teste que simula duas requisições simultâneas para editar o mesmo produto (usando o conceito de $set e updatedAt). Validar se a segunda recebe o erro HTTP 409 (Conflito Otimista).

[ ] 5.2 Teste do Isolamento de Sessão (Multi-WhatsApp): Simular mensagens chegando pelo sessionId_A e sessionId_B. Validar se o histórico da IA no aiService.js consegue responder à "Sessão A" sem vazar o contexto da conversa que está rolando na "Sessão B".
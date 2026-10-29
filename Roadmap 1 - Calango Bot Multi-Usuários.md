📋 Roadmap Calango Bot Multi-Usuários (MVP)

> **Status verificado no código em 2026-10-29.**
> **Feito:** Pontos 1 (5/5), 2 (6/6), 3 (10/10), 4 (4/4), 5 (3/3) e 6 (4/4) — **32/32 itens**.
> **Pendente:** nada. Roadmap concluído.
> **Nota de nomenclatura:** este documento foi escrito antes do [ADR 002](../Calango-docs/docs/ADRs/002-versionamento-de-api.md). Onde se lê `/api/...`, o caminho real hoje é **`/api/v1/...`** (caminho único, sem alias).
> **Nota de arquitetura:** o login passou a ser SSO via Squamata-Login. Onde o texto fala em "assinar novo token JWT", a implementação real **não re-assina token** — o `activeBusinessId` vive no banco e o middleware resolve a cada requisição. Ver Ponto 3.1.

🔀 Ponto 1: Controle de Concorrência em Edições (Optimistic Concurrency)
Objetivo: Impedir que edições simultâneas sobrescrevam dados de forma silenciosa.

[x] 1.1 Modelagem (MongoDB): Garantir que os Schemas em backend/models/ (ex: Contact.js, Appointment.js e as configurações/catálogo em BusinessConfig.js) usem o controle de versão nativo (__v) ou tenham um campo obrigatório updatedAt.

[x] 1.2 Refatoração de Update (Node.js): Ajustar os controllers (ex: contactController.js) nos métodos de PUT/PATCH para usar o operador $set do MongoDB, atualizando apenas os campos modificados, e não o documento todo.

[x] 1.3 Bloqueio Otimista (Node.js): Criar validação no backend que compara a "versão" enviada pelo frontend com a versão atual do banco. Se a do banco for mais nova, retornar erro HTTP 409 Conflict.

[x] 1.4 Payload Inteligente (React): Ajustar os formulários de edição no frontend (src/components/...) para enviar na requisição apenas os campos que o usuário alterou + a versão/data original de quando ele abriu a tela.

[x] 1.5 Tratamento de Conflitos (Chakra UI): Interceptar o erro 409 Conflict no Axios/Fetch e exibir um Toast de alerta (vermelho) ou modal: "Atenção: Este item foi modificado por outro usuário. Recarregue para ver as atualizações."

🤝 Ponto 2: Sistema de Convites, Hierarquia e Onboarding
Objetivo: Permitir a entrada de novos usuários no mesmo negócio de forma segura.

[x] 2.1 Refatoração de Auth (MongoDB): Alterar o Schema de Usuário (backend/models/SystemUser.js) para aceitar o trânsito entre empresas. Adicionar activeBusinessId (negócio atual visualizado) e o array businesses: [{ businessId, role }].

[x] 2.2 Tabela de Convites (MongoDB): Criar a coleção Invites (backend/models/Invite.js com token, businessId, role, status, expiresAt).

[x] 2.3 Middlewares de Segurança (Node.js): Ajustar o backend/middleware/auth.js para validar ações usando o activeBusinessId do usuário. Criar também um middleware requireAdmin para proteger rotas sensíveis.

[x] 2.4 Endpoints de Convite (Node.js): No authRoutes.js (ou businessRoutes.js), criar POST /api/invites para o Admin gerar links. Ajustar o POST /api/auth/register para ler um inviteToken e vincular o usuário à empresa existente em vez de criar uma nova.

[x] 2.5 UI de Gestão de Equipe (React/Chakra UI): Criar a tela de Configurações de Equipe no painel, contendo a tabela de membros, papéis e o botão "Gerar Link de Convite".

[x] 2.6 Tela Pública de Onboarding (React/Vite): Criar a rota frontend /invite/:token com a mensagem de boas-vindas ("Você foi convidado") e o formulário de cadastro/login vinculado.

🏢 Ponto 3: Gestão de empresas: Os usuários cadastrados que tiverem acesso a múltiplas empresas devem ter uma opção para trocar o ambiente de trabalho.
Objetivo: Permitir a alternância fluida entre diferentes instâncias do SaaS para um mesmo usuário, assegurando que o escopo de dados e as permissões carregadas sejam estritamente isoladas para cada empresa.

[x] 3.1 Backend: Endpoint de Troca de Contexto (backend/routes/authRoutes.js): Criar a rota POST /api/auth/switch-business. A função deve verificar se o targetBusinessId existe dentro do array businesses do usuário logado, atualizar o activeBusinessId e assinar um novo token JWT com as permissões (role) específicas daquele ambiente.
   - **Implementado com adaptação SSO:** `/api/v1/auth/switch-business` existe e valida o vínculo, mas **não emite token novo** — só grava `activeBusinessId` e devolve o usuário populado. A `role` é recalculada por `authenticateToken` a cada request (fonte: `user.businesses`), o que é mais seguro que carregar role no token (revogação imediata).

[x] 3.2 Backend: Preenchimento dos Nomes das Empresas: Ajustar a rota de /login e o retorno de dados do usuário para incluir um .populate('businesses.businessId', 'businessName') no modelo SystemUser. Isso garante que o array contenha strings legíveis para montar a interface visual, ao invés de apenas ObjectIds.

[x] 3.3 Frontend: Mapeamento da Nova Rota (frontend/src/services/api.js): Expor o novo endpoint no objeto authAPI adicionando a chamada switchBusiness: (targetBusinessId) => api.post('/api/auth/switch-business', { targetBusinessId }).

[x] 3.4 Frontend: Componente Dropdown de Seleção (Header/Sidebar): Transformar a exibição atual do nome do negócio (ex: "Agri-Ink Tattoo") em um menu interativo (utilizando os componentes de Menu do Chakra UI). Ele deve mapear o state.user.businesses e desabilitar o clique na empresa já ativa.

[x] 3.5 Frontend: Prevenção de Vazamento Visual e Estado (frontend/src/context/AppContext.jsx): Implementar a lógica para que, assim que a API confirmar o novo token na troca de empresa, o sistema sobrescreva o localStorage e execute uma recarga forçada da rota principal (window.location.href = '/dashboard'). Isso limpa arrays de contatos, funil e mensagens cacheadas do contexto anterior.

[x] 3.6 Frontend/Backend: Sincronização de Sockets em Tempo Real (frontend/src/context/AppContext.jsx): Incluir state.user.activeBusinessId no array de dependências do hook useEffect do Socket.io. Emitir os eventos adequados para sair da sala (room) do negócio antigo e entrar na escuta da sala do novo negócio, evitando recebimento de mensagens cruzadas no chat público.

[x] 3.7 Backend: Rota de Criação de Novo Ambiente (backend/routes/businessRoutes.js)
Criar um endpoint POST /api/business/create. A função deve:
Receber o nome da nova empresa (businessName).
Instanciar e salvar um novo documento BusinessConfig (com configurações, tags e colunas de funil padrão).
Buscar o usuário logado (req.user.userId), dar um .push no array businesses com { businessId: novo_id, role: 'admin' }.
Atualizar o activeBusinessId do usuário para essa nova empresa.
Gerar e retornar um novo token JWT (exatamente como fizemos no switch-business), além dos dados atualizados do usuário com o .populate para que o frontend já conheça o nome da nova empresa.

[x] 3.8 Frontend: Método na API (frontend/src/services/api.js)
Adicionar a chamada para o novo endpoint no objeto responsável (ex: businessAPI), passando os dados necessários.

[x] 3.9 Frontend: Opção no Menu e Modal (Header/BusinessSwitcher.jsx)
Utilizando o Chakra UI, adicionar um separador visual e a nova opção de criação.
Inserir um <MenuDivider /> no final do mapeamento das empresas atuais.
Adicionar um <MenuItem icon={<AddIcon />}> + Criar nova empresa </MenuItem>.
Ao clicar, abrir um Modal simples contendo um campo de texto (Input) para o "Nome do Novo Negócio" e um botão de confirmação.

[x] 3.10 Frontend: Fluxo de Transição Visual (Header/BusinessSwitcher.jsx)
Tratar a resposta de sucesso da criação copiando o comportamento do switch. Ao receber o HTTP 200:
Sobrescrever o localStorage com o novo token e usuário.
Fechar o modal e disparar o recarregamento seguro (window.location.href = '/dashboard'). Isso limpa o cache da tela e já faz o usuário "acordar" dentro da nova empresa, pronto para usar a aba de equipe.

🎯 Ponto 4: Atribuição de Responsável (O "Dono do Lead")
Objetivo: Organizar quem atende quem e evitar colisões no funil de vendas.

[x] 4.1 Modelagem do Lead (MongoDB): Adicionar o campo assignedTo (Referência ao ID do SystemUser) em backend/models/Contact.js e backend/models/Appointment.js.

[x] 4.2 Filtro por Papel (Node.js): Ajustar o método de listagem no contactController.js. Se a role for operator, retornar apenas contatos onde assignedTo == userId (ou contatos sem dono). Se for admin, retornar todos.

[x] 4.3 Endpoints de Atribuição (Node.js): Criar a rota PATCH /api/contacts/:id/assign no contactRoutes.js para atribuir ou trocar o dono de um contato.

[x] 4.4 Interface do Kanban (React/Chakra UI): No componente FunnelCard.jsx, exibir um Avatar pequeno com as iniciais do responsável. Dentro dos detalhes do contato, adicionar um Dropdown/Select para "Passar a bola" para outro vendedor.

   **CONCLUÍDO em 2026-10-28.** Avatar do responsável no Kanban já existia (`FunnelCard.jsx`).
   - **"Passar a bola"** agora está no cabeçalho da conversa (`LiveChatTab.jsx`): ícone de troca, visível **apenas para admin** (a rota é `requireAdmin`), abrindo o `AssignmentModal` com a equipe carregada de `/business/team`. Tooltip mostra o responsável atual e o contato é atualizado nas três listas sem recarregar a página.
   - **Bugs que precisaram ser corrigidos para funcionar:**
     - `AssignmentModal` mantinha o responsável do contato anterior ao reabrir (state não resetava).
     - `onAssignSuccess` recebia o `AxiosResponse` inteiro em vez do contato (`response.data`).
     - `/business/team` devolve `{ id }`, não `{ _id }` — o modal não encontrava os membros.
     - `PATCH /contacts/:id/assign` devolvia `assignedTo` como ObjectId cru; sem `populate` a UI não tinha o nome.
     - `getConversations` não projetava `__v` nem `assignedTo`, então o contato selecionado chegava sem versão (quebrando a concorrência otimista do assign).
   - Verificado: admin atribui (200, `assignedTo` populado, `__v` incrementa) · versão antiga → 409 · operador → 403 · desatribuir (null) → 200.

🕵️‍♂️ Ponto 5: Rastreabilidade Básica (Log Versão Lite)
Objetivo: Saber quem fez o que no sistema em caso de erros ou auditorias rápidas.

> **Status: 3/3 implementado.**
>
> **Análise de viabilidade (resumo):** ✅ **Viável e seguro.**
> - 5.1 é **puramente aditivo** (campos opcionais). Documentos antigos ficam com `null` — nada quebra, nenhum índice muda.
> - 5.2 é o único com atenção: existem **7 pontos de escrita** (contact, appointment, businessConfig, campaign, tag, assignment, e escritas automáticas do `messageHandler`/`aiTools`). Nas automáticas **não há usuário logado** → precisa de convenção (`lastUpdatedBy = null` + `origin: 'system'`), senão o campo mente.
> - **Não conflita com o Ponto 1:** acrescentar `lastUpdatedBy` ao `$set` existente não afeta o `$inc: { __v: 1 }`.
> - 5.3 depende de `populate('createdBy lastUpdatedBy', 'name')` nos GETs — mudança de payload só aditiva.

[x] 5.1 Campos de Log (MongoDB): Adicionar createdBy e lastUpdatedBy (Refs de SystemUser) nos Schemas principais (Contact.js, Appointment.js, BusinessConfig.js).
   - **Implementado em 2026-10-29** via `backend/utils/auditPlugin.js` (plugin do Mongoose).
   - Campos: `createdBy`, `lastUpdatedBy`, `lastUpdatedAt` e `lastUpdatedOrigin` (`'user' | 'system'`).
   - `lastUpdatedAt` foi adicionado além do pedido: `Contact`/`Appointment` não tinham `updatedAt`, e sem data o rodapé do 5.3 mostraria autor sem quando.
   - **Efeito colateral positivo:** `BusinessConfig.updatedAt` era declarado mas **nunca atualizado**; o plugin passou a mantê-lo coerente com a última alteração.

[x] 5.2 Injeção Automática (Node.js): Nos controllers, interceptar as requisições de criação (POST) e atualização (PUT/PATCH) para injetar automaticamente o ID do usuário autenticado (req.user.id) nesses campos antes do save().
   - **Implementado em 2026-10-29 com uma decisão de arquitetura:** em vez de editar os 7 controllers (e todo controller futuro), o autor é propagado por `AsyncLocalStorage` (`backend/utils/auditContext.js`) e gravado pelo plugin no nível do schema.
     - `auditContextMiddleware` abre um escopo por requisição em `server.js`;
     - `authenticateToken` chama `setAuditActor(user._id)` depois de resolver o `req.user`;
     - o plugin cobre `save`, `insertMany`, `findOneAndUpdate`, `findOneAndReplace`, `updateOne`, `updateMany` e `replaceOne`.
   - **Escritas automáticas** (`messageHandler`, `aiTools`, scheduler, scripts) não têm usuário → gravam `lastUpdatedBy: null` + `lastUpdatedOrigin: 'system'`. O campo nunca atribui a autoria a quem não agiu.
   - Upsert (caminho do `importContacts`) grava `createdBy` em `$setOnInsert` — não sobrescreve a autoria original em reimportações.
   - Coberto por `backend/tests/integration/audit.test.js` (6 cenários: create com/sem ator, findOneAndUpdate, updateMany, upsert, Appointment + BusinessConfig). **Concorrência otimista (`__v`) preservada.**

[x] 5.3 Visibilidade Simplificada (React/Chakra UI): Adicionar um rodapé sutil nos modais de edição de itens no frontend: "Criado por [Nome] em [Data] - Última alteração por [Nome]".
   - **Implementado em 2026-10-29** como componente reutilizável `frontend/src/components/AuditTrail.jsx`.
   - Formato: `Criado por X em 29/10 14:32 · Última alteração por Y em 29/10 15:10`; quando a última escrita foi automática, mostra `Última alteração automática em ...`.
   - Sem informação de autoria (documentos anteriores ao Ponto 5) o componente **não renderiza nada** — nada de rodapé vazio ou "— em Invalid Date".
   - Lugares: ficha do cliente no chat (`CrmSidebar`) e modal de agendamento (`ScheduleTab`).
   - Backend: `populate('createdBy lastUpdatedBy', 'name email')` em `getContacts`, `getContact`, `getConversations` e `GET /appointments`.
   - **Bug pré-existente encontrado e corrigido:** `getConversations` não populava `assignedTo` — `selectedContact.assignedTo?.name` no cabeçalho do chat sempre foi `undefined`. Agora popula.

🚪 Ponto 6: O Offboarding (Revogação de Acesso e "Herança" de Leads)
Objetivo: Remover usuários sem quebrar a rastreabilidade e redistribuir os clientes órfãos.

> **Status: 4/4 implementado** (6.1, 6.2, 6.3 e 6.4).
>
> **Análise de viabilidade (resumo):** ⚠️ **Viável, mas é o ponto de maior risco do roadmap** — mexe em controle de acesso.
> - **6.2 hoje é um buraco real:** `authenticateToken` calcula `role` a partir de `user.businesses`, mas **não valida** se `activeBusinessId` ainda pertence ao usuário. Removido de uma empresa, ele continua com `activeBusinessId` apontando para lá e cai no default `operator` — **mantendo acesso**. O 403 do item 6.2 é correção de segurança, não melhoria.
> - **Dado atual está limpo:** verifiquei no banco — 15 usuários, **0** com `activeBusinessId` fora do array, **0** sem empresa, **0** inativos. Ou seja, ligar o 403 **não bloqueia ninguém hoje**.
> - **Armadilha:** `isActive` no `SystemUser` é **global**, não por empresa. Usar `isActive=false` para revogar acesso a uma empresa derrubaria o usuário em **todas**. O offboarding precisa **remover do array `businesses`**, nunca mexer em `isActive`.
> - **Risco de lockout:** é preciso impedir remover o **último admin** da empresa, senão o negócio fica órfão de administração.
> - 6.3/6.4 dependem de `assignedTo` (já existe) e de contar leads por responsável; `requireAdmin` obrigatório nas duas.

[x] 6.1 Endpoint de Inativação (Node.js): Criar rota no backend para o Admin inativar/remover o acesso de um usuário ao negócio (atualizando o array businesses no SystemUser.js).
   - **Implementado em 2026-10-28** conforme [ADR 004](../Calango-docs/docs/ADRs/004-vinculo-usuario-empresa.md).
   - `PATCH /api/v1/business/team/:userId/deactivate` (`authenticateToken` + `requireAdmin`).
   - **Soft delete do vínculo** (`status: 'inactive'`, `deactivatedAt`, `deactivatedBy`) — nada é removido do array, o histórico é preservado.
   - `isActive` global **não** é tocado (é global e derrubaria a pessoa na empresa dela).
   - Bloqueia auto-inativação (proteção real contra lockout) e tem guarda de último admin como rede de segurança (`code: LAST_ADMIN`).
   - **Herança de leads:** contatos do inativado passam para o admin que executou, na mesma transação lógica; retorna `transferredLeads`.
   - Convite para um vínculo inativo **reativa** o vínculo (novo convite é decisão explícita do admin).
   - Verificado com Mongo em memória: 12 cenários (permissão, auto-inativação, soft delete, auditoria, transferência, perda de acesso, 404/409).

[x] 6.2 Derrubar Sessão (Node.js): Na lógica do backend/middleware/auth.js, se o usuário tentar acessar com um activeBusinessId do qual foi removido/bloqueado, invalidar a ação e retornar status 403 (forçando logout ou troca de empresa no frontend).
   - **Implementado em 2026-10-28, com duas decisões de projeto:**
     1. **Auto-cura em vez de 403 puro.** Se o `activeBusinessId` não pertence mais ao usuário mas ele ainda tem outro negócio, o middleware troca para o primeiro válido e persiste. Um 403 seco trancaria o usuário fora até do `switch-business` (que também passa pelo middleware) — beco sem saída.
     2. **Provisionamento automático só no primeiro login.** Antes, qualquer usuário com `businesses` vazio ganhava uma empresa nova — o que **desfaria o offboarding** no request seguinte. Agora só provisiona quando o `SystemUser` está sendo criado naquele momento; usuário existente sem vínculo recebe `403 { code: 'NO_ACTIVE_BUSINESS' }`.
   - Verificado com Mongo em memória carregando o middleware real: primeiro acesso provisiona · contexto válido intacto · contexto revogado troca e persiste · sem vínculo retorna 403 · offboarding não é desfeito.
   - Verificado na stack real: `/api/v1/auth/profile` continua 200 para todos os usuários do banco (nenhum bloqueado).

[x] 6.3 Transferência em Lote (Node.js): Criar rota POST /api/contacts/bulk-transfer no contactRoutes.js que busca todos os contatos associados ao "Usuário A" e altera o assignedTo para o "Usuário B".
   - **Implementado em 2026-10-29:** `POST /api/v1/contacts/bulk-transfer` (`authenticateToken` + `requireAdmin`) → `{ fromUserId, toUserId }`.
   - Valida que o **destino tem vínculo ativo** na empresa (`INVALID_TRANSFER_TARGET`) — transferir para quem foi desligado recriaria o problema.
   - Recusa origem = destino. Retorna `{ transferred, fromUserId, toUserId }`.
   - Cobre 3 casos de teste: transferência efetiva, operador bloqueado (403), destino sem vínculo (400).

[x] 6.4 Fluxo de Demissão na UI (React/Chakra UI): Na tela de equipe, ao clicar em "Remover Usuário", abrir um Modal de aviso. Adicionar um select opcional: "Este usuário possui X leads em aberto. Deseja transferi-los para:", listando a equipe restante.
   - **Implementado em 2026-10-29** em `TeamTab.jsx`: botão "Remover" por linha (admin-only, oculto na própria linha) abrindo o modal de desligamento.
   - O modal busca a contagem real via novo `GET /api/v1/business/team/:userId/lead-count` (admin-only) e só mostra o select de destino quando há leads.
   - Select lista a equipe restante + opção "Manter comigo (você)".
   - **Extensão necessária no 6.1:** `PATCH /team/:userId/deactivate` passou a aceitar `transferTo` opcional (validado como membro ativo). Sem isso o destino era sempre quem executou; o modal pede escolha.
   - Aviso explícito de que o histórico é preservado (soft delete do vínculo, ADR 004).


---

📈 Plano de Execução (verificado em 2026-10-29)

Resumo: **32 de 32 itens concluídos (100%)**. Roadmap 1 encerrado.

| Ponto | Feito | Pendente | Situação |
| :--- | :--- | :--- | :--- |
| 1. Concorrência otimista | 5/5 | — | ✅ concluído |
| 2. Convites / hierarquia | 6/6 | — | ✅ concluído (adaptado ao SSO) |
| 3. Gestão de empresas | 10/10 | — | ✅ concluído |
| 4. Responsável pelo lead | 4/4 | — | ✅ concluído |
| 5. Rastreabilidade | 3/3 | — | ✅ concluído |
| 6. Offboarding | 4/4 | — | ✅ concluído |

### Ordem recomendada (histórico de execução)

1. ~~**6.2 (contexto revogado)**~~ — ✅ **concluído**.
2. ~~**6.1 (endpoint de revogação)**~~ — ✅ **concluído** com soft delete, herança de leads e proteção de lockout ([ADR 004](../Calango-docs/docs/ADRs/004-vinculo-usuario-empresa.md)).
3. ~~**4.4 (fechar a atribuição)**~~ — ✅ **concluído** em 2026-10-28.
4. ~~**5.1 → 5.2 → 5.3 (rastreabilidade)**~~ — ✅ **concluído** em 2026-10-29 com plugin de auditoria + `AsyncLocalStorage`.
5. ~~**6.3 + 6.4 (transferência em lote + UI)**~~ — ✅ **concluído** em 2026-10-29; o `deactivate` ganhou `transferTo` para o modal escolher o herdeiro.

### Dependências que não são óbvias

- **6.1 depende de 6.2** para ser efetivo (sem o 403, remover do array não corta o acesso na sessão corrente).
- **6.4 depende de 6.3** (o modal precisa do endpoint de transferência e de uma contagem de leads por usuário).
- **5.2 e 6.3 mexem no mesmo `contactController`** — se feitos em paralelo por engano, geram conflito de merge.
- **4.4 depende de decisão de produto**, não de código. Decisão tomada (admin-only) e item concluído.

### Evidências usadas na verificação

- `optimisticConcurrency: true` em Contact, Appointment, BusinessConfig, Campaign, Tag, Session, Invite.
- 409 retornado por contactController, assignmentController, appointmentRoutes, businessRoutes, campaignRoutes, tagService.
- `__v` enviado pelo frontend em 12 componentes + tratamento de 409 em 14 pontos.
- `/api/v1/auth/switch-business` e `/api/v1/business/create` registrados; `Menu` com `isDisabled` na empresa ativa e `MenuDivider` + "Criar nova empresa".
- Socket: `join_session` no connect e `leave_session` no cleanup, com `activeBusinessId` nas dependências.
- `assignedTo` em `Contact` e `Appointment`; filtro por papel em `contactController`.
- `auditPlugin` aplicado a Contact/Appointment/BusinessConfig; `auditContextMiddleware` no `server.js`; `setAuditActor` no `authenticateToken`.
- `POST /api/v1/contacts/bulk-transfer` e `PATCH /api/v1/business/team/:userId/deactivate` registrados com `requireAdmin`.
- `GET /api/v1/business/team/:userId/lead-count` consumido pelo `TeamTab`.
- Testes: `tests/integration/audit.test.js` (6) e `tests/integration/membership_offboarding.test.js` (8) — 14/14 verdes.
- Frontend: `npm run build` concluído sem erros.

### Pendências conhecidas (fora do escopo deste roadmap)

- **UI não lista membros inativos.** `/business/team` filtra apenas vínculos ativos, então o histórico de offboarding só é visível no banco. Se for necessário auditar "quem já passou por aqui" pela tela, é preciso um endpoint separado (`?includeInactive=true`) — não feito para não misturar membros atuais com histórico.
- **Agendamentos não são herdados no offboarding** (só contatos). Decisão consciente: agendamento tem dono operacional (`assignedTo`) mas transferi-lo automaticamente poderia jogar uma agenda cheia em alguém indisponível.
- **Divergência de índice em `BusinessConfig.phoneNumber`** (schema `partialFilterExpression` × banco `sparse`). Funcionalmente equivalente; alinhar com drop+create explícito quando implementar "desconectar WhatsApp". **Nunca** rodar `syncIndexes()`, que removeria o índice órfão `userId_1`.
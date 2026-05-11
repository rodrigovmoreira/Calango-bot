📋 Roadmap Calango Bot Multi-Usuários (MVP)
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

[ ] 2.2 Tabela de Convites (MongoDB): Criar a coleção Invites (backend/models/Invite.js com token, businessId, role, status, expiresAt).

[ ] 2.3 Middlewares de Segurança (Node.js): Ajustar o backend/middleware/auth.js para validar ações usando o activeBusinessId do usuário. Criar também um middleware requireAdmin para proteger rotas sensíveis.

[ ] 2.4 Endpoints de Convite (Node.js): No authRoutes.js (ou businessRoutes.js), criar POST /api/invites para o Admin gerar links. Ajustar o POST /api/auth/register para ler um inviteToken e vincular o usuário à empresa existente em vez de criar uma nova.

[ ] 2.5 UI de Gestão de Equipe (React/Chakra UI): Criar a tela de Configurações de Equipe no painel, contendo a tabela de membros, papéis e o botão "Gerar Link de Convite".

[ ] 2.6 Tela Pública de Onboarding (React/Vite): Criar a rota frontend /invite/:token com a mensagem de boas-vindas ("Você foi convidado") e o formulário de cadastro/login vinculado.

🎯 Ponto 3: Atribuição de Responsável (O "Dono do Lead")
Objetivo: Organizar quem atende quem e evitar colisões no funil de vendas.

[ ] 3.1 Modelagem do Lead (MongoDB): Adicionar o campo assignedTo (Referência ao ID do SystemUser) em backend/models/Contact.js e backend/models/Appointment.js.

[ ] 3.2 Filtro por Papel (Node.js): Ajustar o método de listagem no contactController.js. Se a role for operator, retornar apenas contatos onde assignedTo == userId (ou contatos sem dono). Se for admin, retornar todos.

[ ] 3.3 Endpoints de Atribuição (Node.js): Criar a rota PATCH /api/contacts/:id/assign no contactRoutes.js para atribuir ou trocar o dono de um contato.

[ ] 3.4 Interface do Kanban (React/Chakra UI): No componente FunnelCard.jsx, exibir um Avatar pequeno com as iniciais do responsável. Dentro dos detalhes do contato, adicionar um Dropdown/Select para "Passar a bola" para outro vendedor.

🕵️‍♂️ Ponto 4: Rastreabilidade Básica (Log Versão Lite)
Objetivo: Saber quem fez o que no sistema em caso de erros ou auditorias rápidas.

[ ] 4.1 Campos de Log (MongoDB): Adicionar createdBy e lastUpdatedBy (Refs de SystemUser) nos Schemas principais (Contact.js, Appointment.js, BusinessConfig.js).

[ ] 4.2 Injeção Automática (Node.js): Nos controllers, interceptar as requisições de criação (POST) e atualização (PUT/PATCH) para injetar automaticamente o ID do usuário autenticado (req.user.id) nesses campos antes do save().

[ ] 4.3 Visibilidade Simplificada (React/Chakra UI): Adicionar um rodapé sutil nos modais de edição de itens no frontend: "Criado por [Nome] em [Data] - Última alteração por [Nome]".

🚪 Ponto 5: O Offboarding (Revogação de Acesso e "Herança" de Leads)
Objetivo: Remover usuários sem quebrar a rastreabilidade e redistribuir os clientes órfãos.

[ ] 5.1 Endpoint de Inativação (Node.js): Criar rota no backend para o Admin inativar/remover o acesso de um usuário ao negócio (atualizando o array businesses no SystemUser.js).

[ ] 5.2 Derrubar Sessão (Node.js): Na lógica do backend/middleware/auth.js, se o usuário tentar acessar com um activeBusinessId do qual foi removido/bloqueado, invalidar a ação e retornar status 403 (forçando logout ou troca de empresa no frontend).

[ ] 5.3 Transferência em Lote (Node.js): Criar rota POST /api/contacts/bulk-transfer no contactRoutes.js que busca todos os contatos associados ao "Usuário A" e altera o assignedTo para o "Usuário B".

[ ] 5.4 Fluxo de Demissão na UI (React/Chakra UI): Na tela de equipe, ao clicar em "Remover Usuário", abrir um Modal de aviso. Adicionar um select opcional: "Este usuário possui X leads em aberto. Deseja transferi-los para:", listando a equipe restante.

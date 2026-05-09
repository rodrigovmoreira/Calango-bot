# 🦎 Calango Bot - Contexto do Projeto para IAs

## 🎯 Visão do Produto
O Calango Bot é um **CRM SaaS Omnichannel** focado em atendimento automatizado via WhatsApp. Seu diferencial competitivo é ser um **"Camaleão"**: o sistema é agnóstico a nichos. Através de configurações de IA e personalização de interface, ele se adapta perfeitamente a Estúdios de Tatuagem, ONGs (Assistência Social), Prefeituras (Secretarias), Clínicas ou qualquer negócio que dependa de um fluxo constante de contatos.

O sistema é construído para suportar **Múltiplos Usuários** (equipes com diferentes permissões) e **Múltiplos WhatsApps** (Omnichannel/Multi-agentes) dentro de uma mesma conta empresarial.

## 🛠️ Stack Tecnológica
### **Backend & Integrações**
- **Runtime:** Node.js com Express.js.
- **Banco de Dados:** MongoDB via Mongoose.
- **Comunicação WhatsApp:** `whatsapp-web.js` (Puppeteer) rodando instâncias em paralelo.
- **Cérebro de IA:** LLMs (DeepSeek-V3 / Gemini 1.5 Pro) com suporte nativo a **Function Calling**.
- **Real-time:** Socket.io para atualização de status de conexão, leitura de QR Code e chat ao vivo.

### **Frontend**
- **Framework:** React 18+ com Vite.
- **UI Kit:** Chakra UI (Design System baseado em Dark/Light mode nativo).
- **Navegação:** React Router v6.
- **Estado Global:** Context API + useReducer (`AppContext` / Hook `useApp`).
- **Animações:** Framer Motion (usado em loaders como o `SmartLoader`).
- **Componentes de Terceiros:** `react-big-calendar` (agendamentos), `@hello-pangea/dnd` (Kanban).

## 🏗️ Arquitetura Core (Regras de Negócio OBRIGATÓRIAS)

### 1. Multi-Tenancy (Isolamento por Negócio)
- O **`businessId`** é a chave primária de isolamento. Todos os dados (`Contact`, `Message`, `Appointment`, `Tag`) devem pertencer a uma `BusinessConfig`.
- **SystemUser:** Um usuário pode pertencer a vários negócios via array `businesses: [{ businessId, role }]`. Ele navega no sistema através do `activeBusinessId`. As buscas no banco devem sempre usar o `activeBusinessId` do usuário logado.

### 2. Omnichannel & Sessões
- **Múltiplos WhatsApps:** Uma empresa pode conectar vários números. Cada conexão é um documento no model `Session.js`.
- **Diferenciação de IDs:**
    - `whatsappSessionId` (ObjectId): Carimbo obrigatório para dados originados no WhatsApp. Identifica qual "aparelho/atendente" é o dono daquele contato ou mensagem.
    - `sessionId` (String): Campo legado, agora reservado EXCLUSIVAMENTE para usuários anônimos do Web Chat.

### 3. IA com Consciência de Canal e Etapa
- A IA do Calango Bot possui prompts multidimensionais:
    - **Global:** Instruções gerais da empresa.
    - **Visão:** Prompt para análise de imagens e comprovantes.
    - **Etapa do Funil:** Cada coluna do Kanban possui um prompt único. Se o lead está na etapa "Aguardando Documentos", a IA deve focar exclusivamente em cobrar esses arquivos.

### 4. CRM e Funil de Vendas (Kanban Dinâmico)
- O Kanban é construído com base nas **Tags** do sistema. O usuário define a ordem das tags, e cada tag vira uma coluna.
- O utilitário `funnelUtils.js` agrupa contatos com base na tag de maior prioridade (definida pela ordem do funil).

## 🗄️ Modelo de Dados e Integridade

### 🛡️ Controle de Concorrência Otimista (Optimistic Concurrency)
- **Regra de Ouro:** Nenhuma edição deve sobrescrever dados silenciosamente.
- Todos os Schemas principais utilizam `{ optimisticConcurrency: true }` e o campo de versão `__v`.
- **Backend:** Updates via `findOneAndUpdate` ou `.save()` devem validar o `__v` vindo do frontend. Falhas de versão (quando o banco está mais atual que o payload) devem retornar **HTTP 409 Conflict**.
- **Frontend:** Implementa **Payloads Inteligentes**. Apenas os campos efetivamente alterados pelo usuário e o `__v` original são enviados no `PUT/PATCH`.

### ☁️ Arquitetura de Arquivos (Serverless)
- O backend Node.js **não** processa uploads de arquivos. 
- O frontend utiliza o microserviço externo *Squamata-upload* para solicitar URLs assinadas e faz o upload **direto para o Firebase Storage** via `uploadHelper.js`.

## 🎨 Navegação e Performance do Frontend
- **Lazy Loading:** As abas do dashboard (`Catalog`, `Campaign`, `LiveChat`, etc.) são carregadas via `React.lazy` para otimizar o carregamento.
- **Interface de Abas:** A navegação interna do Dashboard não altera a URL (controlada pelo estado `activeTab`).
- **Dark Mode First:** Todo componente deve usar o hook `useColorModeValue` para garantir suporte total aos temas Light e Dark.

## ⚠️ Filosofia de Design para Desenvolvedores e IAs
1. **Abstração de Nicho:** Nunca use termos específicos como "Tatuagem", "Cidadão" ou "Paciente" no código do backend. Use termos genéricos: `Contact`, `Deal`, `Service`, `Appointment`. A personalização de nomes ocorre apenas na interface.
2. **Modularidade de Ferramentas (Function Calling):** Novas capacidades da IA (ex: "verificar estoque") devem ser criadas como ferramentas isoladas em `aiTools.js`.
3. **Segurança de Rota:** Todas as rotas de API devem passar pelo middleware `authenticateToken`. Operações que alteram a estrutura da conta exigem o middleware `requireAdmin`.
4. **Retrocompatibilidade:** Ao introduzir novas lógicas (como o `whatsappSessionId`), mantenha compatibilidade com os dados antigos até que uma rotina de migração completa seja executada.

---

**Instrução para a IA:**
*Ao ler este arquivo, você concorda em seguir os padrões de código limpo, respeitar o bloqueio de concorrência otimista e garantir que o sistema continue sendo um "camaleão" adaptável a qualquer negócio.*
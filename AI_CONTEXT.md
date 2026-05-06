# 🦎 Calango Bot - Contexto do Projeto para IAs

## 🎯 Visão do Produto
O Calango Bot é um CRM SaaS Omnichannel, focado em atendimento via WhatsApp com inteligência artificial. Seu maior diferencial é ser um **"Camaleão"**: a interface e os funis se adaptam ao nicho do cliente (Estúdios de Tatuagem, ONGs, Prefeituras, Clínicas) usando os mesmos modelos de banco de dados por baixo dos panos. O sistema suporta equipes (Multi-Usuários) e múltiplos números de WhatsApp por negócio (Multi-Agentes).

## 🛠️ Stack Tecnológica
- **Backend:** Node.js, Express.js.
- **Banco de Dados:** MongoDB (Mongoose).
- **Frontend:** React, Vite, Chakra UI.
- **WhatsApp:** whatsapp-web.js.
- **IA:** Integração com LLMs (DeepSeek/Gemini) com suporte a Function Calling.

## 🏗️ Arquitetura Core (Regras de Negócio OBRIGATÓRIAS)
1. **Multi-Tenancy (Isolamento por Negócio):**
   - O coração do isolamento é o `businessId`. Todos os dados pertencem a uma `BusinessConfig` (A Empresa).
   - Um `SystemUser` pode pertencer a vários negócios, controlado pelo array `businesses: [{ businessId, role }]` e navega usando o `activeBusinessId`.

2. **Omnichannel (Múltiplos WhatsApps):**
   - Uma empresa pode ter várias sessões conectadas. A coleção `Session.js` dita as conexões.
   - Todo dado gerado via WhatsApp (Contatos, Mensagens, Agendamentos) recebe o carimbo `whatsappSessionId` (Referência a Session) para não misturar clientes de atendentes diferentes.
   - O campo antigo `sessionId` (String) é reservado EXCLUSIVAMENTE para o Web Chat.

3. **Function Calling (Ações da IA):**
   - A IA do Calango Bot não apenas conversa, ela *age*. Ela consulta catálogos, lê a agenda e movimenta leads no Kanban automaticamente baseado nas intenções do usuário.

## ⚠️ Filosofia de Design para a IA Assistente
- **Nunca engesse o código:** O termo "Venda" ou "Lead" é apenas visual no frontend. O backend deve usar termos genéricos (`Contact`, `Deal`, `Appointment`).
- **Pense de forma modular:** Ferramentas novas devem ser acopláveis sem quebrar o ecossistema existente.
# 🤖 Calango Bot 

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Twilio](https://img.shields.io/badge/Twilio-API-red?logo=twilio)](https://www.twilio.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek-blue)](https://deepseek.com/)

Um SaaS de atendimento automatizado para WhatsApp focado no nicho de Tatuagem (MVP). Utiliza a API oficial do Twilio para comunicação e IA Generativa (DeepSeek) para atuar como um "Vendedor Especialista", realizando triagem e tirando dúvidas de clientes.

---

## 🏗️ Arquitetura do Projeto

O projeto funciona em arquitetura **Monorepo** (Frontend e Backend na mesma pasta raiz):

- **Backend (Porta 3001):** Node.js + Express. Gerencia o Webhook do Twilio, conecta com a IA e Banco de Dados.
- **Frontend (Porta 3000):** React + Chakra UI. Painel administrativo (Dashboard) para visualização de status.
- **Túnel (Ngrok):** Expõe o backend local para a nuvem do Twilio.

---

## ✅ Pré-requisitos (Checklist de Setup)

Antes de rodar, você precisa ter:

1.  **Node.js** instalado.
2.  **Conta no MongoDB Atlas:** Cluster criado e string de conexão (`mongodb+srv://...`).
3.  **Conta no Twilio:**
    - Account SID e Auth Token.
    - Número da Sandbox configurado (Ex: `whatsapp:+14155238886`).
4.  **Chave de API DeepSeek:** Para o cérebro da IA.
5.  **Ngrok:** Instalado para criar o túnel de conexão.

---

## 🚀 Instalação e Configuração

### 1. Instalar Dependências
Na pasta raiz do projeto, execute o comando que instala tudo (Backend e Frontend):
```bash
npm run install:all
``` 

## .env - Pasta backend
Na pasta de backend é necessário criar o arquivo .env com as chaves de API que são usadas no projeto
```bash
# Banco de dados
MONGO_URI=sua_string_conexao_mongo

# Chave aleatória para acesso
JWT_SECRET=sua_senha_secreta_jwt

# Inteligência Artificial
DEEPSEEK_API_KEY=sua_chave_deepseek
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
GEMINI_API_KEY=sua_chave_gemini_api_key
CLOUDINARY_CLOUD_NAME=nome_da_sua_conta
CLOUDINARY_API_KEY=sua_chave_de_api
CLOUDINARY_API_SECRET=sua_senha_de_api

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
``` 
Atenção: O TWILIO_WHATSAPP_NUMBER deve ser o número da Sandbox do Twilio, não o seu pessoal.

## .env - Pasta frontend
Na pasta frontend é necessário criar o arquivo .env para determinar a porta de acesso usada no projeto
```bash
#Grava o caminho padrão da porta de acesso do frontend
REACT_APP_API_URL=http://localhotst:3000
REACT_APP_WS_URL=http://localhost:3000
``` 

## ▶️ Como Rodar o Projeto (Passo a Passo)

Para que o WhatsApp funcione localmente, precisamos de 2 terminais abertos.

Passo 1: Subir o Túnel (Terminal 1)
Expõe a porta do backend para a internet.
``` bash
ngrok http 3001
```
Copie a URL gerada (ex: https://a1b2-c3d4.ngrok-free.app).

Passo 2: Configurar o Webhook no Twilio
Vá no Console Twilio > Messaging > Settings > WhatsApp Sandbox Settings.

No campo "When a message comes in", cole a URL do Ngrok seguida de /api/webhook.

Exemplo: https://a1b2-c3d4.ngrok-free.app/api/webhook

Salve a configuração.

Passo 3: Iniciar a Aplicação (Terminal 2)
Na pasta raiz do projeto:
``` bash
npm start
```
Isso iniciará o Backend (3001) e o Frontend (3000) simultaneamente.

## 🧠 Modo Concierge (Personalização)
Nesta fase de MVP, a personalização do comportamento do bot é feita diretamente no MongoDB Compass (ou Atlas), sem necessidade de interface gráfica.

Abra a coleção businessconfigs.

Edite o campo systemPrompt para mudar a personalidade.

Exemplo de Prompt para Tatuador:
``` bash
Você é o assistente do Ink Master Studio.
Use gírias leves de tatuagem.
Regras:
1. Nunca dê preço exato sem ver foto.
2. Explique que usamos materiais descartáveis.
3. Tente agendar uma visita.
```

## 🛠️ Comandos Úteis
npm start: Roda Backend e Frontend (Dev Mode).
npm run install:all: Instala dependências de todas as pastas.

## 🤝 Como Contribuir
- Faça um fork do projeto
- Crie sua branch (git checkout -b feature/nova-feature)
- Commit suas mudanças (git commit -m 'Adiciona nova feature')
- Push para a branch (git push origin feature/nova-feature)
- Abra um Pull Request

## 
Desenvolvido com ❤️ por Rodrigo Vasconcelos Moreira

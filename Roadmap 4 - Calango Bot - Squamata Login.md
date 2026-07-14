# 🗺️ Roadmap de Integração: Squamata-Login 🤝 Calango-Bot

> **Modelo de referência**: A integração já funciona no **Calango-food**. Este roadmap replica o mesmo padrão SSO, adaptado às particularidades do Calango-Bot (multi-tenancy, roles, invites).

---

## 📋 Resumo da Arquitetura Final

```
┌──────────────────┐      ┌───────────────────────┐     ┌───────────────────┐
│  Calango-Bot     │      │   Squamata-Login      │     │  Calango-Bot      │
│   Frontend       │────▶│     Frontend          │────▶│    Backend        │
│  host:3004       │      │    host:5174          │     │   host:3003       │
│  (cont:3000)     │      │   (cont:5174)         │     │  (cont:3001)      │
└──────────────────┘      └───────────────────────┘     └───────────────────┘
       │                          │                          │
       │                          ▼                          │
       │                ┌─────────────────────┐              │
       │                │  Squamata-Login     │              │
       │                │     Backend         │──────────────┤
       │                │    host:3001        │ JWT_SECRET   │
       │                │   (cont:3001)       │compartilhada │
       │                └─────────────────────┘              │
       │                                                     │
       ▼                                                     ▼
  localStorage              MongoDB                        MongoDB
  (token, user)        (squamata_login_db)           (chatbot-platform)

Fluxo:
1. Usuário clica "Entrar" no Calango-Bot (http://localhost:3004) → redirecionado ao Squamata-Login (http://localhost:5174)
2. Squamata-Login autentica (email/senha ou Google OAuth)
3. Squamata-Login redireciona de volta ao Calango-Bot com token JWT na URL (http://localhost:3004/auth/callback?token=...)
4. Calango-Bot captura o token, salva no localStorage, redireciona ao Dashboard
5. Toda requisição ao backend do Calango-Bot envia `Authorization: Bearer <token>` para http://localhost:3003
6. Backend do Calango-Bot valida o token usando o JWT_SECRET compartilhado
```

**Payload do token JWT** (emitido pelo Squamata-Login):
```json
{
  "uid": "<MongoDB ObjectId do Squamata>",
  "email": "usuario@exemplo.com",
  "appSlug": "calango-bot",
  "tenantId": "default",
  "iat": 1234567890,
  "exp": 1234654290
}
```

---

## 🔧 Fase 0: Pré-requisitos (Infraestrutura e Configuração)

### 0.1 Sincronizar `JWT_SECRET`

**Arquivo**: `c:\Calango-bot\.env`

Copie o valor de `JWT_SECRET` do `.env` do Squamata-Login **exatamente igual** para o `.env` do Calango-Bot:

```env
# No Calango-bot/.env - DEVE SER IDÊNTICO ao Squamata-login/.env
JWT_SECRET=6vDB0x1y2dwqtii4udYKeiImV3Uwgrydmfrmys49bwy4xScpPzdDSkKCpOJ0aew5
```

> ⚠️ **Crítico**: Se este valor for diferente, o backend do Calango-Bot rejeitará todos os tokens do Squamata como inválidos.

### 0.2 Conectar à Rede Docker `squamata-global`

**Arquivo**: `c:\Calango-bot\docker-compose.yml`

Adicione a rede externa `squamata-global` aos serviços do Calango-Bot para que eles consigam resolver o hostname `squamata-login-backend`:

```yaml
# Adicionar em cada serviço:
networks:
  - default
  - squamata-global

# No final do arquivo:
networks:
  squamata-global:
    external: true
```

### 0.3 Configurar Variáveis de Ambiente no Frontend

**Arquivo**: `c:\Calango-bot\frontend\.env` (criar se não existir)

```env
# URL do Squamata-Login (Identity Provider)
REACT_APP_LOGIN_URL=http://localhost:5174

# URL do backend do Calango-Bot → host mapeia 3003→3001 (container)
REACT_APP_API_URL=http://localhost:3003
```

> 📝 **Nota**: `REACT_APP_API_URL` usa a porta **host** `3003` (não a interna `3001` do container). No navegador, `localhost:3001` é o Squamata-Login Backend. O Vite do Calango-Bot usa prefixo `REACT_APP_` (não `VITE_`). Verifique se o `vite.config.js` expõe essas variáveis via `define` ou `envPrefix`.

### 0.4 Adicionar Redirecionamento SSO para `calango-bot` no Squamata-Login

**Arquivo**: `c:\Squamata-login\packages\frontend\src\pages\Login.jsx`

O Squamata-Login já redireciona automaticamente para o Calango-Food quando `appSlug === 'calango-food'`. Precisamos adicionar o mesmo para `calango-bot`.

**Localizar** (aproximadamente linha 72-76, dentro do `useEffect` e do `handleAuth`):
```jsx
// Redirecionamento SSO para Calango Food
if (finalSlug === 'calango-food') {
  localStorage.removeItem('sso_target_slug');
  localStorage.removeItem('sso_target_tenant');
  window.location.href = `${import.meta.env.VITE_CALANGO_FOOD_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`;
  return;
}
```

**Adicionar logo abaixo**:
```jsx
// Redirecionamento SSO para Calango Bot
if (finalSlug === 'calango-bot') {
  localStorage.removeItem('sso_target_slug');
  localStorage.removeItem('sso_target_tenant');
  window.location.href = `${import.meta.env.VITE_CALANGO_BOT_URL || 'http://localhost:3004'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`;
  return;
}
```

Isso precisa ser adicionado em **2 lugares** no `Login.jsx`:
1. No `useEffect` (captura do token do Google OAuth) — ~linha 72
2. No `handleAuth` (após login/register por email) — ~linha 148

Também adicione a env var no `docker-compose.yml` do Squamata-Login:
```yaml
squamata-login-frontend:
  build:
    args:
      - VITE_CALANGO_BOT_URL=http://localhost:3004  # host → calango-bot-frontend
```

---

## 🔐 Fase 1: Backend — Middleware de Autenticação

> **Arquivo principal**: `c:\Calango-bot\backend\middleware\auth.js`

### 1.1 Reescrever `authenticateToken` para validar tokens do Squamata

O middleware atual espera um payload Calango-Bot: `{ userId, activeBusinessId, role }`.  
O token do Squamata vem com: `{ uid, email, appSlug, tenantId }`.

**Nova lógica do middleware**:

```js
import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  try {
    // 1. Validar assinatura com o segredo COMPARTILHADO do Squamata
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    // decoded = { uid, email, appSlug, tenantId, iat, exp }

    // 2. Verificar se o token é para este app
    if (decoded.appSlug && decoded.appSlug !== 'calango-bot') {
      return res.status(403).json({ message: 'Token não autorizado para esta aplicação' });
    }

    // 3. UPSERT: Encontrar ou criar o SystemUser local (espelhamento)
    let user = await SystemUser.findOne({ email: decoded.email });

    if (!user) {
      // Primeiro acesso: criar usuário espelho
      user = await SystemUser.create({
        name: decoded.email.split('@')[0], // nome provisório
        email: decoded.email,
        password: 'sso_placeholder_do_not_use', // placeholder, nunca usado
        isVerified: true,                       // já validado pelo Squamata
        isActive: true
      });
      console.log(`🆕 SystemUser criado via SSO: ${decoded.email}`);
    }

    // 4. Resolver BusinessConfig a partir do tenantId
    const tenantId = decoded.tenantId || 'default';
    let businessConfig = null;

    if (tenantId !== 'default') {
      // Buscar por ID se for um ObjectId válido
      businessConfig = await BusinessConfig.findById(tenantId);
    }

    if (!businessConfig) {
      // Fallback: pegar o primeiro negócio do usuário ou criar um default
      if (user.businesses && user.businesses.length > 0) {
        const firstBusiness = user.businesses[0];
        user.activeBusinessId = firstBusiness.businessId;
        await user.save();
      } else {
        // Criar um BusinessConfig default para o usuário
        businessConfig = await BusinessConfig.create({
          businessName: `Empresa de ${decoded.email}`,
          phoneNumber: '5511999999999',
          prompts: {
            chatSystem: 'Você é um assistente virtual.',
            visionSystem: ''
          }
        });
        user.businesses.push({ businessId: businessConfig._id, role: 'admin' });
        user.activeBusinessId = businessConfig._id;
        await user.save();
        console.log(`🏢 BusinessConfig criado via SSO para: ${decoded.email}`);
      }
    }

    if (!user.activeBusinessId) {
      return res.status(400).json({ 
        message: 'Nenhum negócio configurado. Contate o suporte.' 
      });
    }

    // 5. Determinar role do usuário no negócio ativo
    let role = 'operator';
    if (user.businesses && user.activeBusinessId) {
      const businessInfo = user.businesses.find(b => 
        b.businessId.toString() === user.activeBusinessId.toString()
      );
      if (businessInfo) role = businessInfo.role;
    }

    // 6. Popular req.user (mantendo contrato interno existente)
    req.user = {
      userId: user._id,
      email: decoded.email,
      activeBusinessId: user.activeBusinessId,
      role: role,
      squamataUid: decoded.uid  // referência ao ID do Squamata (útil para debug)
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado. Faça login novamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Token inválido' });
    }
    console.error('Erro no authenticateToken:', err);
    res.status(500).json({ message: 'Erro interno de autenticação' });
  }
};
```

### 1.2 `requireAdmin` permanece igual

O middleware `requireAdmin` não precisa ser alterado — ele continua funcionando com `req.user.role` que populamos no passo 5 acima.

### 1.3 Resumo das Mudanças no `auth.js`

| Antes | Depois |
|-------|--------|
| Payload: `{ userId, activeBusinessId, role }` | Payload: `{ uid, email, appSlug, tenantId }` |
| Fallback para tokens antigos (consulta DB) | Busca/upsert SEMPRE (espelhamento) |
| `req.user = { userId, activeBusinessId, role }` | Igual + `email` e `squamataUid` |
| `jwt.verify` com callback async | `jwt.verify` com try/catch + await |

---

## 🧹 Fase 2: Backend — Limpeza de Rotas e Dependências

> **Arquivo principal**: `c:\Calango-bot\backend\routes\authRoutes.js`

### 2.1 Rotas a DESATIVAR (retornar erro de redirecionamento)

As seguintes rotas devem ser modificadas para retornar um erro claro instruindo o usuário a usar o portal central:

| Rota | Ação | Resposta |
|------|------|----------|
| `POST /api/auth/login` | Substituir handler | `{ message: 'Login local desativado. Use o portal central.', redirectUrl: '...' }` |
| `POST /api/auth/register` | Substituir handler | `{ message: 'Registro local desativado. Use o portal central.', redirectUrl: '...' }` |
| `POST /api/auth/verify-email` | Substituir handler | `{ message: 'Verificação gerenciada pelo portal central.' }` |
| `GET /api/auth/google` | Remover | Redirecionar para Squamata-Login |
| `GET /api/auth/google/callback` | Remover | Não será mais chamado |

**Código para rotas desativadas**:
```js
const LOGIN_URL = process.env.FRONTEND_LOGIN_URL || 'http://localhost:5174';

// Login local desativado
router.post('/login', (req, res) => {
  res.status(410).json({ 
    message: 'Login local desativado. Use o portal central de autenticação.',
    redirectUrl: `${LOGIN_URL}/login?appSlug=calango-bot`
  });
});

// Register local desativado
router.post('/register', (req, res) => {
  res.status(410).json({ 
    message: 'Registro local desativado. Use o portal central de autenticação.',
    redirectUrl: `${LOGIN_URL}/login?appSlug=calango-bot`
  });
});
```

### 2.2 Rotas a MANTER ativas

| Rota | Por quê |
|------|---------|
| `POST /api/auth/switch-business` | Troca de contexto multi-tenant (CRM-specific) |
| `POST /api/auth/logout` | Limpeza de sessão WhatsApp + cookie |
| `PUT /api/auth/update` | Atualização de perfil (avatar, nome) |
| `POST /api/auth/invites` | Convites de equipe (CRM-specific) |
| `GET /api/auth/invites/:token` | Validação pública de convite |
| `GET /api/auth/profile` | **(NOVO)** Retornar dados do usuário logado |

### 2.3 Adicionar `GET /api/auth/profile`

Seguindo o padrão do Calango-food, adicionar uma rota de perfil que também serve como lazy initialization:

```js
// ROTA: /api/auth/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await SystemUser.findById(req.user.userId)
      .populate('businesses.businessId', 'businessName');
    
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      activeBusinessId: user.activeBusinessId,
      businesses: user.businesses,
      role: req.user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});
```

### 2.4 Remover Passport do `server.js`

**Arquivo**: `c:\Calango-bot\backend\server.js`

Remover ou comentar:
```js
// import passport from 'passport';           // ← remover
// import './config/passport.js';             // ← remover
// app.use(passport.initialize());            // ← remover
```

### 2.5 Limpeza Opcional de Dependências

**Arquivo**: `c:\Calango-bot\backend\package.json`

Dependências que podem ser removidas (após confirmar que não há mais referências):
- `bcryptjs` — senhas agora são gerenciadas pelo Squamata
- `passport` — OAuth agora é delegado ao Squamata
- `passport-google-oauth20` — idem
- `passport-local` — idem

> ⚠️ **Cuidado**: O model `SystemUser.js` tem um `pre('save')` hook que usa `bcrypt`. Mantenha o `bcryptjs` até refatorar o model (passo 2.6).

### 2.6 Ajustar Model `SystemUser`

**Arquivo**: `c:\Calango-bot\backend\models\SystemUser.js`

O campo `password` atualmente é `required: true`. Para usuários SSO, usamos placeholder `'sso_placeholder_do_not_use'`. Ajustes:

```js
password: {
  type: String,
  required: false,  // ← mudar de true para false (SSO users não têm senha real)
  minlength: 6,
  select: false
},
```

E no `pre('save')` hook, pular o hash se a senha for o placeholder:
```js
systemUserSchema.pre('save', async function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  
  // Pular hash para placeholder de SSO
  if (!this.isModified('password') || this.password === 'sso_placeholder_do_not_use') {
    return next();
  }
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});
```

---

## 🎨 Fase 3: Frontend — Login SSO e Callback

### 3.1 Reescrever `Login.jsx`

**Arquivo**: `c:\Calango-bot\frontend\src\pages\Login.jsx`

Substituir todo o conteúdo por uma página simples com botão de SSO:

```jsx
import React from 'react';
import {
  Box, Container, VStack, Heading, Text, Button, Card, CardBody,
  useColorModeValue, Flex, Image
} from '@chakra-ui/react';
import { FaShieldAlt } from 'react-icons/fa';
import ColorModeToggle from '../components/ColorModeToggle';

const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';

const Login = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('brand.600', 'brand.200');

  const handleSSOLogin = () => {
    // Redireciona ao Squamata-Login com appSlug=calango-bot
    window.location.href = `${LOGIN_URL}/login?appSlug=calango-bot&tenantId=default`;
  };

  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center" p={4}>
      <Box position="absolute" top={4} right={4}>
        <ColorModeToggle />
      </Box>
      
      <Container maxW="md">
        <Card bg={cardBg} boxShadow="2xl" borderRadius="2xl">
          <CardBody p={10}>
            <VStack gap={6}>
              <Box bg="brand.500" p={5} borderRadius="full">
                <FaShieldAlt size={48} color="white" />
              </Box>
              
              <Heading size="lg" color={headingColor} textAlign="center">
                Calango, Inc.
              </Heading>
              
              <Text color="gray.500" textAlign="center" fontSize="md">
                CRM Inteligente para WhatsApp
              </Text>

              <Button
                size="lg"
                colorScheme="brand"
                w="full"
                onClick={handleSSOLogin}
                leftIcon={<FaShieldAlt />}
              >
                Entrar com a Conta Central
              </Button>

              <Text fontSize="xs" color="gray.400" textAlign="center">
                Autenticação gerenciada pelo Squamata Identity.
                <br />
                Use suas credenciais centralizadas da Calango, Inc.
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Flex>
  );
};

export default Login;
```

### 3.2 Criar `AuthCallback.jsx`

**Arquivo NOVO**: `c:\Calango-bot\frontend\src\pages\AuthCallback.jsx`

Baseado no componente homônimo do Calango-food (`c:\Calango-food\packages\frontend\src\pages\AuthCallback.jsx`):

```jsx
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Flex, Spinner, Text, VStack } from '@chakra-ui/react';

const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');

    if (token && userStr) {
      hasProcessed.current = true;
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({ type: 'SET_USER', payload: user });
        
        // Redirecionar ao dashboard (substitui a URL para limpar o token)
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Erro ao processar callback SSO:', err);
        window.location.href = `${LOGIN_URL}/login?appSlug=calango-bot&error=true`;
      }
    } else {
      // Strict Mode re-render: verificar se token já foi salvo
      const existingToken = localStorage.getItem('token');
      if (!existingToken) {
        console.warn('AuthCallback acessado sem token. Redirecionando ao login...');
        window.location.href = `${LOGIN_URL}/login?appSlug=calango-bot`;
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate, dispatch]);

  return (
    <Flex h="100vh" w="100vw" justify="center" align="center" bg="gray.50">
      <VStack gap={4}>
        <Spinner size="xl" color="brand.500" thickness="4px" />
        <Text fontSize="lg" color="gray.600">
          Autenticando com o Squamata Identity...
        </Text>
      </VStack>
    </Flex>
  );
};

export default AuthCallback;
```

### 3.3 Atualizar `App.js` — Rotas

**Arquivo**: `c:\Calango-bot\frontend\src\App.js`

Mudanças:

1. **Adicionar import** do `AuthCallback`:
```jsx
import AuthCallback from './pages/AuthCallback';
```

2. **Adicionar rota pública** para o callback:
```jsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

3. **Ajustar `ProtectedRoute`** — se não houver token, redirecionar ao Squamata (não ao `/login` local):
```jsx
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  React.useEffect(() => {
    if (!token) {
      const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';
      window.location.href = `${LOGIN_URL}/login?appSlug=calango-bot`;
    }
  }, [token]);
  return token ? children : null;
};
```

4. **Remover `PublicOnlyRoute`** (ou mantê-la redirecionando ao Squamata) — a página de login agora é só um botão de SSO.

### 3.4 Atualizar `api.js` — Interceptor 401

**Arquivo**: `c:\Calango-bot\frontend\src\services\api.js`

Alterar o interceptor de resposta para redirecionar ao Squamata-Login em vez do `/login` local:

```js
// Interceptor: Redireciona se Token expirar (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      if (window.location.pathname !== '/login') {
        const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';
        window.location.href = `${LOGIN_URL}/login?appSlug=calango-bot`;
      }
    }
    return Promise.reject(error);
  }
);
```

### 3.5 Remover/Arquivar `GoogleCallback.jsx`

**Arquivo**: `c:\Calango-bot\frontend\src\pages\GoogleCallback.jsx`

Este componente não será mais necessário (OAuth agora é gerenciado pelo Squamata). Pode ser removido ou renomeado para `GoogleCallback.jsx.bak`.

Remover também a rota correspondente em `App.js`:
```jsx
// REMOVER:
// <Route path="/google-callback" element={<GoogleCallback />} />
```

---

## ✅ Fase 4: Testes e Validação

### 4.1 Checklist de Testes

| # | Teste | Como validar | Resultado esperado |
|---|-------|-------------|-------------------|
| 1 | **Primeiro login (usuário novo)** | Acessar Calango-Bot, clicar "Entrar", fazer login no Squamata com um email nunca usado no Calango-Bot | SystemUser e BusinessConfig criados automaticamente. Redirecionado ao Dashboard. |
| 2 | **Login de retorno (usuário existente)** | Mesmo fluxo com email já cadastrado no Calango-Bot | Token validado, usuário reconhecido, redirecionado ao Dashboard sem duplicação. |
| 3 | **Google OAuth** | Clicar "Google" no Squamata-Login (com `appSlug=calango-bot`) | Callback redireciona ao Calango-Bot `/auth/callback` com token válido. |
| 4 | **Token expirado** | Alterar `expiresIn` para `'1s'` no Squamata, esperar expirar, fazer requisição | Backend retorna 401, frontend redireciona ao Squamata-Login. |
| 5 | **Switch Business** | Logado, trocar de empresa ativa no seletor do Dashboard | `POST /api/auth/switch-business` funciona, `activeBusinessId` atualizado. |
| 6 | **Convites (invite)** | Admin cria invite, usuário SSO recebe token de invite | Fluxo de invite funciona com usuário SSO (aceitar invite após login). |
| 7 | **Logout** | Clicar "Sair" no Dashboard | Sessão WhatsApp parada, token removido, redirecionado ao Squamata. |
| 8 | **Acesso direto a rota protegida** | Acessar `/dashboard` sem token | Redirecionado ao Squamata-Login. |
| 9 | **Multi-tenant** | Usuário com 2+ BusinessConfigs | Seletor de empresa mostra todas, troca funciona. |
| 10 | **Avatar upload** | Atualizar foto de perfil | `PUT /api/auth/update` funciona com token Squamata. |

### 4.2 Variáveis de Ambiente Finais

Após a integração, o `.env` do Calango-Bot (raiz) deve conter:

```env
# JWT (COMPARTILHADO com Squamata-Login)
JWT_SECRET=6vDB0x1y2dwqtii4udYKeiImV3Uwgrydmfrmys49bwy4xScpPzdDSkKCpOJ0aew5

# URLs (portas HOST)
FRONTEND_LOGIN_URL=http://localhost:5174
BACKEND_PORT=3001                 # porta interna do container
MONGO_URI=mongodb://localhost:27017/chatbot-platform
```

E o frontend `.env`:
```env
REACT_APP_API_URL=http://localhost:3003     # host:3003 → calango-bot-backend (cont:3001)
REACT_APP_LOGIN_URL=http://localhost:5174   # host:5174 → squamata-login-frontend
```

---

## 📊 Resumo: Arquivos Modificados

### Squamata-Login (1 arquivo)
| Arquivo | Ação |
|---------|------|
| `packages/frontend/src/pages/Login.jsx` | Adicionar redirect SSO para `calango-bot` |
| `docker-compose.yml` | Adicionar `VITE_CALANGO_BOT_URL` build arg |

### Calango-Bot Backend (4 arquivos)
| Arquivo | Ação |
|---------|------|
| `backend/middleware/auth.js` | **REESCREVER**: validar token Squamata + upsert SystemUser |
| `backend/routes/authRoutes.js` | Desativar login/register/google, adicionar `/profile` |
| `backend/server.js` | Remover imports do Passport |
| `backend/models/SystemUser.js` | `password` opcional, pular hash do placeholder |

### Calango-Bot Frontend (4 arquivos)
| Arquivo | Ação |
|---------|------|
| `frontend/src/pages/Login.jsx` | **REESCREVER**: botão SSO "Entrar com Conta Central" |
| `frontend/src/pages/AuthCallback.jsx` | **CRIAR**: captura token da URL |
| `frontend/src/App.js` | Adicionar `/auth/callback`, ajustar ProtectedRoute |
| `frontend/src/services/api.js` | 401 → redirecionar ao Squamata-Login |

### Calango-Bot Config (2 arquivos)
| Arquivo | Ação |
|---------|------|
| `.env` | Copiar `JWT_SECRET` do Squamata |
| `docker-compose.yml` | Adicionar `squamata-global` network |

---

## ⚠️ Pontos de Atenção

1. **`JWT_SECRET` idêntico**: Se não for exatamente igual, nada funciona. Confira caractere por caractere.

2. **Mapeamento `tenantId` → `BusinessConfig`**: Na Fase 1.1, o mapeamento atual usa fallback para o primeiro negócio. Se o Calango-Bot tiver multi-tenancy real, refine esta lógica (ex: adicionar campo `squamataTenantId` ao model `BusinessConfig`).

3. **Convites (invites)**: O fluxo de invite atualmente espera `inviteToken` no body do login. Após SSO, o invite precisa ser tratado separadamente — ou via query param na URL de callback, ou via uma rota dedicada pós-login.

4. **Cookies**: O backend atualmente seta cookie `auth_token`. Após SSO, isso pode ser mantido ou removido — o frontend já envia o token via header `Authorization`. Recomendo manter o cookie como fallback.

5. **Rollback**: Mantenha um backup do `middleware/auth.js` e `routes/authRoutes.js` originais. Se algo quebrar em produção, o rollback é imediato.

6. **Squamata-Login rodando**: O serviço Squamata-Login precisa estar online e acessível. Se cair, ninguém loga em nenhum sistema Calango.

---

*Roadmap baseado na implementação de referência do Calango-food, testada e validada em produção.*

---

## 🖥️ Apêndice A: Mapeamento de Portas Docker (Servidor de Aplicação)

> Obtido via `docker ps` no servidor (Optiplex). Porto **Host** é o que o navegador e serviços externos acessam. Porto **Container** é o interno da rede Docker.

### Containers do Ecossistema Calango

| Container | Host → Container | Status | Rede |
|-----------|-----------------|--------|------|
| `squamata-login-backend` | `3001` → `3001` | ✅ healthy | `squamata-global` |
| `squamata-login-frontend` | `5174` → `5174` | ✅ healthy | `squamata-global` |
| `calango-bot-backend` | **`3003`** → `3001` | Up | `default` + `squamata-global` |
| `calango-bot-frontend` | **`3004`** → `3000` | Up | `default` + `squamata-global` |
| `squamata-upload` | `3005` → `3005` | ⚠️ unhealthy | `default` |
| `squamata-image-minio` | `9000-9001` → `9000-9001` | Up | `default` |
| `cloudflared` | — (túnel) | Up | `default` |

### Outros Containers (não afetados por esta integração)

| Container | Host → Container |
|-----------|-----------------|
| `project-ngo-backend` | `3010` → `3000` |
| `project-ngo-frontend` | `3011` → `80` |
| `marianos-meat` | `5175` → `80` |

### URLs de Acesso (Host Local)

| Serviço | URL |
|---------|-----|
| Squamata-Login Frontend | `http://localhost:5174` |
| Squamata-Login Backend | `http://localhost:3001/api/v1` |
| Calango-Bot Frontend | `http://localhost:3004` |
| Calango-Bot Backend | `http://localhost:3003` |
| Squamata Upload | `http://localhost:3005` |
| MinIO Console | `http://localhost:9001` |

### Variáveis de Ambiente com Portas Corrigidas

**Calango-Bot `.env` (raiz):**
```env
JWT_SECRET=<copiado do Squamata-login>
FRONTEND_LOGIN_URL=http://localhost:5174
BACKEND_PORT=3001              # porta interna do container
MONGO_URI=mongodb://...
```

**Calango-Bot `frontend/.env`:**
```env
REACT_APP_API_URL=http://localhost:3003    # host → calango-bot-backend
REACT_APP_LOGIN_URL=http://localhost:5174  # host → squamata-login-frontend
```

> ⚠️ **Importante**: `REACT_APP_API_URL` aponta para `3003` (porta host do backend), não `3001` (porta interna do container). No navegador, `localhost:3001` é o Squamata-Login, não o Calango-Bot.


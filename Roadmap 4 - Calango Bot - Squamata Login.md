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

## 🏁 Visão Geral dos Checkpoints

Cada checkpoint é **independente e testável**. Ao final de cada um, o sistema deve estar funcional e pronto para um commit seguro. Se algo quebrar, o rollback é isolado ao checkpoint atual.

```
Checkpoint 0     Checkpoint 1        Checkpoint 2         Checkpoint 3        Checkpoint 4
───────●────────────●────────────────────●─────────────────────●──────────────────●────────▶
       │            │                    │                     │                  │
   Infra +      Backend              Frontend              Backend           Middleware
   Config       Dual-Mode            SSO                   Limpeza           Final
                (aceita tokens       (Login + Callback     (desativa         (remove
                antigos E novos)      + App + API)          rotas antigas)    dual-mode)
                
  ✅ Login       ✅ Login antigo       ✅ Login antigo       ✅ Só SSO          ✅ Só SSO
     antigo         ainda funciona       ainda funciona        funciona          funciona
     funciona      ✅ Token Squamata     ✅ Fluxo SSO         ❌ Login antigo    🧹 Código
                    via curl funciona     completo              retorna 410       limpo
```

| CP | Nome | O que faz | Como testar | Risco |
|----|------|-----------|-------------|-------|
| **0** | Infra + Config | Sincroniza JWT_SECRET, rede Docker, variáveis de ambiente, redirect no Squamata | Login antigo do Calango-Bot continua funcionando normalmente | 🟢 Nenhum |
| **1** | Backend Dual-Mode | Middleware aceita tokens antigos E tokens Squamata; adiciona `/profile`; ajusta model | Login antigo funciona + `curl` com token Squamata em rota protegida retorna 200 | 🟢 Nenhum |
| **2** | Frontend SSO | Novo Login.jsx (botão SSO), AuthCallback.jsx, rotas e interceptor 401 atualizados | Fluxo SSO completo via Squamata-Login funciona | 🟡 Login antigo ainda funciona como fallback |
| **3** | Backend Limpeza | Desativa `/login`, `/register`, `/google`; remove Passport; remove GoogleCallback | Só SSO funciona; login local retorna 410 | 🔴 Rollback requer reverter CP3 |
| **4** | Middleware Final | Remove modo dual do `auth.js`; limpa dependências (`bcryptjs`, `passport`) | Sistema final: 100% SSO, código limpo | 🟡 Só fazer após CP3 validado |

> ⚠️ **Regra de ouro**: Só avance para o próximo checkpoint depois de testar e commitar o atual.

---

## 🔧 Checkpoint 0: Infraestrutura e Configuração

### 0.1 Sincronizar `JWT_SECRET_LOGIN`

**Arquivo**: `c:\Calango-bot\.env`

Copie o valor de `JWT_SECRET_LOGIN` do `.env` do Squamata-Login **exatamente igual** para o `.env` do Calango-Bot. O Calango-Bot mantém seu próprio `JWT_SECRET` para tokens legados durante a transição.

```env
# No Calango-bot/.env
JWT_SECRET=chave_de_autenticacao
# Chave compartilhada com Squamata-Login para validação de tokens SSO
JWT_SECRET_LOGIN=chave_de_autenticacao
```

> ⚠️ **Crítico**: `JWT_SECRET_LOGIN` deve ser idêntico nos 3 projetos (Squamata-Login, Calango-Food, Calango-Bot). O middleware do Calango-Bot tenta `JWT_SECRET_LOGIN` primeiro (tokens Squamata) e depois `JWT_SECRET` (tokens legados).

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

## 🔐 Checkpoint 1: Backend Dual-Mode (Tokens Antigos + Squamata)

> **Objetivo**: O middleware passa a aceitar **AMBOS** os formatos de token — antigo (Calango-Bot) e novo (Squamata). Assim, o sistema continua funcionando com o login local enquanto testamos tokens Squamata.
>
> **Teste rápido**: `curl -H "Authorization: Bearer <token_squamata>" http://localhost:3003/api/auth/profile` deve retornar 200.
>
> **Commit sugerido**: `git commit -m "checkpoint(1): backend dual-mode auth + profile route + model SSO"`

### 1.1 Reescrever `authenticateToken` — Modo Dual

O middleware atual espera um payload Calango-Bot: `{ userId, activeBusinessId, role }`.  
O token do Squamata vem com: `{ uid, email, appSlug, tenantId }`.

**Estratégia**: Detectar o formato do payload e tratar cada caso. Isso garante que o login antigo CONTINUA FUNCIONANDO enquanto testamos o novo fluxo.

```js
import jwt from 'jsonwebtoken';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  try {
    // 1. Tentar validar com JWT_SECRET_LOGIN (Squamata SSO)
    const secretLogin = process.env.JWT_SECRET_LOGIN;
    let decoded = null;
    let isSquamataToken = false;

    try {
      decoded = jwt.verify(token, secretLogin);
      isSquamataToken = !!decoded.uid;
    } catch (squamataErr) {
      // Se falhar, tentar com o segredo legado do Calango-Bot
      const secretLegacy = process.env.JWT_SECRET;
      decoded = jwt.verify(token, secretLegacy);
    }

    // ─── DETECÇÃO DE FORMATO ───────────────────────
    // Token do Squamata tem { uid, email, appSlug, tenantId }
    // Token antigo do Calango-Bot tem { userId, activeBusinessId, role }

    if (isSquamataToken) {
      // ─── FLUXO SQUAMATA (NOVO) ──────────────────
      
      if (decoded.appSlug && decoded.appSlug !== 'calango-bot') {
        return res.status(403).json({ message: 'Token não autorizado para esta aplicação' });
      }

      // UPSERT: Encontrar ou criar o SystemUser local
      let user = await SystemUser.findOne({ email: decoded.email });

      if (!user) {
        user = await SystemUser.create({
          name: decoded.email.split('@')[0],
          email: decoded.email,
          password: 'sso_placeholder_do_not_use',
          isVerified: true,
          isActive: true
        });
        console.log(`🆕 SystemUser criado via SSO: ${decoded.email}`);
      }

      // Resolver BusinessConfig
      const tenantId = decoded.tenantId || 'default';
      if (user.businesses && user.businesses.length > 0) {
        if (!user.activeBusinessId) {
          user.activeBusinessId = user.businesses[0].businessId;
          await user.save();
        }
      } else {
        const businessConfig = await BusinessConfig.create({
          businessName: `Empresa de ${decoded.email}`,
          phoneNumber: '5511999999999',
          prompts: { chatSystem: 'Você é um assistente virtual.', visionSystem: '' }
        });
        user.businesses.push({ businessId: businessConfig._id, role: 'admin' });
        user.activeBusinessId = businessConfig._id;
        await user.save();
        console.log(`🏢 BusinessConfig criado via SSO para: ${decoded.email}`);
      }

      if (!user.activeBusinessId) {
        return res.status(400).json({ message: 'Nenhum negócio configurado. Contate o suporte.' });
      }

      let role = 'operator';
      const businessInfo = user.businesses.find(b =>
        b.businessId.toString() === user.activeBusinessId.toString()
      );
      if (businessInfo) role = businessInfo.role;

      req.user = {
        userId: user._id,
        email: decoded.email,
        activeBusinessId: user.activeBusinessId,
        role: role,
        squamataUid: decoded.uid
      };
      return next();
    }

    // ─── FLUXO ANTIGO (CALANGO-BOT ORIGINAL) ─────
    // Mantido para compatibilidade durante a transição
    
    if (decoded.activeBusinessId && decoded.role) {
      req.user = {
        userId: decoded.userId,
        activeBusinessId: decoded.activeBusinessId,
        role: decoded.role
      };
      return next();
    }

    // Fallback: token antigo sem activeBusinessId (consulta DB)
    const user = await SystemUser.findById(decoded.userId).select('activeBusinessId businesses');
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

    let role = 'operator';
    if (user.activeBusinessId && user.businesses) {
      const business = user.businesses.find(b =>
        b.businessId.toString() === user.activeBusinessId.toString()
      );
      if (business) role = business.role;
    }

    req.user = {
      userId: decoded.userId,
      activeBusinessId: user.activeBusinessId,
      role: role
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

O middleware `requireAdmin` não precisa ser alterado — ele continua funcionando com `req.user.role` que populamos em ambos os fluxos (antigo e Squamata).

### 1.3 Adicionar `GET /api/auth/profile`

**Arquivo**: `c:\Calango-bot\backend\routes\authRoutes.js`

Adicionar uma rota de perfil (sem desativar nada ainda — isso vem no Checkpoint 3):

```js
// ROTA: /api/auth/profile — NOVO (Checkpoint 1)
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

### 1.4 Ajustar Model `SystemUser`

**Arquivo**: `c:\Calango-bot\backend\models\SystemUser.js`

O campo `password` atualmente é `required: true`. Para usuários SSO, usamos placeholder `'sso_placeholder_do_not_use'`:

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

### 1.5 Resumo do Checkpoint 1

| Antes | Depois |
|-------|--------|
| Payload: só `{ userId, activeBusinessId, role }` | Detecta formato: Squamata (`uid`) ou antigo (`userId`) |
| Sem rota `/profile` | `GET /api/auth/profile` disponível |
| `password` obrigatório no model | `password` opcional (placeholder SSO) |
| `jwt.verify` com callback async | `jwt.verify` com try/catch + await |

### 1.6 Como Testar o Checkpoint 1

```bash
# 1. Login antigo ainda funciona?
# Acesse http://localhost:3004/login e faça login normal → Deve funcionar como antes ✅

# 2. Token Squamata é aceito?
# Gere um token no Squamata-Login (faça login lá) e copie o token do localStorage
# Depois teste:
curl -H "Authorization: Bearer <COLE_O_TOKEN_SQUAMATA>" http://localhost:3003/api/auth/profile

# Deve retornar 200 com os dados do perfil (usuário criado automaticamente se for novo) ✅

# 3. Token de outro app é rejeitado?
# Gere um token com appSlug=calango-food no Squamata e teste:
curl -H "Authorization: Bearer <TOKEN_CALANGO_FOOD>" http://localhost:3003/api/auth/profile
# Deve retornar 403 ✅
```

---

## 🎨 Checkpoint 2: Frontend SSO (Login + Callback)

> **Objetivo**: Substituir o formulário de login local por um botão "Entrar com Conta Central" que redireciona ao Squamata-Login. Criar a rota `/auth/callback` que captura o token JWT retornado.
>
> **⚠️ As rotas antigas de login/register no backend AINDA ESTÃO ATIVAS.** O login local ainda funciona como fallback.
>
> **Commit sugerido**: `git commit -m "checkpoint(2): frontend SSO - Login page + AuthCallback + API interceptor"`

### 2.1 Reescrever `Login.jsx`

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

### 2.2 Criar `AuthCallback.jsx`

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

### 2.3 Atualizar `App.js` — Rotas

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

### 2.4 Atualizar `api.js` — Interceptor 401

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

### 2.5 NÃO remover `GoogleCallback.jsx` ainda

> ⚠️ **Atenção**: Não remova o `GoogleCallback.jsx` nem a rota `/google-callback` agora. Isso será feito no Checkpoint 3, quando desativarmos as rotas antigas de uma vez.

### 2.6 Como Testar o Checkpoint 2

```bash
# 1. Acesse http://localhost:3004
# A página de login agora mostra "Entrar com a Conta Central" ✅

# 2. Clique no botão → redirecionado para http://localhost:5174/login?appSlug=calango-bot ✅

# 3. Faça login no Squamata (email/senha ou Google)
# → Redirecionado de volta para http://localhost:3004/auth/callback?token=...&user=... ✅

# 4. Token salvo no localStorage, redirecionado ao Dashboard ✅

# 5. Abra o DevTools → Application → Local Storage:
#    - "token" = JWT do Squamata
#    - "user" = { id, email, appSlug } ✅

# 6. Faça uma requisição no Dashboard → o header Authorization: Bearer <token> é enviado ✅

# 7. Login antigo AINDA FUNCIONA como fallback:
#    curl -X POST http://localhost:3003/api/auth/login \
#      -H "Content-Type: application/json" \
#      -d '{"email":"seu@email.com","password":"sua-senha"}'
#    → Deve retornar 200 com token (rota ainda ativa) ✅
```

---

## 🧹 Checkpoint 3: Backend — Desativar Rotas Antigas

> **Objetivo**: Desativar as rotas locais de login, registro e Google OAuth. Remover o Passport e o GoogleCallback do frontend.
>
> **⚠️ Após este checkpoint, o login local NÃO FUNCIONA MAIS.** Apenas o fluxo SSO via Squamata-Login estará ativo.
>
> **Commit sugerido**: `git commit -m "checkpoint(3): desativa login/register/google locais + remove Passport"`

> **Arquivo principal**: `c:\Calango-bot\backend\routes\authRoutes.js`

### 3.1 Rotas a DESATIVAR

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

### 3.2 Rotas a MANTER ativas

| Rota | Por quê |
|------|---------|
| `POST /api/auth/switch-business` | Troca de contexto multi-tenant (CRM-specific) |
| `POST /api/auth/logout` | Limpeza de sessão WhatsApp + cookie |
| `PUT /api/auth/update` | Atualização de perfil (avatar, nome) |
| `POST /api/auth/invites` | Convites de equipe (CRM-specific) |
| `GET /api/auth/invites/:token` | Validação pública de convite |
| `GET /api/auth/profile` | **(NOVO)** Retornar dados do usuário logado |

### 3.3 Remover Passport do `server.js`

**Arquivo**: `c:\Calango-bot\backend\server.js`

Remover ou comentar:
```js
// import passport from 'passport';           // ← remover
// import './config/passport.js';             // ← remover
// app.use(passport.initialize());            // ← remover
```

### 3.4 Remover `GoogleCallback.jsx` do Frontend

**Arquivo**: `c:\Calango-bot\frontend\src\pages\GoogleCallback.jsx` — renomear para `.bak` ou remover.

**Arquivo**: `c:\Calango-bot\frontend\src\App.js` — remover a rota:
```jsx
// REMOVER:
// import GoogleCallback from './pages/GoogleCallback';
// <Route path="/google-callback" element={<GoogleCallback />} />
```

### 3.5 Como Testar o Checkpoint 3

```bash
# 1. Login local NÃO funciona mais:
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@teste.com","password":"123456"}'
# → Deve retornar 410 com redirectUrl ✅

# 2. Register local NÃO funciona mais:
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@teste.com","password":"123456"}'
# → Deve retornar 410 ✅

# 3. Fluxo SSO completo FUNCIONA:
# Acesse http://localhost:3004 → "Entrar com Conta Central" → login Squamata → Dashboard ✅

# 4. Rotas mantidas continuam ativas:
curl -X POST http://localhost:3003/api/auth/logout \
  -H "Authorization: Bearer <TOKEN_SQUAMATA>"
# → Deve retornar 200 ✅
```

---

## 🧼 Checkpoint 4: Middleware Final + Limpeza de Dependências

> **Objetivo**: Remover o modo dual do middleware e as dependências que não são mais necessárias. O sistema agora é 100% SSO.
>
> **⚠️ Só execute este checkpoint após o Checkpoint 3 estar validado em produção.**
>
> **Commit sugerido**: `git commit -m "checkpoint(4): middleware final (só Squamata) + limpeza de dependências"`

### 4.1 Remover Modo Dual do `auth.js`

**Arquivo**: `c:\Calango-bot\backend\middleware\auth.js`

Remover o bloco `// ─── FLUXO ANTIGO (CALANGO-BOT ORIGINAL) ─────` e tudo abaixo dele, deixando apenas o fluxo Squamata. O middleware final fica idêntico ao código original da Fase 1 (sem o fallback de tokens antigos).

Basicamente: remover a detecção `const isSquamataToken = !!decoded.uid` e o bloco `else` do fluxo antigo.

### 4.2 Remover Dependências Não Utilizadas

**Arquivo**: `c:\Calango-bot\backend\package.json`

Remover do `package.json` e rodar `npm install`:
- `bcryptjs` — senhas gerenciadas pelo Squamata (após CP3 o `pre('save')` ainda usa, mas só para hash de placeholder)
- `passport` — OAuth delegado ao Squamata
- `passport-google-oauth20` — idem
- `passport-local` — idem

```bash
cd c:\Calango-bot\backend
npm uninstall bcryptjs passport passport-google-oauth20 passport-local
```

> ⚠️ Se o `pre('save')` hook ainda referencia `bcrypt`, remova o hook inteiro ou substitua por um log. Usuários SSO usam placeholder e nunca passam pelo hash real.

### 4.3 Como Testar o Checkpoint 4

```bash
# 1. Sistema 100% SSO:
# Acesse http://localhost:3004 → SSO → Dashboard ✅

# 2. Token antigo NÃO funciona mais:
# Gere um token com o payload antigo { userId, activeBusinessId, role }
# → Deve retornar 403 (Token inválido) ✅

# 3. Token Squamata funciona normalmente:
curl -H "Authorization: Bearer <TOKEN_SQUAMATA>" http://localhost:3003/api/auth/profile
# → 200 com perfil ✅

# 4. Rotas desativadas continuam retornando 410:
curl -X POST http://localhost:3003/api/auth/login -H "Content-Type: application/json" -d '{}'
# → 410 ✅
```

---

## ✅ Testes de Integração (Pós-Checkpoint 4)

Execute esta bateria completa após todos os checkpoints.

| # | Teste | Como validar | CP que cobre |
|---|-------|-------------|-------------|
| 1 | **Primeiro login (usuário novo)** | Login no Squamata com email nunca usado no Calango-Bot | CP1+CP2 |
| 2 | **Login de retorno** | Mesmo email, segundo acesso | CP1+CP2 |
| 3 | **Google OAuth** | Botão Google no Squamata com `appSlug=calango-bot` | CP0+CP2 |
| 4 | **Token expirado** | Token de 1s, esperar, fazer requisição → 401 → redireciona | CP2 |
| 5 | **Switch Business** | Seletor de empresa no Dashboard | CP0 (inalterado) |
| 6 | **Convites (invite)** | Admin cria invite, usuário SSO aceita | CP3 (ajustar fluxo) |
| 7 | **Logout** | "Sair" → sessão WhatsApp parada → redireciona Squamata | CP2 |
| 8 | **Acesso direto sem token** | `/dashboard` sem token → redireciona Squamata | CP2 |
| 9 | **Multi-tenant** | Usuário com 2+ BusinessConfigs | CP1 |
| 10 | **Avatar upload** | `PUT /api/auth/update` com token Squamata | CP1 |

---

## 📊 Resumo: Arquivos Modificados por Checkpoint

### Checkpoint 0 — Infra + Config
| Projeto | Arquivo | Ação |
|---------|---------|------|
| Squamata-Login | `packages/frontend/src/pages/Login.jsx` | Adicionar redirect SSO para `calango-bot` |
| Squamata-Login | `docker-compose.yml` | Adicionar build arg `VITE_CALANGO_BOT_URL` |
| Calango-Bot | `.env` | Copiar `JWT_SECRET` do Squamata |
| Calango-Bot | `docker-compose.yml` | Adicionar `squamata-global` network |
| Calango-Bot | `frontend/.env` | Criar com `REACT_APP_LOGIN_URL` e `REACT_APP_API_URL` |

### Checkpoint 1 — Backend Dual-Mode
| Arquivo | Ação |
|---------|------|
| `backend/middleware/auth.js` | **REESCREVER**: dual-mode (tokens antigos + Squamata) |
| `backend/routes/authRoutes.js` | Adicionar `GET /api/auth/profile` |
| `backend/models/SystemUser.js` | `password` opcional, pular hash do placeholder |

### Checkpoint 2 — Frontend SSO
| Arquivo | Ação |
|---------|------|
| `frontend/src/pages/Login.jsx` | **REESCREVER**: botão SSO "Entrar com Conta Central" |
| `frontend/src/pages/AuthCallback.jsx` | **CRIAR**: captura token da URL |
| `frontend/src/App.js` | Adicionar `/auth/callback`, ajustar `ProtectedRoute` |
| `frontend/src/services/api.js` | 401 → redirecionar ao Squamata-Login |

### Checkpoint 3 — Backend Limpeza
| Arquivo | Ação |
|---------|------|
| `backend/routes/authRoutes.js` | Desativar `/login`, `/register`, `/verify-email`, `/google`, `/google/callback` |
| `backend/server.js` | Remover imports do Passport |
| `frontend/src/pages/GoogleCallback.jsx` | Remover (ou renomear `.bak`) |
| `frontend/src/App.js` | Remover rota `/google-callback` |

### Checkpoint 4 — Middleware Final
| Arquivo | Ação |
|---------|------|
| `backend/middleware/auth.js` | Remover modo dual (só fluxo Squamata) |
| `backend/package.json` | Remover `bcryptjs`, `passport`, `passport-google-oauth20`, `passport-local` |

---

## ⚠️ Pontos de Atenção

1. **`JWT_SECRET_LOGIN` idêntico**: Deve ser igual nos 3 projetos (Squamata-Login, Calango-Food, Calango-Bot). O `JWT_SECRET` do Calango-Bot é mantido para tokens legados. (CP0)

2. **Mapeamento `tenantId` → `BusinessConfig`**: No CP1, o middleware usa fallback para o primeiro negócio do usuário. Se houver multi-tenancy real, refine esta lógica (ex: adicionar campo `squamataTenantId` ao model `BusinessConfig`).

3. **Convites (invites)**: O fluxo de invite esperava `inviteToken` no body do login. Após o CP3 (login local desativado), o invite precisa ser tratado via query param na URL de callback (`?inviteToken=...`) ou rota dedicada pós-login.

4. **Cookies**: O backend seta cookie `auth_token`. Após SSO, o frontend envia token via header `Authorization`. Mantenha o cookie como fallback no CP1, remova no CP4.

5. **Rollback seguro**: Se o CP2 ou CP3 quebrar, o login antigo funciona como fallback até o CP3. Após o CP3, o rollback requer reverter as rotas desativadas.

6. **Squamata-Login**: Se o Squamata-Login cair, **nenhum** sistema Calango permite login. Monitore o healthcheck (`/api/v1/auth/health`).

7. **Variáveis de ambiente**: Consulte o [Apêndice A](#-apêndice-a-mapeamento-de-portas-docker-servidor-de-aplicação) para as portas corretas do servidor.

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
JWT_SECRET=<mantido para tokens legados>
JWT_SECRET_LOGIN=<copiado do Squamata-login>
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


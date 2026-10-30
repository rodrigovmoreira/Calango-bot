# MEMORY — Calango Bot

> Registro de refatorações e decisões importantes. Atualizado ao concluir cada spec/checkpoint.
> Ver `ai-rules.md` (Calango-docs) para o fluxo de trabalho guiado por specs.

---

## 2026-10-14 — Integração SSO com Squamata-Login (Roadmap 4)

**Branch:** `implementacao-login-squamata`
**Referência:** `Roadmap 4 - Calango Bot - Squamata Login.md`
**Modelo de referência (produção):** Calango-food (`packages/frontend/`).

### Contexto
Substituir o login local (email/senha + Google via Passport) por **SSO central** provido pelo
microsserviço **Squamata-Login** (appSlug `calango-bot`). O Squamata emite um JWT com payload
`{ uid, email, appSlug, tenantId }`, validado no backend do Calango-Bot com o `JWT_SECRET_LOGIN`
compartilhado.

> ⚠️ O repositório Squamata-login estava em produção atendendo o Calango-food e, no início,
> foi tratado como **somente-leitura**. Durante a validação (ver seção dedicada abaixo),
> constatou-se que o redirect SSO para o Calango-Bot **NÃO existia** — o ajuste foi
> autorizado e aplicado na branch isolada `implementacao-login-calango-bot`.

### Estado do código no início da implementação

| Checkpoint | Item | Estado inicial |
| --- | --- | --- |
| CP0 | `JWT_SECRET_LOGIN` + `FRONTEND_LOGIN_URL` no `.env` raiz | ✅ já existia |
| CP0 | `docker-compose.yml` na rede `squamata-global` | ✅ já existia |
| CP0 | `REACT_APP_LOGIN_URL` no frontend / build args | ❌ ausente |
| CP1 | `authenticateToken` dual-mode (Squamata + legado) | ✅ já existia |
| CP1 | `GET /api/auth/profile` | ✅ já existia |
| CP1 | `SystemUser.password` opcional + placeholder SSO | ✅ já existia |
| CP2 | `Login.jsx` com botão SSO | ❌ ainda é formulário local |
| CP2 | `AuthCallback.jsx` | ❌ não existe |
| CP2 | Rota `/auth/callback` + `ProtectedRoute` → Squamata | ❌ ausente |
| CP2 | Interceptor 401 → Squamata | ❌ ainda aponta p/ `/login` local |
| CP3 | Desativar `/login`, `/register`, `/verify-email`, `/google*` | ❌ pendente |
| CP3 | Remover Passport do `server.js` + `GoogleCallback.jsx` | ❌ pendente |
| CP4 | Remover modo dual do middleware + deps legadas | ❌ pendente |

### Estratégia (conforme a "Regra de Ouro" do roadmap)
Executar **um checkpoint por vez**, validar e commitar antes de avançar. Rollback isolado por CP.

### Diário de execução

#### ✅ CP0 — Infra + Config — commit `35f659d`
- `docker-compose.yml`: `REACT_APP_LOGIN_URL` adicionado aos build args do frontend.
- `frontend/Dockerfile`: propaga `REACT_APP_LOGIN_URL` para o bundle (CRA).
- `.env` (local, não versionado): `REACT_APP_LOGIN_URL=http://localhost:5174`.
- `.env.example` (novo): documenta todas as vars, incluindo as do SSO.
- `.gitignore`: passa a ignorar `.env.*` mas versiona `.env.example`.
- `backend/config/validateEnv.js` (novo) + chamada no `start()`: Fail Fast dos vars
  obrigatórios (`MONGO_URI`, `JWT_SECRET_LOGIN`).

#### ✅ CP1 — Backend Dual-Mode — já existia
- Auditado contra o roadmap: `authenticateToken` (dual-mode), `GET /profile` e
  `SystemUser.password` opcional já estavam implementados. Nenhum ajuste adicional.

#### ✅ CP2 — Frontend SSO — commit `b74cc9e`
- `Login.jsx`: reescrito — removeu o formulário local; agora exibe botão
  "Entrar com a Conta Central" que redireciona ao Squamata-Login.
- `AuthCallback.jsx` (novo): captura `token`/`user` do callback do IdP, protege contra
  React Strict Mode (via `useRef`) e redireciona à `/dashboard`.
- `App.js`: nova rota pública `/auth/callback`; `ProtectedRoute` sem token agora
  redireciona ao Squamata-Login (em vez do `/login` local).
- `services/api.js`: interceptor 401 → Squamata-Login; adicionado `authAPI.getProfile`.
- `Dashboard.jsx`: logout redireciona ao Squamata-Login.

#### ✅ CP3 — Desativar rotas locais + remover Passport — commit `29d17ad`
- `authRoutes.js` reescrito: `/login`, `/register`, `/verify-email`, `/google`,
  `/google/callback` → **410 Gone** (com `redirectUrl` para o Squamata).
- `authRoutes.js`: **nova** rota `POST /accept-invite` (fluxo de convite via SSO).
- `server.js`: removidos `passport`, `passport.initialize()` e o import do config.
- Removidos: `backend/config/passport.js` e `frontend/src/pages/GoogleCallback.jsx`
  (+ rota `/google-callback`).
- `InvitePage.jsx` reescrita para o fluxo SSO: valida o convite, salva
  `pending_invite_token` no localStorage e redireciona ao Squamata.
- `AuthCallback.jsx`: aceita o convite pendente (com degradação graciosa).
- `api.js`: adicionado `authAPI.acceptInvite`.

#### ✅ CP4 — Middleware SSO puro + limpeza de dependências — commit `90b412b`
- `middleware/auth.js`: removido o modo dual; valida apenas `JWT_SECRET_LOGIN` e o
  `appSlug === 'calango-bot'`.
- `SystemUser.js`: removidos `bcryptjs`, o hash no `pre('save')` e o `correctPassword`
  (usuários SSO não possuem senha real).
- `package.json`: removidas `bcryptjs`, `passport`, `passport-google-oauth20`,
  `passport-local`.
- **Arquitetura stateless:** `switch-business`, `create-business` e `accept-invite`
  não re-assinam mais tokens locais (o Calango-Bot não possui a chave do IdP).
  O `activeBusinessId` é resolvido do banco a cada requisição pelo middleware.
- Frontend (`Dashboard.jsx`, `AuthCallback.jsx`): deixaram de salvar `data.token`
  nesses fluxos (o token SSO permanece fixo na sessão).

### ✅ Validação + Ajustes no repositório Squamata-Login — commit `298c2ee`
Auditoria solicitada para confirmar se chaves/parâmetros do IdP estavam corretos para o Bot.

**Diagnóstico (o que já existia):**
- `JWT_SECRET_LOGIN` presente no `.env` (mesmo nome compartilhado com o Bot). ✅
- `VITE_CALANGO_BOT_URL` presente no `.env`. ✅
- Modelo `User` com `access: [{ appSlug, tenantId, active }]` (multi-app). ✅
- Fluxo SSO genérico via `?returnUrl=` (usado pelo Food). ✅

**Problemas encontrados (bloqueantes para o Bot):**
1. **Não havia redirect dedicado para `calango-bot`** no `Login.jsx`. Como o Bot entra com
   `?appSlug=calango-bot&tenantId=default` (sem `returnUrl`), o usuário **não retornava** ao Bot.
2. **`VITE_CALANGO_BOT_URL` não chegava ao bundle**: ausente como `ARG` no `Dockerfile` e
   nos `build.args` do `docker-compose.yml`.

**Correções aplicadas (branch `implementacao-login-calango-bot` do Squamata-login):**
- `Login.jsx`: novo mapa `APP_REDIRECTS` + helper `resolveCallbackUrl(slug)`, com redirect
  por app em **ambos os fluxos** (Google `useEffect` e e-mail `handleAuth`). Fallback
  genérico via `sso_return_url` preservado (não regride o Calango-Food).
- `Login.jsx`: o objeto `user` do fluxo Google agora inclui `tenantId`; no fluxo e-mail o
  `user` é enriquecido com `appSlug`/`tenantId` antes do redirect.
- `packages/frontend/Dockerfile`: `ARG`/`ENV VITE_CALANGO_BOT_URL`.
- `docker-compose.yml`: build arg `VITE_CALANGO_BOT_URL=http://calango-inc-appserver:3004`.

**Validação:**
- Build do Vite (`npm run build`) **OK** e a string `calango-inc-appserver:3004`
  confirmada **inlinada** no bundle final (prova de que o arg chega ao runtime).
- Porta confirmada contra o `PORT_MAPPING`: frontend do Bot = host `3004`. ✅

### Decisões de arquitetura relevantes
1. **Token SSO imutável na sessão:** só o Squamata-Login assina tokens. O Calango-Bot
   nunca re-emite JWT; o contexto de negócio ativo vive no banco (stateless-safe).
2. **Convites via SSO:** o `inviteToken` é persistido no `localStorage` (chave
   `pending_invite_token`) pois o IdP não garante propagação de params extras no
   callback. O aceite ocorre no `/auth/callback` e é idempotente no backend.
3. **Provisionamento automático:** o primeiro login SSO cria o `SystemUser` e um
   `BusinessConfig` padrão (role `admin`).

### Validação
- `node --check` em todos os arquivos backend alterados: **OK**.
- Parser Babel em todos os JSX/JS do frontend alterados: **OK**.
- `server.js` importa sem erros; `validateEnv()` aborta corretamente (Fail Fast) quando
  faltam vars.
- Suíte de testes (`npm test`): resultado **idêntico ao baseline** (10 suites/5 testes
  falham por serem testes legados com `require`/mocks desatualizados — **pré-existentes**,
  sem relação com esta refatoração).

### Pendências / observações para o futuro
- Os testes legados (`crm.test.js`, `automation.test.js`, etc.) usam CommonJS e estão
  quebrados — devem ser migrados para ESM num próximo esforço (não escopo deste roadmap).
- `businessRoutes.js` usa `uuidv4()` sem import no handler de notificações — bug
  pré-existente, fora do escopo deste roadmap.
- O campo `googleId` do `SystemUser` foi mantido por retrocompatibilidade (inofensivo).

---

## 2026-10-30 — Recebimento de eventos do Squamata-whatsapp (F3, lado bot)

**Branch:** `implementacao-login-squamata`
**Referência:** `PLANEJAMENTO.md` §5 e §15 (repo `Squamata-whatsapp`)

### O que entrou

| Arquivo | Papel |
| --- | --- |
| `routes/squamataWebhookRoutes.js` | `POST /api/v1/webhooks/whatsapp`, montado **antes** do `express.json()` (HMAC sobre corpo bruto), `express.raw` com limite de 12 MB só nesta rota, `202` imediato |
| `services/whatsapp/inbound.js` | valida `X-Signature`, dedup por `waMessageId` **na entrada** (antes do buffer/IA), adapta o payload e reemite eventos de sessão no socket |
| `services/providerAdapter.js` | novo `adaptSquamataMessage`, no mesmo formato do `adaptWWebJSMessage` |
| `services/message.js` | `saveMessage(..., { timestamp })` — grava o horário original do WhatsApp (D8) |
| `messageHandler.js` | usa o `messageId` do payload e propaga o timestamp pelo buffer |
| `server.js` | `app.set('io', io)` + webhook montado antes do parser global |
| `frontend/AppContext.jsx` | escuta `whatsapp_qr` / `whatsapp_status`; o bot ainda emite `wwebjs_*` como ponte até a F8 |
| `.env.example` | `SQUAMATA_WHATSAPP_URL`, `SQUAMATA_INTERNAL_TOKEN`, `SQUAMATA_WEBHOOK_SECRET` |

### Verificado

- `tests/unit/squamata_inbound.test.js` (14 casos) e `squamata_webhook_route.test.js` (5 casos) verdes.
- Teste cruzado real: o serviço Go emitiu eventos e **este** webhook validou o HMAC e emitiu
  `whatsapp_status`, `whatsapp_qr` e `whatsapp_qr_image` no socket.
- Nenhuma mensagem real ainda: depende de número pareado.

### Pendências

- `MongoMemoryServer` não sobe nesta máquina (`Instance failed to start within 10000ms`), então
  `sync_verification` e `campaignScheduler` falham por ambiente — **pré-existente**, não é regressão.
- Falta a F4 (envio pelo serviço) para o ciclo completo responder pelo número novo.
- O driver antigo (`wwebjsService`) continua ativo até a F8; por isso os eventos usam ponte dupla.

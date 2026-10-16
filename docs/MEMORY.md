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

> ⚠️ **O repositório Squamata-login NÃO deve ser alterado** — está em produção atendendo o
> Calango-food. O redirect SSO para o Calango-Bot **já existe** no Squamata-Login.

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
<!-- Preencher a cada checkpoint concluído -->
- [ ] CP0 — Infra + Config
- [ ] CP1 — Backend Dual-Mode (ajustes residuais, se houver)
- [ ] CP2 — Frontend SSO (Login + Callback + App + API)
- [ ] CP3 — Backend: desativar rotas locais + remover Passport
- [ ] CP4 — Middleware final + limpeza de dependências

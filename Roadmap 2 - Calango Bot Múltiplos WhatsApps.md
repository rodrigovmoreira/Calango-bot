# 📱 Roadmap 2 — Squamata-whatsapp: conexão de WhatsApp como microsserviço

> **Status:** 🔵 **reescrito em 2026-10-29** — substitui integralmente a versão anterior (preservada em [Roadmap 2 - Calango Bot Múltiplos WhatsApps.LEGADO.md](./Roadmap%202%20-%20Calango%20Bot%20M%C3%BAltiplos%20WhatsApps.LEGADO.md)).
> **Decisão:** a conexão de WhatsApp deixa de ser uma biblioteca embutida no Calango-bot e passa a ser um **microsserviço próprio em Go, usando `whatsmeow`**, com **múltiplas sessões desde o primeiro dia**.

---

## 1. Por que reescrever (medido no código, não estimado)

O `backend/services/wwebjsService.js` tem **854 linhas / 35 KB** e concentra, num único arquivo, seis responsabilidades diferentes:

| Responsabilidade | Onde vive hoje (linhas) |
| :--- | :--- |
| Ciclo de vida da sessão + QR + timeouts | `startSession` (112), `stopSession` (377), `cleanupSession` (470) |
| *Health check* + matar navegador órfão | `killOrphanedBrowser` (27), `verifySessionHealth` (503), `startGlobalHealthCheck` (632) |
| Envio de mensagem / mídia / presença | `sendWWebJSMessage` (679), `sendImage` (718), `sendStateTyping` (788) |
| Etiquetas do WhatsApp Business | `getLabels` / `updateLabel` / `deleteLabel` / `setChatLabels` (827-910) |
| **Scraping do DOM via Puppeteer** | `fetchRawChatsFromStore`, `fetchChatsWithRetry` (no `contactController`) |
| Registro de status em memória | `sessions` / `qrCodes` / `statuses` Maps |

**O ponto crítico:** o Calango-bot **entra no navegador** para ler conversas. `contactController.js:537` e `:997` fazem `getClientSession(businessId)` e depois `client.pupPage.evaluate(...)` para raspar a lista de chats. Isso é o oposto de "código limpo e segregado": a regra de negócio depende de detalhes internos de uma página do WhatsApp Web, que mudam sem aviso.

**Consumidores hoje (10 arquivos do backend):**

| Arquivo | O que usa |
| :--- | :--- |
| `messageHandler.js` | `getClientSession`, `sendStateTyping` |
| `responseService.js` | `sendWWebJSMessage` |
| `aiTools.js` | `sendImage` |
| `campaignScheduler.js` | `sendImage` |
| `tagService.js` | `getLabels`, `createLabel`, `updateLabel`, `deleteLabel`, `getClientSession` |
| `businessRoutes.js` | `sendWWebJSMessage` (envio manual do atendente) |
| `authRoutes.js` | `stopSession` (logout) |
| `whatsappRoutes.js` | status / start / logout / import-labels |
| `contactController.js` | `getClientSession` + **scraping** |
| `campaignRoutes.js` | disparo manual |

Além disso, `whatsapp-web.js` + `puppeteer` trazem um **Chromium** para a imagem Docker — peso de build e superfície de falha que não têm relação com o domínio do produto.

---

## 2. A decisão

| Item | Decisão |
| :--- | :--- |
| **Tecnologia** | Go + [`whatsmeow`](https://github.com/tulir/whatsmeow) (protocolo WhatsApp Web *multidevice*, nativo, sem navegador) |
| **Nome do serviço** | `squamata-whatsapp` (repositório `Squamata-whatsapp`, container `squamata-whatsapp`) |
| **Camada no ecossistema** | **Domínio (crítico)** — a capacidade "WhatsApp" para; o CRM, funil e agenda do Calango-bot continuam |
| **Porta** | `3006` (3005 = `squamata-upload`) |
| **Contrato** | `GET /api/v1/health` + `/api/v1/...` (ADR 002). **Webhooks não versionados** (`/webhooks/...`) |
| **Rede** | `squamata-global` |
| **Banco do serviço** | **SQLite embarcado** (arquivo em volume) via `sqlstore` oficial — sem servidor de banco. Ver §2.1 e [ADR 005](../Calango-docs/docs/ADRs/005-armazenamento-sessoes-whatsapp.md) |
| **Auth entre serviços** | Token interno (`SQUAMATA_INTERNAL_TOKEN`). **O `squamata-whatsapp` NÃO depende do Squamata-Login** |
| **Mídia** | Baixada/enviada pelo `squamata-whatsapp`, mas **armazenada no `squamata-upload`** |

### 2.1 O banco não pode ser MongoDB (decisão fundamentada)

A pergunta natural é: o ecossistema já roda MongoDB, por que não guardar as sessões lá?

**O que o `whatsmeow` guarda não é "dado de sessão", é estado criptográfico do protocolo Signal:** identity keys, pre-keys, signed pre-keys, sender keys, sessões por dispositivo remoto, MACs de mutação de app state. Perder ou corromper isso = mensagens que **não decifram**, com erro opaco e difícil de diagnosticar.

Verificado nas fontes:

- O pacote `go.mau.fi/whatsmeow/store` define **interfaces** (`AllStores`, `AllGlobalStores`, `AllSessionSpecificStores`, `Device`, `AppStateStore`, `ContactStore`, `ChatSettingsStore`) e o `Device` aceita `SetAllStores(...)`. Ou seja: **implementar um store customizado é possível e oficialmente suportado**.
- Mas a implementação pronta é o `sqlstore`: `sqlstore.New(ctx, dialect, address, log)` — **SQL apenas** (dialeto do `dbutil`: postgres, mysql/mariadb, sqlite).
- **Não existe adapter MongoDB** para o `whatsmeow` (busca no GitHub por repositórios: 0 resultados).

Seria preciso escrever e **manter para sempre** ~20 métodos de estado criptográfico. Isso não é "reaproveitar a infra que já existe" — é assumir a parte mais delicada da biblioteca. **Decisão: usar o `sqlstore` oficial.**

**MongoDB tem "schema"?** Não no sentido SQL. O equivalente mais próximo seria um database ou um prefixo de coleção — mas o ponto acima torna a pergunta irrelevante: o estado criptográfico precisa do `sqlstore`.

**Escolha do dialeto — SQLite embarcado, não Postgres** (decisão registrada em [ADR 005](../Calango-docs/docs/ADRs/005-armazenamento-sessoes-whatsapp.md)):

| | **SQLite embarcado** | Postgres/MySQL |
| :--- | :--- | :--- |
| Servidor de banco novo | ✅ **nenhum** (é biblioteca, não processo) | ❌ um servidor a mais |
| Backup | cópia de arquivo (`VACUUM INTO`) | dump / PITR |
| Multi-réplica | ❌ single-node | ✅ |
| **Multi-réplica importa aqui?** | — | ⚠️ **Não.** A sessão é *stateful e presa ao processo*: o `Client` do `whatsmeow` vive numa réplica específica, então réplicas atrás de load balancer **não** distribuem sessões |
| Testes | `:memory:` / arquivo temporário | exige infraestrutura |

O critério decisivo não é "qual é mais robusto", é **"quantos processos escrevem este estado?"**. **Um só.** SQLite é o padrão para agentes stateful single-node exatamente por isso.

> **Correção de uma avaliação anterior:** eu havia tratado "migrar de dialeto depois exige reparear" como fator decisivo. É exagero: o `dbutil` (base do `sqlstore`) tem migrações por dialeto (`-- only: sqlite`) e as tabelas são SQL genérico, então um dump/restore entre dialetos é viável — e, com dezenas de sessões, reparear custa um QR. O risco de lock-in é **baixo**.

### Por que não depende do Squamata-Login

O `squamata-whatsapp` não tem usuário logado: quem o chama é o **backend** do Calango-bot, server-to-server. Se ele exigisse JWT do usuário, ele viraria dependente da camada **Plataforma** — e uma regra do ecossistema é que a queda do Login não pode derrubar conexões já estabelecidas. Com isso, o `squamata-whatsapp` continua **plataforma-independente**: sessões de WhatsApp sobrevivem a uma queda do Login.

> Trade-off assumido: mais um segredo para gerenciar (`SQUAMATA_INTERNAL_TOKEN`). Ver Riscos §9.

### Por que `whatsmeow` e não outro

O README oficial lista o que está pronto: enviar/receber texto e mídia (privado e grupo), gerenciar grupos, notificações de digitando, recibos de entrega/leitura, **leitura e escrita de app state (lista de contatos, labels)**, retry receipts.
O que **não** existe: **mensagens de lista de transmissão** (o WhatsApp Web também não suporta) e **chamadas**.

Consequência direta para o produto: o disparo de campanhas precisa ser **mensagem individual por contato** (que é o que o `campaignScheduler` já faz hoje), e não "broadcast list". Isso não muda nada no que existe — mas fecha a porta para uma feature futura.

---

## 3. Arquitetura alvo

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Squamata-Login (Plataforma)                │
└─────────────────────────────────────────────────────────────────────┘
        ▲ JWT (só validação local)                    ▲ SSO
        │                                              │
┌───────┴──────────────────┐                  ┌────────┴───────────────┐
│   Calango-bot  backend   │                  │  Calango-bot frontend  │
│  (CRM, funil, agenda)    │                  └────────────────────────┘
│                          │
│  services/whatsapp/      │  HTTP interno    ┌────────────────────────┐
│   ├── client.js ─────────┼─────────────────▶│  squamata-whatsapp  (Go)  │
│   └── inbound.js  ◀──────┼──── webhook ─────│  whatsmeow · N sessões │
└──────────────────────────┘                  └───────────┬────────────┘
                                                          │ mídia
                                              ┌───────────▼────────────┐
                                              │  squamata-upload       │
                                              └────────────────────────┘
```

**Fronteira:** o Calango-bot para de conhecer WhatsApp. Ele conhece **sessão** e **mensagem** (conceitos do seu domínio), através de um único módulo adaptador.

---

## 4. Múltiplas sessões desde o dia 1

Esta é a razão de fazer o microsserviço agora, e não depois.

### Modelo interno (Go)

O `whatsmeow` é **naturalmente multi-dispositivo**: existe um `*whatsmeow.Client` por dispositivo, cada um com seu `*store.Device` obtido do `sqlstore`. O padrão é:

```go
container, _ := sqlstore.New(ctx, "postgres", dsn, log)
device, _   := container.NewDevice(ctx)                  // ou GetFirstDevice / GetAllDevices
client      := whatsmeow.NewClient(device, clientLog)
client.AddEventHandler(onEvent)                           // 1 handler por sessão, com sessionId no closure
```

Ou seja: **N sessões = N clients no mesmo processo**, todos compartilhando o `container`/banco. Não há "uma sessão por processo" — o que era limitação do `whatsapp-web.js`.

### Registro e concorrência

```
SessionRegistry (map[sessionID]*Session, protegido por RWMutex)
  └─ Session { ID, TenantID, Name, Phone, Client, Status, QR, ConnectedAt, LastError }
```

- Um **state machine** por sessão: `disconnected → connecting → qr_pending → connected → ...`
- Cada sessão tem seu próprio canal de eventos; nada de estado global compartilhado.
- **Escala:** no MVP, um processo atende todas as sessões. Se o número crescer, particiona por `sessionId` (hash) em N réplicas — o contrato HTTP não muda, só o roteamento.

### Storage

`whatsmeow` exige persistência das chaves de criptografia. Sem isso, cada restart = novo pareamento. **SQLite em volume persistente** (ver §2.1 e ADR 005): um arquivo para todas as sessões, porque o `sqlstore` chaveia as tabelas por dispositivo. Sem servidor de banco, sem dump lógico — backup é `VACUUM INTO` ou snapshot do volume.

### Propriedade da sessão (escopo "ambos")

Requisito de produto: a sessão pode pertencer à **empresa** (setor: vendas, suporte) **ou** a um **usuário** (profissional: "Tatuador A"). O modelo já nasce com os dois:

```go
type Session struct {
    ID          string   // UUID — é o sessionId que o Calango-bot guarda
    TenantID    string   // businessId (sempre presente)
    OwnerUserID string   // opcional: vazio = sessão do setor/empresa
    Name        string
    Phone       string
    Status      string
    ...
}
```

Isso muda a autorização no Calango-bot: sessão com `OwnerUserID` vazio é visível para todos os membros ativos do tenant; sessão com `OwnerUserID` só é visível para aquele usuário e para os admins. **O isolamento entre tenants é sempre pelo `TenantID` do caminho**, nunca pelo `OwnerUserID`.

---

## 5. Contrato da API

Escopo por tenant **no caminho** (`/tenants/:tenantId/...`), não em query string. Motivo: o isolamento multi-tenant deixa de depender de "lembrar de filtrar" em cada rota — um `sessionId` de outro tenant simplesmente não resolve.

```
GET    /api/v1/health

# Sessões
POST   /api/v1/tenants/:tenantId/sessions          { name }            → { id, status }
GET    /api/v1/tenants/:tenantId/sessions                              → [{ id, name, phone, status }]
GET    /api/v1/tenants/:tenantId/sessions/:id                          → { id, status, phone, connectedAt }
DELETE /api/v1/tenants/:tenantId/sessions/:id                          (logout + remove device)
POST   /api/v1/tenants/:tenantId/sessions/:id/connect                  (inicia; idempotente)
POST   /api/v1/tenants/:tenantId/sessions/:id/disconnect               (mantém o device)
GET    /api/v1/tenants/:tenantId/sessions/:id/qr                       → { qr: "<base64>", expiresAt }
POST   /api/v1/tenants/:tenantId/sessions/:id/pairing-code   { phone } → { code }   ← UX melhor que QR

# Mensagens
POST   /api/v1/tenants/:tenantId/sessions/:id/messages               { to, text }
POST   /api/v1/tenants/:tenantId/sessions/:id/messages/media         { to, mediaUrl|base64, mime, caption }
POST   /api/v1/tenants/:tenantId/sessions/:id/presence               { to, type: "typing"|"paused" }

# Contatos (substitui o scraping)
POST   /api/v1/tenants/:tenantId/sessions/:id/contacts/sync           → { contacts: [...] }
GET    /api/v1/tenants/:tenantId/sessions/:id/contacts?since=...

# Labels (app state)
GET    /api/v1/tenants/:tenantId/sessions/:id/labels
POST   /api/v1/tenants/:tenantId/sessions/:id/labels
PATCH  /api/v1/tenants/:tenantId/sessions/:id/labels/:labelId
DELETE /api/v1/tenants/:tenantId/sessions/:id/labels/:labelId

# Entrada (não versionado — webhook)
POST   /api/v1/webhooks/whatsapp        ← squamata-whatsapp → Calango-bot (HMAC assinado)
```

> **`pairing-code` é uma melhoria de produto**, não só técnica: hoje o usuário precisa escanear um QR. Com `PairPhone` do `whatsmeow`, ele digita o número e recebe um código de 8 dígitos — funciona no celular, sem outra tela.

---

## 6. Fluxo de entrada (o que substitui os eventos em processo)

Hoje o `wwebjsService` chama `messageHandler` **dentro do mesmo processo**. Com o microsserviço, a mensagem vem por HTTP.

```
WhatsApp → squamata-whatsapp (events.Message)
              │ normaliza
              ▼
POST /api/v1/webhooks/whatsapp     (HMAC-SHA256 em X-Signature)
{ tenantId, sessionId, messageId, from, pushName, type, text|media, timestamp }
              │
              ▼
Calango-bot  services/whatsapp/inbound.js
              ├─ valida assinatura
              ├─ idempotência por (sessionId, messageId)
              └─ messageHandler.handleIncomingMessage(payloadNormalizado)
```

Regras obrigatórias (constitucional — "Idempotência nas Comunicações"):

1. **Assinatura HMAC** obrigatória; sem assinatura válida → `401`, sem processar.
2. **Idempotência** por `messageId` do WhatsApp. Retry do serviço Go não pode duplicar mensagem nem re-disparar IA.
3. **At-least-once com backoff** do lado do Go; o bot responde `202 Accepted` rápido e processa.
4. **Falha do bot não derruba a sessão**: o Go registra e reenvia. Isso é o "Errar Rápido" do `constitution.md` aplicado na direção correta.

---

## 7. O que sai do Calango-bot

O objetivo declarado: **código mais limpo e segregado**, reusando os microsserviços do ecossistema.

### Sai (deletado do repositório)

| Item | Substituído por |
| :--- | :--- |
| `services/wwebjsService.js` (854 linhas) | cliente HTTP do `squamata-whatsapp` |
| `client.pupPage.evaluate(...)` em `contactController` | `POST .../contacts/sync` |
| `killOrphanedBrowser`, `cleanupTempFolders`, `startGlobalHealthCheck` | state machine do Go |
| `initializeWWebJS(io)` no `server.js` | nada (sem Chromium no boot) |
| `services/UnifiedMongoStore.js` (credenciais em GridFS) | `sqlstore` (SQLite em volume) do serviço Go |
| `adaptWWebJSMessage` em `providerAdapter.js` | `adaptSquamataMessage` |
| Pastas `.wwebjs_auth/`, `.wwebjs_cache/` e os ZIPs de `RemoteAuth` | — |
| Dependências `whatsapp-web.js`, `puppeteer`, `qrcode-terminal` | — |

> **`qrcode-terminal` já está morto hoje:** está no `package.json` mas nenhum arquivo o importa. Aproveitar a F8 para remover.

### Fica (e é ajustado)

| Arquivo | Mudança |
| :--- | :--- |
| `messageHandler.js` | recebe payload normalizado; sem `getClientSession`; `sendStateTyping` → `presence` |
| `responseService.js` | envia por `sessionId`, não `businessId` |
| `aiTools.js`, `campaignScheduler.js` | `sendImage` → `messages/media` |
| `tagService.js` | labels via API; a `Tag` local continua sendo a fonte da UI |
| `businessRoutes.js` | envio manual do atendente via adaptador |
| `authRoutes.js` | logout → `POST .../disconnect` |
| `whatsappRoutes.js` | reescrito como proxy fino do adaptador |
| `contactController.js` | sync via API; **sem tocar em navegador** |

### Novo módulo (a única porta de entrada)

```
backend/services/whatsapp/
  ├── client.js   ← HTTP para squamata-whatsapp (timeouts, retry, auth interna)
  └── inbound.js  ← recebe o webhook, valida HMAC, garante idempotência
```

**Não criar um terceiro normalizador.** Já existe `services/providerAdapter.js` com `adaptTwilioMessage` e `adaptWWebJSMessage` — ele é exatamente a costura de normalização de entrada (o `wwebjsService` o chama antes de entregar ao `messageHandler`). A mudança é **acrescentar `adaptSquamataMessage`** e, na F8, remover o `adaptWWebJSMessage`. `normalizePhone` continua compartilhado.

**Regra de aceite:** depois da migração, `grep -r "wwebjs\|puppeteer\|pupPage" backend/` não retorna nada (fora de `tests/`).

---

## 8. Impacto no banco do Calango-bot

`Contact.whatsappSessionId`, `Message.whatsappSessionId`, `Appointment.whatsappSessionId` e `BusinessConfig.whatsappSessionId` hoje são `ObjectId` com `ref: 'Session'`.

Como o **`Session` deixa de existir no Mongo** (passa a viver no SQLite do serviço), esses campos viram **`String`** (ID externo opaco). É uma migração de schema:

- Campos são **opcionais** → documentos antigos continuam válidos (`null`).
- Nenhum `populate` os usa hoje (verifiquei) → **não há quebra** na leitura.
- Índices que os referenciam precisam ser revistos.

> **Ordem importa:** a troca de `ObjectId` → `String` só pode ocorrer **junto** com a virada do adaptador, nunca antes — senão o modelo passa a mentir sobre o tipo do dado.

---

## 9. Fases de execução

| Fase | Entrega | Critério de aceite |
| :--- | :--- | :--- |
| **F0 — Spike** | Binário Go pareado com um número de teste; recebe e ecoa mensagem | Mensagem real vai e volta sem Chromium |
| **F1 — Esqueleto** | Repo, `/api/v1/health`, `sqlstore` em SQLite + volume, auth interna, `/sessions` CRUD | Dev: `go run` sobe nativo (sem Docker) e responde health. Produção: `docker compose up` no servidor sobe e uma sessão criada sobrevive ao restart |
| **F2 — Pareamento** | QR + **pairing code**; state machine; reconexão automática | Reiniciar o container mantém a sessão (chaves persistidas) |
| **F3 — Entrada** | Webhook assinado + idempotência no bot | Reenvio do mesmo `messageId` não duplica |
| **F4 — Saída** | Texto, mídia (via `squamata-upload`), presença | Chat do painel envia e recebe pelo serviço novo |
| **F5 — Contatos** | `contacts/sync` substituindo o scraping | Sync do painel funciona sem Puppeteer |
| **F6 — Labels** | app state: ler/criar/editar/excluir | `tagService` sincroniza |
| **F7 — Multi-sessão na UI** | Criar sessão nomeada (do setor **ou** de um usuário), badge por canal, filtro por sessão, envio pelo canal escolhido; autorização por `OwnerUserID` | Duas sessões simultâneas, contextos isolados |
| **F8 — Desligamento** | Remover `whatsapp-web.js`/`puppeteer` e o `wwebjsService` | `grep` de aceite do §7 vazio; imagem Docker menor |
| **F9 — Observabilidade** | Métricas por sessão, logs estruturados, alerta de sessão caída | Dashboard mostra sessão desconectada em < 1 min |

**Fases F7–F8 são o antigo Roadmap 2** (múltiplos WhatsApps + multi-profissionais). Elas deixam de ser "adicionar sessões ao que existe" e passam a ser "expor na UI o que o serviço já suporta".

---

## 10. Riscos e mitigações

| Risco | Severidade | Mitigação |
| :--- | :--- | :--- |
| **`whatsmeow` é protocolo não oficial** — risco de banimento do número | 🔴 Alto | Mesma classe de risco do `whatsapp-web.js` atual (não é um risco *novo*). Mitigar com: rate limit por sessão, sem comportamento de spam, número dedicado de teste antes de produção, aviso no onboarding |
| Pareamento perdido a cada deploy | 🟠 Médio | Arquivo SQLite em volume persistente + `journal_mode=WAL` + `busy_timeout`; teste de "reiniciar container mantém sessão" é o aceite da F2 |
| **Credenciais atuais não são migráveis** — hoje o `whatsapp-web.js` guarda a sessão em `RemoteAuth` + `UnifiedMongoStore` (GridFS), formato incompatível com o `sqlstore` | ⚪ **não se aplica hoje** | **Não há número real em produção** (confirmado em 2026-10-29): não há repareamento a fazer. Se surgir número real antes da F8, o repareamento precisa entrar no plano |
| **Big-bang quebra o WhatsApp** | ⚪ **risco baixo** | Sem número em produção, **não precisamos de dupla execução nem feature flag**. A virada é direta; o `wwebjsService` é removido na F8 sem conviver com o novo |
| Perda de mensagem entre o serviço e o bot | 🟠 Médio | Retry com backoff + idempotência por `messageId` + fila de saída persistida no Go |
| **Labels podem não estar totalmente cobertas** | 🟡 Baixo | O README cita "app state" genérico. **Validar na F0**; se não cobrir, o fallback é manter labels só na UI (funcionalidade degradada, não quebrada) |
| Mídia trafegando em base64 estoura memória | 🟠 Médio | Sempre por URL assinada do `squamata-upload`; base64 só para arquivos pequenos |
| Mais um segredo (`SQUAMATA_INTERNAL_TOKEN`) | 🟡 Baixo | Documentar no `.env.example` de ambos; rotação planejada |
| Broadcast list não suportado | 🟡 Baixo | Campanhas continuam 1:1 (já é o comportamento atual) |

---

## 11. Impacto cruzado nos outros roadmaps

| Roadmap | Impacto | Ação |
| :--- | :--- | :--- |
| **R1 (multi-usuários) — ✅ concluído** | **Nenhum conflito.** Offboarding, transferência de leads, auditoria e concorrência otimista continuam válidos: são escopo por `businessId`, e a sessão é uma dimensão adicional | Nenhuma |
| **R3 (testes)** | 🟠 **Direto.** Vários mocks de `wwebjsService` vão desaparecer. Os testes que mockam `sendWWebJSMessage`/`getClientSession` precisam passar a mockar o adaptador | Planejar junto com a F4 |
| **R5 (landing/SEO)** | Nenhum | — |
| **Smoke test (Calango-docs)** | 🟠 Precisa de manifest novo: health do `squamata-whatsapp` + ausência do antigo | Atualizar na F1 |
| **`constitution.md` / `Architecture.md`** | 🟠 O serviço precisa entrar na tabela de camadas, portas e ordem de subida | Atualizar na F1 (ADR 005) |
| **Calango-food** | Nenhum hoje. **Oportunidade futura**: notificação de status do pedido por WhatsApp usando o mesmo serviço — é o argumento de reutilização | — |
| **marianos-meat / gateway** | Nenhum | — |

---

## 12. Decisões fechadas em 2026-10-29

| # | Pergunta | Resposta |
| :--- | :--- | :--- |
| 1 | Nome do repositório | **`Squamata-whatsapp`** |
| 2 | Banco das sessões | **SQLite embarcado** (arquivo em volume) via `sqlstore`. MongoDB descartado com evidência (ADR 005); Postgres descartado porque a sessão é pinada ao processo, então multi-réplica não agrega |
| 3 | Sessões: profissionais ou setores? | **Ambos** — `OwnerUserID` opcional (§4) |
| 4 | Existe número real em produção? | **Não.** Sem repareamento e sem dupla execução; virada direta na F8 |
| 5 | Driver SQLite e dialeto | **`modernc.org/sqlite`** (Go puro, `CGO_ENABLED=0`) com `sqlstore.NewWithDB(db, "sqlite3")` + `Container.Upgrade` explícito. Validado em Windows sem `gcc` (`go test ./internal/store`); piso do Go = **1.26**, exigido pelo `whatsmeow`. Ver [ADR 005](../Calango-docs/docs/ADRs/005-armazenamento-sessoes-whatsapp.md) |

### Ainda em aberto (não bloqueiam a F1)

1. **Chip de teste para a F0.** O spike precisa de um número dedicado — não usar número de cliente.
2. **Quem opera o primeiro pareamento** de cada empresa quando isso for ao ar.

---

## 13. Herança do roadmap anterior

O documento antigo marcava 8/17 itens como feitos. A verificação mostrou **3/17 reais**:

- **2.1 estava morto** — `models/Session.js` usava `require()` num pacote `type: "module"` e **nenhum arquivo o importava**. Foi **removido** em 2026-10-29.
- **2.2 / 2.3 / 2.4 estão corretos no schema** (`whatsappSessionId` em `Contact`, `Message`, `BusinessConfig`, `Appointment`), mas **nenhum writer os preenche**. Servem como base para a F7 — com a ressalva do §8 sobre `ObjectId` → `String`.

Os **objetivos de produto** do roadmap antigo (multi-profissionais/setores, catálogo por canal, agenda por canal, badges, filtros no kanban) **permanecem** — mudaram de "adicionar sessões ao serviço embutido" para "expor na UI o que o microsserviço já suporta" (F7).

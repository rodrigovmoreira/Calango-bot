import { AsyncLocalStorage } from 'node:async_hooks';

// ============================================================================
// Contexto de auditoria (Ponto 5 — Rastreabilidade)
//
// O objetivo é responder "quem gravou este documento?" sem ter que passar o
// usuário logado por parâmetro em cada camada (controller → service → model).
// O Express abre um contexto por requisição; o middleware de autenticação
// preenche o ator quando ele existe. Escritas automáticas (messageHandler,
// aiTools, scheduler) simplesmente não preenchem nada, e o contexto devolve
// `origin: 'system'` com `userId: null` — ou seja, o campo nunca "mente".
// ============================================================================

const SYSTEM_ACTOR = Object.freeze({ userId: null, origin: 'system' });

const storage = new AsyncLocalStorage();

/**
 * Abre um contexto de auditoria para a requisição. O store é um objeto mutável
 * de propósito: o `authenticateToken` roda depois deste middleware e só grava
 * o usuário nele.
 */
export const auditContextMiddleware = (req, res, next) => {
  storage.run({ userId: null, origin: 'system' }, next);
};

/** Marca o ator humano da requisição corrente. */
export const setAuditActor = (userId) => {
  const store = storage.getStore();
  if (!store) return;
  store.userId = userId ? String(userId) : null;
  store.origin = userId ? 'user' : 'system';
};

/** Ator corrente (ou o ator de sistema quando não há contexto). */
export const getAuditActor = () => storage.getStore() || SYSTEM_ACTOR;

/** Executa `fn` com um ator explícito — útil em scripts e backfills.
 *
 * O wrapper é `async` de propósito: queries do Mongoose só executam quando são
 * aguardadas, e se o `await` acontecer fora do escopo o contexto já teria
 * sido descartado. Aguardando dentro, a execução continua no mesmo escopo.
 */
export const runWithAuditActor = (userId, fn) =>
  storage.run({ userId: userId ? String(userId) : null, origin: userId ? 'user' : 'system' }, async () =>
    fn()
  );

import mongoose from 'mongoose';
import { getAuditActor } from './auditContext.js';

// ============================================================================
// auditPlugin — Rastreabilidade básica (Roadmap 1, Ponto 5.1 + 5.2)
//
// Em vez de injetar `createdBy`/`lastUpdatedBy` manualmente em cada controller
// (são 7 pontos de escrita e novos aparecem a cada feature), o plugin cobre a
// escrita no nível do schema. Qualquer `save()`, `create()`, `findOneAndUpdate`,
// `updateOne`, `updateMany`, `replaceOne` ou `findOneAndReplace` no modelo já
// grava o autor — inclusive código futuro.
//
// Regras:
//  - `createdBy` só é gravado na inserção e NUNCA sobrescreve um valor
//    explícito (importação/backfill podem informar).
//  - `lastUpdatedBy` / `lastUpdatedAt` / `lastUpdatedOrigin` são gravados em
//    toda escrita. Sem usuário logado → `lastUpdatedBy: null` e
//    `origin: 'system'`, para a UI poder dizer "automático" em vez de mentir.
// ============================================================================

const AUDIT_FIELDS = {
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    default: null
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    default: null
  },
  lastUpdatedAt: { type: Date, default: null },
  lastUpdatedOrigin: {
    type: String,
    enum: ['user', 'system', null],
    default: null
  }
};

const stamp = (hasUpdatedAt) => {
  const { userId, origin } = getAuditActor();
  const now = new Date();
  const set = {
    lastUpdatedBy: userId,
    lastUpdatedAt: now,
    lastUpdatedOrigin: origin
  };
  // `BusinessConfig` já declara `updatedAt` e nada o atualizava — mantemos o
  // campo coerente com a última alteração real.
  if (hasUpdatedAt) set.updatedAt = now;
  return { userId, set };
};

export default function auditPlugin(schema) {
  schema.add(AUDIT_FIELDS);

  const hasUpdatedAt = Boolean(schema.path('updatedAt'));

  schema.pre('save', function auditSave(next) {
    const { set } = stamp(hasUpdatedAt);

    if (this.isNew && (this.createdBy === undefined || this.createdBy === null)) {
      this.createdBy = getAuditActor().userId;
    }

    this.lastUpdatedBy = set.lastUpdatedBy;
    this.lastUpdatedAt = set.lastUpdatedAt;
    this.lastUpdatedOrigin = set.lastUpdatedOrigin;

    if (hasUpdatedAt) this.updatedAt = set.updatedAt;

    next();
  });

  // Escritas de inserção em lote não disparam `save`.
  schema.pre('insertMany', function auditInsertMany(next, docs) {
    const { userId } = getAuditActor();
    const now = new Date();
    for (const doc of docs || []) {
      if (doc.createdBy === undefined || doc.createdBy === null) doc.createdBy = userId;
      doc.lastUpdatedBy = userId;
      doc.lastUpdatedAt = now;
      doc.lastUpdatedOrigin = userId ? 'user' : 'system';
      if (hasUpdatedAt) doc.updatedAt = now;
    }
    next();
  });

  const auditQueryUpdate = function (next) {
    const update = this.getUpdate();
    const { userId, set } = stamp(hasUpdatedAt);

    // Pipelines de agregação não aceitam $set misturado: não interfere.
    if (Array.isArray(update) || !update) return next();

    const isOperatorUpdate = Object.keys(update).some((key) => key.startsWith('$'));

    if (!isOperatorUpdate) {
      // Documento puro (`updateOne(filter, { campo: valor })`): vira $set.
      this.setUpdate({ $set: { ...update, ...set } });
      return next();
    }

    update.$set = { ...(update.$set || {}), ...set };

    if (this.options && this.options.upsert) {
      update.$setOnInsert = { ...(update.$setOnInsert || {}) };
      if (update.$setOnInsert.createdBy === undefined || update.$setOnInsert.createdBy === null) {
        update.$setOnInsert.createdBy = userId;
      }
    }

    this.setUpdate(update);
    next();
  };

  for (const hook of [
    'findOneAndUpdate',
    'findOneAndReplace',
    'updateOne',
    'updateMany',
    'replaceOne'
  ]) {
    schema.pre(hook, auditQueryUpdate);
  }
}

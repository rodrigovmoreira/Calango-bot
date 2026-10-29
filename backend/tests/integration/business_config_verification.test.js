import request from 'supertest';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { clearDatabase } from '../setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ID = '507f1f77bcf86cd799439011';

// O negócio ativo é dinâmico: cada teste cria o seu e o middleware mockado lê
// daqui. Antes o `req.user` era fixo e sem `activeBusinessId`, o que fazia a
// rota responder 404 ("Business not found") em vez de exercitar a persistência.
let activeBusinessId = null;

jest.unstable_mockModule(path.resolve(__dirname, '../../middleware/auth.js'), () => ({
  default: (req, res, next) => {
    req.user = { userId: USER_ID, activeBusinessId, role: 'admin' };
    next();
  },
  requireAdmin: (req, res, next) => next(),
  authenticateToken: (req, res, next) => {
    req.user = { userId: USER_ID, activeBusinessId, role: 'admin' };
    next();
  }
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../services/message.js'), () => ({
  getConversations: jest.fn(async () => []),
  getMessagesForContact: jest.fn(async () => []),
  deleteMessages: jest.fn(async () => ({ deletedCount: 0 })),
  saveMessage: jest.fn(),
  getLastMessages: jest.fn(async () => [])
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../services/wwebjsService.js'), () => ({
  sendWWebJSMessage: jest.fn(async () => true),
  getClientSession: jest.fn(() => null)
}));

const { default: businessRoutes } = await import('../../routes/businessRoutes.js');
const { default: BusinessConfig } = await import('../../models/BusinessConfig.js');

const app = express();
app.use(express.json());
app.use('/api/v1/business', businessRoutes);

describe('Business Config Persistence (Integration)', () => {
  beforeEach(async () => {
    await clearDatabase();

    const config = await BusinessConfig.create({
      businessName: 'Test Biz',
      followUpSteps: [{ delayMinutes: 30, message: 'Initial Step', useAI: false }]
    });
    activeBusinessId = String(config._id);
  });

  it('should overwrite followUpSteps when updating config via PUT /config', async () => {
    let config = await BusinessConfig.findById(activeBusinessId);
    expect(config.followUpSteps).toHaveLength(1);
    expect(config.followUpSteps[0].message).toBe('Initial Step');

    const newSteps = [
      { delayMinutes: 60, message: 'Updated Step 1', useAI: true },
      { delayMinutes: 120, message: 'Updated Step 2', useAI: false }
    ];

    const payload = {
      ...config.toObject(),
      followUpSteps: newSteps
    };

    const res = await request(app)
      .put('/api/v1/business/config')
      .send(payload)
      .expect(200);

    expect(res.body.followUpSteps).toHaveLength(2);
    expect(res.body.followUpSteps[0].message).toBe('Updated Step 1');

    const updatedConfig = await BusinessConfig.findById(activeBusinessId);
    expect(updatedConfig.followUpSteps).toHaveLength(2);
    expect(updatedConfig.followUpSteps[0].message).toBe('Updated Step 1');
    expect(updatedConfig.followUpSteps[1].message).toBe('Updated Step 2');

    // Confirma que substituiu em vez de mesclar (2 passos, não 3).
    expect(updatedConfig.followUpSteps).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Initial Step' })
    ]));
  });
});

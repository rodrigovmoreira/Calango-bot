const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const businessRoutes = require('../../routes/businessRoutes');
const BusinessConfig = require('../../models/BusinessConfig');
const { clearDatabase } = require('../setup');

const userId = '507f1f77bcf86cd799439011';

// Mock middlewares
const authenticateToken = (req, res, next) => {
  req.user = { /* removed userId */ };
  next();
};

const app = express();
app.use(express.json());

// Inject mock auth middleware before defining routes
app.use((req, res, next) => {
  next();
});

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { userId: '507f1f77bcf86cd799439011' };
  next();
});

// Mock services that might be called
jest.mock('../../services/message', () => ({
  getConversations: jest.fn(),
  getMessagesForContact: jest.fn(),
  deleteMessages: jest.fn(),
}));

jest.mock('../../config/upload', () => ({
  upload: { single: () => (req, res, next) => next() },
  bucket: {
      file: () => ({
          createWriteStream: () => ({
              on: (evt, cb) => { if (evt === 'finish') cb(); return { end: () => {} }; }
          })
      })
  }
}));

app.use('/api/business', businessRoutes);

describe('Business Config Persistence (Integration)', () => {
  beforeEach(async () => {
    await clearDatabase();
    // Create initial config
    await BusinessConfig.create({
      /* removed userId */,
      businessName: 'Test Biz',
      followUpSteps: [
        { delayMinutes: 30, message: 'Initial Step', useAI: false }
      ]
    });
  });

  it('should overwrite followUpSteps when updating config via PUT /config', async () => {
    // 1. Verify initial state
    let config = await BusinessConfig.findOne({ /* removed userId */ });
    expect(config.followUpSteps).toHaveLength(1);
    expect(config.followUpSteps[0].message).toBe('Initial Step');

    // 2. Prepare payload with NEW followUpSteps
    const newSteps = [
      { delayMinutes: 60, message: 'Updated Step 1', useAI: true },
      { delayMinutes: 120, message: 'Updated Step 2', useAI: false }
    ];

    const payload = {
        ...config.toObject(),
        followUpSteps: newSteps
    };

    // 3. Send PUT request
    const res = await request(app)
      .put('/api/business/config')
      .send(payload)
      .expect(200);

    // 4. Verify response
    expect(res.body.followUpSteps).toHaveLength(2);
    expect(res.body.followUpSteps[0].message).toBe('Updated Step 1');

    // 5. Verify database state
    const updatedConfig = await BusinessConfig.findOne({ /* removed userId */ });
    expect(updatedConfig.followUpSteps).toHaveLength(2);
    expect(updatedConfig.followUpSteps[0].message).toBe('Updated Step 1');
    expect(updatedConfig.followUpSteps[1].message).toBe('Updated Step 2');

    // Explicitly check that it didn't merge (length is 2, not 3)
    expect(updatedConfig.followUpSteps).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ message: 'Initial Step' })
    ]));
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const { clearDatabase } = require('./setup');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const Message = require('../models/Message');

const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Valid ObjectId

// Mock wwebjsService
jest.mock('../services/wwebjsService', () => ({
  sendWWebJSMessage: jest.fn().mockResolvedValue(true),
  initializeWWebJS: jest.fn(),
  startSession: jest.fn(),
  stopSession: jest.fn(),
  getSessionStatus: jest.fn(),
  closeAllSessions: jest.fn(),
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { userId: '507f1f77bcf86cd799439011' };
  next();
});

describe('Agent Chat API', () => {
  let businessConfig;
  let contact;

  beforeEach(async () => {
    await clearDatabase();

    // Create BusinessConfig
    businessConfig = await BusinessConfig.create({
      userId: TEST_USER_ID,
      businessName: 'Test Biz',
      phoneNumber: '5511999999999'
    });

    // Create Contact
    contact = await Contact.create({
      businessId: businessConfig._id,
      phone: '5511888888888',
      name: 'Test Contact',
      channel: 'whatsapp'
    });
  });

  test('POST /api/business/conversations/:contactId/messages sends message', async () => {
    const res = await request(app)
      .post(`/api/v1/business/conversations/${contact._id}/messages`)
      .send({ message: 'Hello from Agent' });

    if (res.statusCode !== 200) {
        console.error('Test Failed Response:', res.body);
    }

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB
    const messages = await Message.find({ contactId: contact._id });
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Hello from Agent');
    expect(messages[0].role).toBe('agent');
  });
});

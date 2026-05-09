const mongoose = require('mongoose');
const { clearDatabase } = require('./setup');
const { mockWWebJS, mockAIService, mockResponseService } = require('./mocks');

// Mock dependencies
jest.mock('../services/wwebjsService', () => mockWWebJS);
jest.mock('../services/aiService', () => mockAIService);
jest.mock('../services/responseService', () => mockResponseService);

const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Appointment = require('../models/Appointment');
const BusinessConfig = require('../models/BusinessConfig');
const SystemUser = require('../models/SystemUser');

// Import the logic to test
const { processCampaigns } = require('../services/campaignScheduler');

describe('Campaign & Scheduler Logic', () => {
  let userId;
  let businessId;

  // Increase test timeout
  jest.setTimeout(60000);

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks(); // Clear call counts

    // Setup basic data: User & Business
    const user = await SystemUser.create({
      name: 'Automation Tester',
      email: 'auto@test.com',
      password: 'hashedpassword',
      isVerified: true
    });
    userId = user._id;

    const config = await BusinessConfig.create({
      businessId: config._id,
      businessName: 'Auto Biz',
      phone: '551100000000',
      whatsappProvider: 'wwebjs',
      availableTags: ['Hot Lead', 'Investor']
    });
    businessId = config._id;
  });

  afterEach(() => {
    // No need to restore timers since we are not using fake timers anymore
  });

  test('Scenario A: Static Recurring Campaign finds due campaign', async () => {
    // Check DB Connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected in test!');
    }

    // 1. Create Tagged Contact
    const contact = await Contact.create({
      businessId,
      phone: '5511988887777',
      name: 'Target Customer',
      tags: ['Hot Lead']
    });

    // 2. Mock Time
    // 2023-10-02 is a Monday
    // 'America/Sao_Paulo' is usually UTC-3.
    // 13:00 UTC = 10:00 SP.

    // We only mock system time, not the timers/intervals
    jest.useFakeTimers({
        doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick']
    });
    jest.setSystemTime(new Date('2023-10-02T13:00:00Z')); // 10:00 AM Sao Paulo

    // 3. Create Campaign
    await Campaign.create({
      businessId: config._id,
      name: 'Monday Promo',
      type: 'recurring',
      triggerType: 'time',
      contentMode: 'static',
      message: 'Hello Hot Lead!',
      targetTags: ['Hot Lead'],
      isActive: true,
      schedule: {
        time: '10:00',
        days: [1] // Monday
      },
      delayRange: { min: 0, max: 0 }
    });

    // 4. Run Logic
    await processCampaigns();

    // 5. Verify
    // Logic is now awaited inside dispatchCampaign because of NODE_ENV=test check
    expect(mockResponseService.sendUnifiedMessage).toHaveBeenCalledTimes(1);
    expect(mockResponseService.sendUnifiedMessage).toHaveBeenCalledWith(
      contact.phone,
      'Hello Hot Lead!',
      'wwebjs',
      userId
    );

    jest.useRealTimers();
  });

  test('Scenario B: Event/Agenda Campaign triggers on appointment', async () => {
    // 1. Setup Dates
    const now = new Date('2023-10-04T10:00:00Z');
    jest.useFakeTimers({
        doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick']
    });
    jest.setSystemTime(now);

    const offsetMinutes = 24 * 60; // 24 hours

    const appointmentTime = new Date(now.getTime() + offsetMinutes * 60000 + 10000); // 10s into the window

    // 2. Create Appointment
    const appt = await Appointment.create({
      businessId: config._id,
      clientName: 'Event Client',
      clientPhone: '5511911112222',
      start: appointmentTime,
      end: new Date(appointmentTime.getTime() + 30 * 60000),
      status: 'confirmed',
      title: 'Consultation'
    });

    // 3. Create Campaign (Event triggered)
    await Campaign.create({
      businessId: config._id,
      name: 'Reminder 24h',
      type: 'broadcast',
      triggerType: 'event',
      eventTargetStatus: ['confirmed'],
      eventOffset: offsetMinutes, // 1440 minutes
      contentMode: 'static',
      message: 'Reminder: You have an appointment tomorrow at {{time}}',
      isActive: true,
      delayRange: { min: 0, max: 0 }
    });

    // 4. Run Logic
    await processCampaigns();

    // 5. Assertion
    expect(mockResponseService.sendUnifiedMessage).toHaveBeenCalled();

    const calls = mockResponseService.sendUnifiedMessage.mock.calls;
    // Filter calls for this specific phone to avoid interference if cleanup failed (though it shouldn't)
    const call = calls.find(args => args[0] === '5511911112222');
    expect(call).toBeDefined();

    expect(call[1]).toContain('Reminder: You have an appointment tomorrow');

    jest.useRealTimers();
  });
});

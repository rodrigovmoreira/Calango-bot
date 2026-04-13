import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mocks devem vir ANTES dos imports que dependem deles
const mockBusinessConfigFns = { findOne: jest.fn() };
jest.unstable_mockModule(
  path.resolve(__dirname, '../../models/BusinessConfig.js'),
  () => ({ default: mockBusinessConfigFns })
);

const mockAppointmentFns = { findOne: jest.fn() };
jest.unstable_mockModule(
  path.resolve(__dirname, '../../models/Appointment.js'),
  () => ({ default: mockAppointmentFns })
);

const { checkAvailability } = await import('../../services/aiTools.js');

describe('AI Tools - checkAvailability', () => {
  let businessConfigMock;

  beforeEach(() => {
    businessConfigMock = {
      userId: new mongoose.Types.ObjectId(),
      minSchedulingNoticeMinutes: 60,
      timezone: 'America/Sao_Paulo',
      operatingHours: {
        opening: '09:00',
        closing: '18:00',
        timezone: 'America/Sao_Paulo'
      }
    };

    mockBusinessConfigFns.findOne.mockResolvedValue(businessConfigMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should reject if start time is within buffer period', async () => {
    const now = new Date();
    const bufferMinutes = 60;

    const startTime = new Date(now.getTime() + 30 * 60000);
    const endTime = new Date(now.getTime() + 90 * 60000);

    const result = await checkAvailability(businessConfigMock.userId, startTime, endTime);

    expect(result.available).toBe(false);
    expect(result.reason).toContain(`Necessário agendar com no mínimo ${bufferMinutes} minutos de antecedência`);
  });

  test('should allow if start time is after buffer period', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 120 * 60000);
    const endTime = new Date(now.getTime() + 180 * 60000);

    businessConfigMock.operatingHours = { opening: '00:00', closing: '23:59', timezone: 'UTC' };
    mockBusinessConfigFns.findOne.mockResolvedValue(businessConfigMock);
    mockAppointmentFns.findOne.mockResolvedValue(null);

    const result = await checkAvailability(businessConfigMock.userId, startTime, endTime);
    expect(result.available).toBe(true);
  });
});

import { jest } from '@jest/globals';

const mockWWebJS = {
  initializeWWebJS: jest.fn(),
  getSessionStatus: jest.fn(() => ({ status: 'CONNECTED' })),
  getSessionQR: jest.fn(),
  closeAllSessions: jest.fn(),
  sendMessage: jest.fn(() => Promise.resolve(true)),
  getLabels: jest.fn(() => Promise.resolve([])),
  createLabel: jest.fn((userId, name) => Promise.resolve({ id: 'mock_id_' + Date.now(), name, hexColor: '#A0AEC0' })),
  updateLabel: jest.fn((userId, id, name, color) => Promise.resolve({ id, name, hexColor: color })),
  deleteLabel: jest.fn(() => Promise.resolve(true)),
  setChatLabels: jest.fn(() => Promise.resolve(true)),
};

const mockAIService = {
  callDeepSeek: jest.fn(() => Promise.resolve('Mocked AI Response')),
};

const mockResponseService = {
  sendUnifiedMessage: jest.fn(() => Promise.resolve(true)),
};

export { mockWWebJS, mockAIService, mockResponseService };

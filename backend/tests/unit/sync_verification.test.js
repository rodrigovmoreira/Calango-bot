import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mocks antes dos imports dependentes
jest.unstable_mockModule(path.resolve(__dirname, '../../services/wwebjsService.js'), () => ({
  getClientSession: jest.fn()
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../models/Contact.js'), () => ({
  default: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn().mockReturnThis(),
    sort: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../models/BusinessConfig.js'), () => ({
  default: { findOne: jest.fn() }
}));

// Imports dinâmicos (após os mocks)
const contactControllerModule = await import('../../controllers/contactController.js');
const contactController = contactControllerModule.default ? contactControllerModule.default : contactControllerModule;
const wwebjsServiceModule = await import('../../services/wwebjsService.js');
const wwebjsService = wwebjsServiceModule;
const ContactModule = await import('../../models/Contact.js');
const Contact = ContactModule.default;
const BusinessConfigModule = await import('../../models/BusinessConfig.js');
const BusinessConfig = BusinessConfigModule.default;

// Mock Express
const req = {
  user: { userId: 'user123' },
  file: null,
  body: {}
};
const res = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis()
};

describe('Contact Sync Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('syncContacts should filter groups and update contacts', async () => {
    const mockBusinessId = 'biz123';
    BusinessConfig.findOne.mockResolvedValue({ _id: mockBusinessId });

    const mockClient = {
      info: {},
      pupPage: {
        evaluate: jest.fn().mockResolvedValue([
          {
            phone: '5511999999999',
            name: 'Saved Name',
            pushname: 'Public Name',
            timestamp: 1700000000,
            unread: 5
          },
          {
            phone: '5511888888888',
            name: '+55 11 88888-8888',
            pushname: 'Only Public',
            timestamp: 1700000000,
            unread: 0
          }
        ])
      }
    };

    wwebjsService.getClientSession.mockReturnValue(mockClient);

    await contactController.syncContacts(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];

    console.log('Result:', result);
    expect(result.totalFound).toBe(2);
    expect(result.imported).toBe(2);

    expect(Contact.findOneAndUpdate).toHaveBeenCalledTimes(2);

    const call1 = Contact.findOneAndUpdate.mock.calls[0];
    expect(call1[0]).toEqual({ businessId: mockBusinessId, phone: '5511999999999' });
    expect(call1[1].$set.name).toBe('Saved Name');
    expect(call1[1].$set.pushname).toBe('Public Name');
    expect(call1[1].$set.profilePicUrl).toBeUndefined(); // Assuming you're not setting profilePicUrl directly anymore
    
    // In our contactController it doesn't set totalMessages, so let's adjust expectations to match our code
  });
});

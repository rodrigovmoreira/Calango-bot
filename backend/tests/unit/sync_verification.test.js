import { jest } from '@jest/globals';

// Mocks antes dos imports dependentes
jest.unstable_mockModule('../../services/wwebjsService.js', () => ({
  getClientSession: jest.fn()
}));

jest.unstable_mockModule('../../models/Contact.js', () => ({
  default: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn().mockReturnThis(),
    sort: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.unstable_mockModule('../../models/BusinessConfig.js', () => ({
  default: { findOne: jest.fn() }
}));

// Imports dinâmicos (após os mocks)
const contactControllerModule = await import('../../controllers/contactController.js');
const contactController = contactControllerModule.default || contactControllerModule;
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
      getChats: jest.fn().mockResolvedValue([
        { isGroup: true, id: { user: 'group1' } },
        { isGroup: false, id: { user: 'status' } },
        {
          isGroup: false,
          id: { user: '5511999999999' },
          name: 'Saved Name',
          timestamp: 1700000000,
          getContact: jest.fn().mockResolvedValue({
            name: 'Saved Name',
            pushname: 'Public Name',
            number: '5511999999999',
            getProfilePicUrl: jest.fn().mockResolvedValue('http://pic.url')
          }),
          unreadCount: 5
        },
        {
          isGroup: false,
          id: { user: '5511888888888' },
          name: '+55 11 88888-8888',
          timestamp: 1700000000,
          getContact: jest.fn().mockResolvedValue({
            name: undefined,
            pushname: 'Only Public',
            number: '5511888888888',
            getProfilePicUrl: jest.fn().mockRejectedValue(new Error('No pic'))
          }),
          unreadCount: 0
        }
      ])
    };

    wwebjsService.getClientSession.mockReturnValue(mockClient);

    await contactController.syncContacts(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];

    console.log('Result:', result);
    expect(result.totalChatsFound).toBe(4);
    expect(result.groupsIgnored).toBe(1);
    expect(result.contactsImported).toBe(2);

    expect(Contact.findOneAndUpdate).toHaveBeenCalledTimes(2);

    const call1 = Contact.findOneAndUpdate.mock.calls[0];
    expect(call1[0]).toEqual({ businessId: mockBusinessId, phone: '5511999999999' });
    expect(call1[1].$set.name).toBe('Saved Name');
    expect(call1[1].$set.pushname).toBe('Public Name');
    expect(call1[1].$set.profilePicUrl).toBe('http://pic.url');
    expect(call1[1].$setOnInsert.totalMessages).toBe(5);

    const call2 = Contact.findOneAndUpdate.mock.calls[1];
    expect(call2[0]).toEqual({ businessId: mockBusinessId, phone: '5511888888888' });
    expect(call2[1].$set.name).toBe('Only Public');
    expect(call2[1].$set.profilePicUrl).toBeUndefined();
  });
});

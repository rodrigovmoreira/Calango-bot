import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock dependencies
jest.unstable_mockModule(path.resolve(__dirname, '../../models/BusinessConfig.js'), () => ({
    default: { findById: jest.fn() }
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../models/Contact.js'), () => ({
    default: {
        findOne: jest.fn(),
        updateOne: jest.fn()
    }
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/message.js'), () => ({
    saveMessage: jest.fn(),
    getLastMessages: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/aiService.js'), () => ({
    buildSystemPrompt: jest.fn(),
    callDeepSeek: jest.fn(),
    getFunnelStagePrompt: jest.fn(),
    formatHistoryText: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/visionService.js'), () => ({
    analyzeImage: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/transcriptionService.js'), () => ({
    transcribeAudio: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/responseService.js'), () => ({
    sendUnifiedMessage: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/wwebjsService.js'), () => ({
    sendStateTyping: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/aiTools.js'), () => ({
    checkAvailability: jest.fn(),
    createAppointmentByAI: jest.fn(),
    searchProducts: jest.fn()
}));

// Load module under test
const messageHandlerModule = await import('../../messageHandler.js');
const { handleIncomingMessage } = messageHandlerModule;
const BusinessConfigModule = await import('../../models/BusinessConfig.js');
const BusinessConfig = BusinessConfigModule.default;
const ContactModule = await import('../../models/Contact.js');
const Contact = ContactModule.default;
const messageService = await import('../../services/message.js');
const aiService = await import('../../services/aiService.js');

describe('Message Handler Audience Filtering', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        // Default Mocks
        messageService.saveMessage.mockResolvedValue();
        messageService.getLastMessages.mockResolvedValue([]);
        aiService.buildSystemPrompt.mockResolvedValue('System Prompt');
        aiService.callDeepSeek.mockResolvedValue('AI Response');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const setupMocks = (mode, whitelist, blacklist, contactData) => {
        BusinessConfig.findById.mockResolvedValue({
            _id: 'biz1',
            aiGlobalDisabled: false,
            aiResponseMode: mode || 'all',
            aiWhitelistTags: whitelist || [],
            aiBlacklistTags: blacklist || [],
            operatingHours: null, // Always Open
            awayMessage: "Closed",
            userId: 'user1',
            prompts: { chatSystem: 'sys' }
        });

        Contact.findOne.mockResolvedValue(contactData);
    };

    test('Mode "all": Should respond to everyone', async () => {
        setupMocks('all', [], [], { tags: [], totalMessages: 10 });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
        expect(aiService.callDeepSeek).toHaveBeenCalled();
    });

    test('Mode "new_contacts": Should respond if contact is NULL (Brand New)', async () => {
        setupMocks('new_contacts', [], [], null); // Contact not found (will be created by saveMessage)

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
    });

    test('Mode "new_contacts": Should respond if contact has NO history (Fresh)', async () => {
        setupMocks('new_contacts', [], [], {
            tags: [],
            totalMessages: 0, // 0 prior messages
            createdAt: new Date() // Just created
        });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
    });

    test('Mode "new_contacts": Should BLOCK if contact has history', async () => {
        setupMocks('new_contacts', [], [], {
            tags: [],
            totalMessages: 5, // Has history
            createdAt: new Date()
        });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: "" }); // Empty response = Blocked
        expect(aiService.callDeepSeek).not.toHaveBeenCalled();
    });

    test('Mode "new_contacts": Should BLOCK if contact is OLD', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

        setupMocks('new_contacts', [], [], {
            tags: [],
            totalMessages: 0,
            createdAt: oldDate
        });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: "" });
        expect(aiService.callDeepSeek).not.toHaveBeenCalled();
    });

    test('Mode "whitelist": Should BLOCK if whitelist is empty', async () => {
        setupMocks('whitelist', [], [], { tags: ['VIP'] }); // Empty whitelist

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: "" });
        expect(aiService.callDeepSeek).not.toHaveBeenCalled();
    });

    test('Mode "whitelist": Should BLOCK if tag missing', async () => {
        setupMocks('whitelist', ['VIP'], [], { tags: ['Lead'] });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: "" });
        expect(aiService.callDeepSeek).not.toHaveBeenCalled();
    });

    test('Mode "whitelist": Should ALLOW if tag present', async () => {
        setupMocks('whitelist', ['VIP'], [], { tags: ['Lead', 'VIP'] });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
    });

    test('Mode "blacklist": Should BLOCK if tag present', async () => {
        setupMocks('blacklist', [], ['Family'], { tags: ['Family', 'Friend'] });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'whatsapp'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: "" });
        expect(aiService.callDeepSeek).not.toHaveBeenCalled();
    });

    test('Mode "blacklist": Should ALLOW if tag missing', async () => {
        setupMocks('blacklist', [], ['Family'], { tags: ['Friend'] });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'web'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
    });

    test('Mode "whitelist": Should ALLOW if tag present (Object format)', async () => {
        setupMocks('whitelist', ['VIP'], [], {
            tags: [{ name: 'VIP', color: '#fff' }, { name: 'Lead', color: '#000' }]
        });

        const promise = handleIncomingMessage({
            from: '123', body: 'Hi', type: 'text', activeBusinessId: 'biz1', channel: 'web'
        }, 'biz1');

        jest.runAllTimers();
        const result = await promise;

        expect(result).toEqual({ text: 'AI Response' });
    });
});

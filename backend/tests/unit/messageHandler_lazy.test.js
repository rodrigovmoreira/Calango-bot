import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock dependencies with factories to prevent module loading execution
jest.unstable_mockModule(path.resolve(__dirname, '../../models/BusinessConfig.js'), () => ({
    default: { findById: jest.fn() }
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../models/Contact.js'), () => ({
    default: {
        findOne: jest.fn(),
        create: jest.fn(),
        updateOne: jest.fn()
    } // Need updateOne since Handler uses it
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/visionService.js'), () => ({
    analyzeImage: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/transcriptionService.js'), () => ({
    transcribeAudio: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/message.js'), () => ({
    saveMessage: jest.fn(),
    getLastMessages: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/aiService.js'), () => ({
    callDeepSeek: jest.fn(),
    buildSystemPrompt: jest.fn(),
    getFunnelStagePrompt: jest.fn(),
    formatHistoryText: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/responseService.js'), () => ({
    sendUnifiedMessage: jest.fn()
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/wwebjsService.js'), () => ({
    sendImage: jest.fn(),
    sendStateTyping: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/aiTools.js'), () => ({
    checkAvailability: jest.fn(),
    createAppointmentByAI: jest.fn(),
    searchProducts: jest.fn()
}));

// Also mock potentially troublesome external libs if they leak through
jest.unstable_mockModule('@google/genai', () => ({ GoogleGenAI: class {} }), { virtual: true });

const messageHandlerModule = await import('../../messageHandler.js');
const { handleIncomingMessage, processBufferedMessages } = messageHandlerModule;

const BusinessConfigModule = await import('../../models/BusinessConfig.js');
const BusinessConfig = BusinessConfigModule.default;
const ContactModule = await import('../../models/Contact.js');
const Contact = ContactModule.default;
const visionService = await import('../../services/visionService.js');
const { analyzeImage } = visionService;
const transcriptionService = await import('../../services/transcriptionService.js');
const { transcribeAudio } = transcriptionService;
const messageService = await import('../../services/message.js');
const { saveMessage, getLastMessages } = messageService;
const aiService = await import('../../services/aiService.js');
const { callDeepSeek, buildSystemPrompt } = aiService;
const responseService = await import('../../services/responseService.js');
const { sendUnifiedMessage } = responseService;

// Mock timers for buffer processing
jest.useFakeTimers();

describe('Lazy Media Processing in MessageHandler', () => {
    const mockBusinessId = 'biz123';
    const mockFrom = '5511999999999';
    const mockBufferKey = `${mockBusinessId}_${mockFrom}`;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiGlobalDisabled: false,
            operatingHours: null, // No operating hours = Always Open
            prompts: { visionSystem: 'Vision Prompt' }
        });

        Contact.findOne.mockResolvedValue({
            isHandover: false,
            tags: []
        });

        getLastMessages.mockResolvedValue([]);
        callDeepSeek.mockResolvedValue("AI Response");
        buildSystemPrompt.mockResolvedValue("System Prompt");
    });

    test('should NOT process media if Handover is active (Lazy Check)', async () => {
        // Setup Handover
        Contact.findOne.mockResolvedValue({ isHandover: true, _id: 'c1', followUpActive: false });

        // Simulate Incoming Image (Web Channel avoids sleep delay)
        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'whatsapp'
        }, mockBusinessId);

        // Fast-forward buffer timer
        jest.runAllTimers();

        // Wait for the promise to resolve (since it's web channel)
        await responsePromise;

        // Expectations
        expect(analyzeImage).not.toHaveBeenCalled(); // Lazy!
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Imagem recebida]'), 'text', null, mockBusinessId, 'whatsapp', undefined
        );
        expect(callDeepSeek).not.toHaveBeenCalled(); // Handover stops AI
    });

    test('should NOT process media if Global AI Disabled', async () => {
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiGlobalDisabled: true
        });

        const mediaData = { data: 'base64audio', mimetype: 'audio/ogg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'audio',
            mediaData,
            provider: 'whatsapp',
            channel: 'whatsapp'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(transcribeAudio).not.toHaveBeenCalled();
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Áudio recebido]'), 'text', null, mockBusinessId, 'whatsapp', undefined
        );
        expect(callDeepSeek).not.toHaveBeenCalled();
    });

    test('should PROCESS media if Bot is Active (Allowed)', async () => {
        // Setup mocks for success
        analyzeImage.mockResolvedValue('A lovely cat');

        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: 'Look at this',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'whatsapp'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(analyzeImage).toHaveBeenCalledWith(mediaData, 'Vision Prompt');

        // Verify saveMessage content includes description
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[VISÃO]: A lovely cat'), 'text', null, mockBusinessId, 'whatsapp', undefined
        );

        // Verify AI called
        expect(callDeepSeek).toHaveBeenCalled();
    });

    test('should PROCESS audio if Bot is Active', async () => {
        transcribeAudio.mockResolvedValue('Hello world');

        const mediaData = { data: 'base64audio', mimetype: 'audio/ogg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'audio',
            mediaData,
            provider: 'whatsapp',
            channel: 'whatsapp'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(transcribeAudio).toHaveBeenCalledWith(mediaData);
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Áudio]: "Hello world"'), 'text', null, mockBusinessId, 'whatsapp', undefined
        );
    });

    test('should NOT process media if Audience Filter blocks (Tags)', async () => {
        // Setup Tag Block (Whitelist Mode, Contact has no tags)
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiResponseMode: 'whitelist',
            aiWhitelistTags: ['vip'],
            operatingHours: null
        });

        Contact.findOne.mockResolvedValue({
            tags: [] // No VIP tag
        });

        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };
        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'whatsapp'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(analyzeImage).not.toHaveBeenCalled();
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Imagem recebida]'), 'text', null, mockBusinessId, 'whatsapp', undefined
        );
    });
});

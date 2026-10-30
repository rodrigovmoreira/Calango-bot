import { jest } from '@jest/globals';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dependências com efeito colateral (Mongo, pipeline de mensagem) são mockadas:
// este teste cobre assinatura e roteamento de eventos, não a persistência.
const handleIncomingMessage = jest.fn();
const saveMessage = jest.fn();
const contactFindOne = jest.fn();
const contactCreate = jest.fn();
const messageExists = jest.fn();

jest.unstable_mockModule(path.resolve(__dirname, '../../messageHandler.js'), () => ({
    handleIncomingMessage,
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../models/Contact.js'), () => ({
    default: { findOne: contactFindOne, create: contactCreate },
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../models/Message.js'), () => ({
    default: { exists: messageExists },
}));
jest.unstable_mockModule(path.resolve(__dirname, '../../services/message.js'), () => ({
    saveMessage,
}));

const { verifySignature, handleSquamataEvent } = await import('../../services/whatsapp/inbound.js');

const SECRET = 'segredo-do-teste';
const TENANT = '68f0c0ffee0123456789abcd';

function signed(body, secret = SECRET) {
    const raw = Buffer.from(JSON.stringify(body), 'utf8');
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return { raw, header: `sha256=${signature}` };
}

function fakeIO() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    return { io: { to }, to, emit };
}

beforeEach(() => {
    jest.clearAllMocks();
    messageExists.mockResolvedValue(false);
    contactFindOne.mockResolvedValue({ _id: 'contact-1' });
    contactCreate.mockResolvedValue({ _id: 'contact-1' });
});

describe('verifySignature', () => {
    const payload = { event: 'session.status', tenantId: TENANT, status: 'ready' };

    test('aceita assinatura correta sobre o corpo bruto', () => {
        const { raw, header } = signed(payload);
        expect(verifySignature(raw, header, SECRET)).toBe(true);
    });

    test('recusa segredo diferente', () => {
        const { raw, header } = signed(payload, 'outro-segredo');
        expect(verifySignature(raw, header, SECRET)).toBe(false);
    });

    test('recusa corpo alterado depois da assinatura', () => {
        const { header } = signed(payload);
        const tampered = Buffer.from(JSON.stringify({ ...payload, status: 'error' }), 'utf8');
        expect(verifySignature(tampered, header, SECRET)).toBe(false);
    });

    test('recusa header sem prefixo sha256=', () => {
        const { raw } = signed(payload);
        expect(verifySignature(raw, 'deadbeef', SECRET)).toBe(false);
    });

    test('recusa ausência de corpo, header ou segredo', () => {
        const { raw, header } = signed(payload);
        expect(verifySignature(null, header, SECRET)).toBe(false);
        expect(verifySignature(raw, null, SECRET)).toBe(false);
        expect(verifySignature(raw, header, '')).toBe(false);
    });

    test('recusa assinatura com tamanho diferente sem lançar exceção', () => {
        const { raw } = signed(payload);
        expect(() => verifySignature(raw, 'sha256=abc', SECRET)).not.toThrow();
        expect(verifySignature(raw, 'sha256=abc', SECRET)).toBe(false);
    });
});

describe('handleSquamataEvent — eventos de sessão', () => {
    test('session.status emite para o tenant nos dois nomes de evento', async () => {
        const { io, to, emit } = fakeIO();

        await handleSquamataEvent({ event: 'session.status', tenantId: TENANT, status: 'qrcode' }, io);

        expect(to).toHaveBeenCalledWith(TENANT);
        expect(emit).toHaveBeenCalledWith('whatsapp_status', 'qrcode');
        expect(emit).toHaveBeenCalledWith('wwebjs_status', 'qrcode');
    });

    test('session.qr entrega payload e imagem', async () => {
        const { io, emit } = fakeIO();

        await handleSquamataEvent({
            event: 'session.qr',
            tenantId: TENANT,
            qr: 'https://wa.me/settings/l?code=abc',
            image: 'data:image/png;base64,AAA',
        }, io);

        expect(emit).toHaveBeenCalledWith('whatsapp_qr', 'https://wa.me/settings/l?code=abc');
        expect(emit).toHaveBeenCalledWith('whatsapp_qr_image', 'data:image/png;base64,AAA');
        expect(emit).toHaveBeenCalledWith('wwebjs_qr', 'https://wa.me/settings/l?code=abc');
    });

    test('session.auth_failure avisa o painel', async () => {
        const { io, emit } = fakeIO();

        await handleSquamataEvent({
            event: 'session.auth_failure',
            tenantId: TENANT,
            sessionId: 'sessao-1',
            message: 'conexão encerrada pelo celular',
        }, io);

        expect(emit).toHaveBeenCalledWith('session_error', expect.objectContaining({
            message: 'conexão encerrada pelo celular',
        }));
    });
});

describe('handleSquamataEvent — mensagens', () => {
    const incoming = {
        event: 'message',
        tenantId: TENANT,
        sessionId: 'sessao-1',
        messageId: '3EB0ABC',
        from: '5511999999999',
        rawFrom: '5511999999999@s.whatsapp.net',
        pushName: 'Ana',
        type: 'text',
        text: 'bom dia',
        timestamp: '2026-10-29T12:00:00Z',
        fromMe: false,
    };

    test('normaliza e entrega ao messageHandler', async () => {
        await handleSquamataEvent(incoming, fakeIO().io);

        expect(messageExists).toHaveBeenCalledWith({ waMessageId: '3EB0ABC' });
        expect(handleIncomingMessage).toHaveBeenCalledTimes(1);

        const [normalized, businessId] = handleIncomingMessage.mock.calls[0];
        expect(businessId).toBe(TENANT);
        expect(normalized).toMatchObject({
            from: '11999999999',
            rawFrom: '5511999999999@s.whatsapp.net',
            body: 'bom dia',
            name: 'Ana',
            type: 'text',
            provider: 'squamata',
            messageId: '3EB0ABC',
        });
        expect(normalized.timestamp.toISOString()).toBe('2026-10-29T12:00:00.000Z');
    });

    test('reenvio do outbox não dispara a IA de novo (dedup na entrada)', async () => {
        messageExists.mockResolvedValue(true);

        await handleSquamataEvent(incoming, fakeIO().io);

        expect(handleIncomingMessage).not.toHaveBeenCalled();
    });

    test('aceita imagem com bytes em base64', async () => {
        await handleSquamataEvent({
            ...incoming,
            type: 'image',
            text: 'segue a foto',
            media: { mime: 'image/jpeg', filename: 'foto.jpg', size: 3, base64: 'AAAA' },
        }, fakeIO().io);

        const [normalized] = handleIncomingMessage.mock.calls[0];
        expect(normalized.type).toBe('image');
        expect(normalized.mediaData).toEqual({
            mimetype: 'image/jpeg',
            data: 'AAAA',
            filename: 'foto.jpg',
        });
    });

    test('mensagem enviada pelo celular é salva como agent', async () => {
        await handleSquamataEvent({
            ...incoming,
            event: 'message.sent',
            fromMe: true,
            text: 'respondi pelo celular',
        }, fakeIO().io);

        expect(handleIncomingMessage).not.toHaveBeenCalled();
        expect(saveMessage).toHaveBeenCalledTimes(1);

        const args = saveMessage.mock.calls[0];
        expect(args[1]).toBe('agent');
        expect(args[2]).toBe('respondi pelo celular');
        expect(args[10]).toBe('3EB0ABC');
        expect(args[11].timestamp).toBeInstanceOf(Date);
    });

    test('tenantId inválido não processa nada', async () => {
        await handleSquamataEvent({ ...incoming, tenantId: 'nao-e-objectid' }, fakeIO().io);

        expect(messageExists).not.toHaveBeenCalled();
        expect(handleIncomingMessage).not.toHaveBeenCalled();
    });
});

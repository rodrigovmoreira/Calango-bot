import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Persistência mockada: o cliente HTTP não toca no Mongo.
const findById = jest.fn();
const updateOne = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../models/BusinessConfig.js'), () => ({
    default: { findById, updateOne },
}));

const client = await import('../../services/whatsapp/client.js');

function chain(result) {
    return { select: () => Promise.resolve(result) };
}

beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SQUAMATA_WHATSAPP_URL;
    delete process.env.SQUAMATA_INTERNAL_TOKEN;
});

afterEach(() => {
    delete process.env.SQUAMATA_WHATSAPP_URL;
    delete process.env.SQUAMATA_INTERNAL_TOKEN;
    jest.restoreAllMocks();
});

describe('cliente do squamata-whatsapp — sem configuração', () => {
    test('isEnabled é false e o envio não faz requisição', async () => {
        const fetchSpy = jest.spyOn(global, 'fetch');

        expect(client.isEnabled()).toBe(false);
        expect(await client.sendText('empresa-1', '11999999999', 'oi')).toBe(false);
        expect(await client.sendMedia('empresa-1', '11999999999', 'https://x/foto.jpg')).toBe(false);
        expect(await client.sendPresence('empresa-1', '11999999999')).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('status degrada em vez de estourar (requisito 5 da 11.1)', async () => {
        const status = await client.getStatus('empresa-1');
        expect(status).toEqual({
            status: 'disconnected',
            isConnected: false,
            mode: 'Serviço de WhatsApp não configurado',
        });
    });

    test('getQr devolve null sem configuração', async () => {
        await expect(client.getQr('empresa-1')).resolves.toBeNull();
    });
});

describe('cliente do squamata-whatsapp — com configuração', () => {
    beforeEach(() => {
        process.env.SQUAMATA_WHATSAPP_URL = 'http://servico:3006';
        process.env.SQUAMATA_INTERNAL_TOKEN = 'token-interno';
        findById.mockReturnValue(chain({ whatsappSessionId: 'sessao-1' }));
    });

    test('sendText usa o token e a sessão salvos (D13)', async () => {
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{"sent":true}',
        });

        const sent = await client.sendText('empresa-1', '11999999999', 'bom dia');

        expect(sent).toBe(true);
        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe('http://servico:3006/api/v1/tenants/empresa-1/sessions/sessao-1/messages');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe('Bearer token-interno');
        expect(JSON.parse(options.body)).toEqual({ to: '11999999999', text: 'bom dia' });
    });

    test('primeiro envio cria a sessão e grava o id na empresa', async () => {
        findById.mockReturnValue(chain({ whatsappSessionId: null, businessName: 'Padaria' }));

        const fetchSpy = jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce({ ok: true, status: 201, text: async () => '{"id":"novo-id"}' })
            .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{"sent":true}' });

        await client.sendText('empresa-1', '11999999999', 'oi');

        expect(fetchSpy.mock.calls[0][0]).toBe('http://servico:3006/api/v1/tenants/empresa-1/sessions');
        expect(updateOne).toHaveBeenCalledWith(
            { _id: 'empresa-1' },
            { $set: { whatsappSessionId: 'novo-id' } }
        );
        expect(fetchSpy.mock.calls[1][0]).toContain('/sessions/novo-id/messages');
    });

    test('falha do serviço vira false, sem lançar (contrato booleano)', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => '{"error":{"code":"SESSION_NOT_CONNECTED","message":"não conectada"}}',
        });

        await expect(client.sendText('empresa-1', '11999999999', 'oi')).resolves.toBe(false);
    });

    test('erro de rede não vaza para o chamador', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(client.sendMedia('empresa-1', '11999999999', 'https://x/a.jpg')).resolves.toBe(false);
    });

    test('status mapeia ready como conectado', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{"status":"ready","phone":"5511999999999"}',
        });

        const status = await client.getStatus('empresa-1');
        expect(status).toEqual({
            status: 'ready',
            isConnected: true,
            mode: 'ready',
            phone: '5511999999999',
        });
    });

    test('status com serviço fora do ar não propaga erro', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));

        const status = await client.getStatus('empresa-1');
        expect(status.isConnected).toBe(false);
        expect(status.mode).toBe('Serviço indisponível');
    });

    test('presença silencia falha: nunca interrompe a conversa', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new Error('boom'));
        await expect(client.sendPresence('empresa-1', '11999999999', 'typing')).resolves.toBe(false);
    });
});

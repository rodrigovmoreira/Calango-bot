import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import squamataWebhookRoutes from '../../routes/squamataWebhookRoutes.js';

const SECRET = 'segredo-do-teste';
const TENANT = '68f0c0ffee0123456789abcd';

function buildApp() {
    const emit = jest.fn();
    const io = { to: jest.fn(() => ({ emit })) };

    const app = express();
    app.set('io', io);
    // Mesmo caminho e mesma ordem do server.js: o webhook vem antes do
    // express.json() global, porque precisa do corpo bruto para o HMAC.
    app.use('/api/v1/webhooks/whatsapp', squamataWebhookRoutes);
    app.use(express.json());

    return { app, emit };
}

function signatureFor(raw) {
    return 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
}

describe('POST /api/v1/webhooks/whatsapp', () => {
    const originalSecret = process.env.SQUAMATA_WEBHOOK_SECRET;

    beforeAll(() => {
        process.env.SQUAMATA_WEBHOOK_SECRET = SECRET;
    });

    afterAll(() => {
        if (originalSecret === undefined) delete process.env.SQUAMATA_WEBHOOK_SECRET;
        else process.env.SQUAMATA_WEBHOOK_SECRET = originalSecret;
    });

    test('recusa requisição sem assinatura', async () => {
        const { app } = buildApp();
        const raw = JSON.stringify({ event: 'session.status', tenantId: TENANT, status: 'ready' });

        const res = await request(app)
            .post('/api/v1/webhooks/whatsapp')
            .set('Content-Type', 'application/json')
            .send(raw);

        expect(res.status).toBe(401);
    });

    test('recusa assinatura de outro segredo', async () => {
        const { app } = buildApp();
        const raw = JSON.stringify({ event: 'session.status', tenantId: TENANT, status: 'ready' });
        const wrong = 'sha256=' + crypto.createHmac('sha256', 'outro').update(raw).digest('hex');

        const res = await request(app)
            .post('/api/v1/webhooks/whatsapp')
            .set('Content-Type', 'application/json')
            .set('X-Signature', wrong)
            .send(raw);

        expect(res.status).toBe(401);
    });

    test('aceita e processa evento de sessão (202)', async () => {
        const { app, emit } = buildApp();
        const raw = JSON.stringify({ event: 'session.status', tenantId: TENANT, status: 'qrcode' });

        const res = await request(app)
            .post('/api/v1/webhooks/whatsapp')
            .set('Content-Type', 'application/json')
            .set('X-Signature', signatureFor(raw))
            .send(raw);

        expect(res.status).toBe(202);
        expect(emit).toHaveBeenCalledWith('whatsapp_status', 'qrcode');
    });

    test('assinatura válida com corpo que não é JSON retorna 400', async () => {
        const { app } = buildApp();
        const raw = 'isto-nao-e-json';

        const res = await request(app)
            .post('/api/v1/webhooks/whatsapp')
            .set('Content-Type', 'application/json')
            .set('X-Signature', signatureFor(raw))
            .send(raw);

        expect(res.status).toBe(400);
    });

    test('sem SQUAMATA_WEBHOOK_SECRET responde 500 e não processa', async () => {
        delete process.env.SQUAMATA_WEBHOOK_SECRET;
        try {
            const { app, emit } = buildApp();
            const raw = JSON.stringify({ event: 'session.status', tenantId: TENANT, status: 'ready' });

            const res = await request(app)
                .post('/api/v1/webhooks/whatsapp')
                .set('Content-Type', 'application/json')
                .set('X-Signature', signatureFor(raw))
                .send(raw);

            expect(res.status).toBe(500);
            expect(emit).not.toHaveBeenCalled();
        } finally {
            process.env.SQUAMATA_WEBHOOK_SECRET = SECRET;
        }
    });
});

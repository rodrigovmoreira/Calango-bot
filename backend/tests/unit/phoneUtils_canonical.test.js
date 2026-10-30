import { canonicalWhatsAppId, whatsAppIdCandidates, toWhatsAppId } from '../../utils/phoneUtils.js';

// D15 (PLANEJAMENTO.md): o whatsapp-web.js gravava @c.us e o whatsmeow usa
// @s.whatsapp.net. Sem formato canônico, a mesma pessoa vira dois contatos.
describe('canonicalWhatsAppId', () => {
    test('converte @c.us legado para @s.whatsapp.net', () => {
        expect(canonicalWhatsAppId('5511999999999@c.us')).toBe('5511999999999@s.whatsapp.net');
    });

    test('mantém @s.whatsapp.net', () => {
        expect(canonicalWhatsAppId('5511999999999@s.whatsapp.net')).toBe('5511999999999@s.whatsapp.net');
    });

    test('número sem sufixo ganha o sufixo canônico', () => {
        expect(canonicalWhatsAppId('5511999999999')).toBe('5511999999999@s.whatsapp.net');
    });

    test('remove máscara', () => {
        expect(canonicalWhatsAppId('+55 (11) 99999-9999')).toBe('5511999999999@s.whatsapp.net');
    });

    test('preserva @lid (privacidade) sem tratar como telefone', () => {
        expect(canonicalWhatsAppId('123456789012345@lid')).toBe('123456789012345@lid');
    });

    test('preserva grupo e broadcast', () => {
        expect(canonicalWhatsAppId('120363335026718801@g.us')).toBe('120363335026718801@g.us');
        expect(canonicalWhatsAppId('status@broadcast')).toBe('status@broadcast');
    });

    test('vazio devolve string vazia', () => {
        expect(canonicalWhatsAppId('')).toBe('');
        expect(canonicalWhatsAppId(null)).toBe('');
    });
});

describe('whatsAppIdCandidates', () => {
    test('devolve canônico e legado para consultar os dois formatos', () => {
        expect(whatsAppIdCandidates('5511999999999@s.whatsapp.net')).toEqual([
            '5511999999999@s.whatsapp.net',
            '5511999999999@c.us',
        ]);
    });

    test('@lid não gera variante @c.us', () => {
        expect(whatsAppIdCandidates('123456789012345@lid')).toEqual(['123456789012345@lid']);
    });
});

describe('toWhatsAppId', () => {
    test('usa o sufixo do whatsmeow', () => {
        expect(toWhatsAppId('11999999999')).toBe('5511999999999@s.whatsapp.net');
    });
});

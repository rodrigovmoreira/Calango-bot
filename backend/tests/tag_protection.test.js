import { jest } from '@jest/globals';
import { clearDatabase } from './setup.js';
import * as tagController from '../controllers/tagController.js';
import Tag from '../models/Tag.js';
import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';
import SystemUser from '../models/SystemUser.js';

// Nota: `tagController` não depende de `services/wwebjsService`, então o mock
// que existia aqui (herança da versão CommonJS) foi removido.

describe('Tag Protection Logic', () => {
    let userId;
    let businessId;

    beforeEach(async () => {
        await clearDatabase();
        jest.clearAllMocks();

        // Setup basic data: User & Business
        const user = await SystemUser.create({
            name: 'Tag Tester',
            email: 'tag@test.com',
            password: 'hashedpassword',
            isVerified: true
        });
        userId = user._id;

        const config = await BusinessConfig.create({
            userId,
            businessName: 'Tag Biz',
            funnelSteps: []
        });
        businessId = config._id;
    });

    test('should prevent deletion of funnel step tag', async () => {
        const tag = await Tag.create({
            businessId,
            name: 'Funnel Step Tag',
            color: '#000000'
        });

        await BusinessConfig.findByIdAndUpdate(businessId, {
            $push: { funnelSteps: { tag: tag.name, label: 'Step 1', order: 1, color: '#000' } }
        });

        const req = { params: { id: tag._id }, user: { userId, activeBusinessId: businessId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await tagController.deleteTag(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('PROIBIDO: Esta tag é uma etapa ativa do Funil')
        }));
    });

    test('should prevent deletion of tag assigned to contact', async () => {
        const tag = await Tag.create({
            businessId,
            name: 'Contact Tag',
            color: '#000000'
        });

        await Contact.create({
            businessId,
            phone: '5511999999999',
            tags: [tag.name]
        });

        const req = { params: { id: tag._id }, user: { userId, activeBusinessId: businessId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await tagController.deleteTag(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('PROIBIDO: Existem 1 contatos com esta tag')
        }));
    });

    test('should allow deletion of unused tag', async () => {
        const tag = await Tag.create({
            businessId,
            name: 'Unused Tag',
            color: '#000000'
        });

        const req = { params: { id: tag._id }, user: { userId, activeBusinessId: businessId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await tagController.deleteTag(req, res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Tag excluída com sucesso.'
        }));

        const deletedTag = await Tag.findById(tag._id);
        expect(deletedTag).toBeNull();
    });
});

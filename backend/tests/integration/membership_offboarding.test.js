import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

// Este teste monta apenas os routers necessários em um app Express mínimo:
// importar `server.js` subiria o servidor de verdade (porta + banco real).
process.env.JWT_SECRET_LOGIN = 'test_secret_login';

// `whatsapp-web.js` (puppeteer) não pode ser carregado no ambiente de teste.
// O resolvedor do `unstable_mockModule` usa `tests/` como base (não a pasta do
// arquivo de teste), por isso o caminho sobe apenas um nível.
jest.unstable_mockModule('../services/wwebjsService.js', () => ({
  getClientSession: jest.fn(() => null),
  sendWWebJSMessage: jest.fn(),
  getStatus: jest.fn(),
  initializeClient: jest.fn(),
  logout: jest.fn()
}));

const { default: SystemUser } = await import('../../models/SystemUser.js');
const { default: BusinessConfig } = await import('../../models/BusinessConfig.js');
const { default: Contact } = await import('../../models/Contact.js');
const { default: businessRoutes } = await import('../../routes/businessRoutes.js');
const { default: contactRoutes } = await import('../../routes/contactRoutes.js');
const { auditContextMiddleware } = await import('../../utils/auditContext.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(auditContextMiddleware);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/contacts', contactRoutes);

const signToken = (user) =>
  jwt.sign(
    { uid: String(user._id), email: user.email, appSlug: 'calango-bot' },
    process.env.JWT_SECRET_LOGIN,
    { expiresIn: '1h' }
  );

const criarUsuario = async (nome, email, businessId, role) => {
  const user = await SystemUser.create({
    name: nome,
    email,
    password: 'hash_de_teste',
    isVerified: true,
    isActive: true,
    activeBusinessId: businessId,
    businesses: [{ businessId, role }]
  });
  return { user, token: signToken(user) };
};

let businessId;
let admin;
let operador;
let terceiro;

beforeEach(async () => {
  await Promise.all([SystemUser.deleteMany({}), BusinessConfig.deleteMany({}), Contact.deleteMany({})]);

  const business = await BusinessConfig.create({ businessName: 'Empresa de Teste' });
  businessId = business._id;

  admin = await criarUsuario('Admin', 'admin@teste.com', businessId, 'admin');
  operador = await criarUsuario('Operador', 'operador@teste.com', businessId, 'operator');
  terceiro = await criarUsuario('Terceiro', 'terceiro@teste.com', businessId, 'operator');
});

describe('Ponto 6.3 — transferência em lote de leads', () => {
  test('admin transfere os leads de um operador para outro', async () => {
    await Contact.create([
      { businessId, phone: '5511900000010', assignedTo: operador.user._id },
      { businessId, phone: '5511900000011', assignedTo: operador.user._id },
      { businessId, phone: '5511900000012', assignedTo: terceiro.user._id }
    ]);

    const res = await request(app)
      .post('/api/v1/contacts/bulk-transfer')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ fromUserId: String(operador.user._id), toUserId: String(terceiro.user._id) });

    expect(res.status).toBe(200);
    expect(res.body.transferred).toBe(2);

    const restantes = await Contact.countDocuments({ assignedTo: operador.user._id });
    expect(restantes).toBe(0);
    expect(await Contact.countDocuments({ assignedTo: terceiro.user._id })).toBe(3);
  });

  test('operador não pode transferir (403)', async () => {
    const res = await request(app)
      .post('/api/v1/contacts/bulk-transfer')
      .set('Authorization', `Bearer ${operador.token}`)
      .send({ fromUserId: String(terceiro.user._id), toUserId: String(operador.user._id) });

    expect(res.status).toBe(403);
  });

  test('destino sem vínculo ativo é recusado', async () => {
    // Inativa o vínculo do terceiro antes de tentar transferir para ele.
    await SystemUser.updateOne(
      { _id: terceiro.user._id, 'businesses.businessId': businessId },
      { $set: { 'businesses.$.status': 'inactive' } }
    );

    const res = await request(app)
      .post('/api/v1/contacts/bulk-transfer')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ fromUserId: String(operador.user._id), toUserId: String(terceiro.user._id) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSFER_TARGET');
  });

  test('origem e destino iguais são recusados', async () => {
    const res = await request(app)
      .post('/api/v1/contacts/bulk-transfer')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ fromUserId: String(operador.user._id), toUserId: String(operador.user._id) });

    expect(res.status).toBe(400);
  });
});

describe('Ponto 6.4 — contagem de leads e desligamento com destino escolhido', () => {
  test('conta os leads atribuídos ao membro', async () => {
    await Contact.create([
      { businessId, phone: '5511900000020', assignedTo: operador.user._id },
      { businessId, phone: '5511900000021', assignedTo: operador.user._id }
    ]);

    const res = await request(app)
      .get(`/api/v1/business/team/${operador.user._id}/lead-count`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalLeads).toBe(2);
  });

  test('inativa o vínculo e transfere os leads para o membro escolhido', async () => {
    await Contact.create([
      { businessId, phone: '5511900000022', assignedTo: operador.user._id },
      { businessId, phone: '5511900000023', assignedTo: operador.user._id }
    ]);

    const res = await request(app)
      .patch(`/api/v1/business/team/${operador.user._id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ transferTo: String(terceiro.user._id) });

    expect(res.status).toBe(200);
    expect(res.body.transferredLeads).toBe(2);
    expect(String(res.body.transferredTo)).toBe(String(terceiro.user._id));

    // O vínculo fica inativo, mas o documento continua existindo (histórico).
    const alvo = await SystemUser.findById(operador.user._id);
    const vinculo = alvo.businesses.find((b) => String(b.businessId) === String(businessId));
    expect(vinculo.status).toBe('inactive');
    expect(String(vinculo.deactivatedBy)).toBe(String(admin.user._id));
    expect(alvo.isActive).toBe(true); // status global intacto

    expect(await Contact.countDocuments({ assignedTo: terceiro.user._id })).toBe(2);
  });

  test('transferTo de quem não é membro ativo é recusado', async () => {
    const estranho = await SystemUser.create({
      name: 'Forasteiro',
      email: 'forasteiro@teste.com',
      password: 'hash_de_teste',
      isActive: true
    });

    const res = await request(app)
      .patch(`/api/v1/business/team/${operador.user._id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ transferTo: String(estranho._id) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSFER_TARGET');
  });

  test('não é possível remover a si mesmo', async () => {
    const res = await request(app)
      .patch(`/api/v1/business/team/${admin.user._id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

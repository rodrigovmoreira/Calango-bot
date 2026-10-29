import mongoose from 'mongoose';
import Contact from '../../models/Contact.js';
import Appointment from '../../models/Appointment.js';
import BusinessConfig from '../../models/BusinessConfig.js';
import { runWithAuditActor } from '../../utils/auditContext.js';

// Roadmap 1 — Ponto 5 (Rastreabilidade): garante que o plugin de auditoria
// grava autor em todos os caminhos de escrita e que escritas automáticas são
// marcadas como `system` em vez de herdarem um usuário qualquer.

const BIZ = new mongoose.Types.ObjectId();
const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();

const novoContato = (phone) => ({ businessId: BIZ, phone, name: `Contato ${phone}` });

describe('auditoria: createdBy / lastUpdatedBy (Ponto 5)', () => {
  beforeEach(async () => {
    await Contact.deleteMany({});
    await Appointment.deleteMany({});
    await BusinessConfig.deleteMany({});
  });

  test('create() com ator grava createdBy e lastUpdatedBy', async () => {
    const contato = await runWithAuditActor(USER_A, () => Contact.create(novoContato('5511900000001')));

    expect(String(contato.createdBy)).toBe(String(USER_A));
    expect(String(contato.lastUpdatedBy)).toBe(String(USER_A));
    expect(contato.lastUpdatedOrigin).toBe('user');
    expect(contato.lastUpdatedAt).toBeInstanceOf(Date);
  });

  test('create() sem ator (escrita automática) grava null + origin system', async () => {
    const contato = await Contact.create(novoContato('5511900000002'));

    expect(contato.createdBy).toBeNull();
    expect(contato.lastUpdatedBy).toBeNull();
    expect(contato.lastUpdatedOrigin).toBe('system');
  });

  test('findOneAndUpdate grava o autor e não sobrescreve createdBy', async () => {
    const contato = await runWithAuditActor(USER_A, () => Contact.create(novoContato('5511900000003')));

    const atualizado = await runWithAuditActor(USER_B, () =>
      Contact.findOneAndUpdate(
        { _id: contato._id, __v: contato.__v },
        { $set: { name: 'Editado' }, $inc: { __v: 1 } },
        { new: true }
      )
    );

    expect(String(atualizado.lastUpdatedBy)).toBe(String(USER_B));
    expect(String(atualizado.createdBy)).toBe(String(USER_A));
    expect(atualizado.__v).toBe(contato.__v + 1);
  });

  test('updateMany sem ator marca todos como system', async () => {
    await Contact.create(novoContato('5511900000004'));
    await Contact.create(novoContato('5511900000005'));

    await Contact.updateMany({ businessId: BIZ }, { $addToSet: { tags: 'auditado' } });

    const contatos = await Contact.find({ businessId: BIZ });
    expect(contatos).toHaveLength(2);
    for (const contato of contatos) {
      expect(contato.lastUpdatedOrigin).toBe('system');
      expect(contato.lastUpdatedBy).toBeNull();
    }
  });

  test('upsert grava createdBy via $setOnInsert', async () => {
    const contato = await runWithAuditActor(USER_B, () =>
      Contact.findOneAndUpdate(
        { businessId: BIZ, phone: '5511900000006' },
        { $set: { name: 'Via upsert' }, $setOnInsert: { businessId: BIZ, phone: '5511900000006' } },
        { new: true, upsert: true }
      )
    );

    expect(String(contato.createdBy)).toBe(String(USER_B));
    expect(String(contato.lastUpdatedBy)).toBe(String(USER_B));
  });

  test('Appointment e BusinessConfig também são auditados', async () => {
    const agendamento = await runWithAuditActor(USER_A, () =>
      Appointment.create({
        businessId: BIZ,
        clientName: 'Cliente',
        clientPhone: '5511900000007',
        title: 'Sessão',
        start: new Date(),
        end: new Date(Date.now() + 3600000)
      })
    );
    expect(String(agendamento.createdBy)).toBe(String(USER_A));

    const negocio = await runWithAuditActor(USER_A, () =>
      BusinessConfig.create({ businessName: 'Negócio Auditado' })
    );
    expect(String(negocio.createdBy)).toBe(String(USER_A));

    // `updatedAt` do BusinessConfig era declarado mas nunca atualizado.
    const updatedAtAnterior = negocio.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 10));

    await runWithAuditActor(USER_B, () =>
      BusinessConfig.findByIdAndUpdate(negocio._id, { $set: { businessName: 'Renomeado' } })
    );

    const recarregado = await BusinessConfig.findById(negocio._id);
    expect(String(recarregado.lastUpdatedBy)).toBe(String(USER_B));
    expect(recarregado.updatedAt.getTime()).toBeGreaterThan(updatedAtAnterior.getTime());
  });
});

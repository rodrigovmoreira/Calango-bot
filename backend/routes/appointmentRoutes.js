import express from 'express';
const router = express.Router();
import Appointment from '../models/Appointment.js';
import authenticateToken from '../middleware/auth.js';

// ROTA: GET /api/appointments (Listar)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { userId: req.user.userId };

    // Filtro por data (usado pelo calendário)
    if (start && end) {
      query.start = { $gte: new Date(start), $lte: new Date(end) };
    }

    const appointments = await Appointment.find(query).sort({ start: 1 });
    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar agenda' });
  }
});

// ROTA: POST /api/appointments (Criar com validação)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { clientName, clientPhone, title, start, end, type } = req.body;

    // Validação de Conflito de Horário
    const conflito = await Appointment.findOne({
      userId: req.user.userId,
      status: { $in: ['scheduled', 'confirmed'] },
      $or: [
        { start: { $lt: new Date(end), $gte: new Date(start) } },
        { end: { $gt: new Date(start), $lte: new Date(end) } }
      ]
    });

    if (conflito) {
      return res.status(409).json({ message: 'Já existe um agendamento neste horário!' });
    }

    const newAppointment = await Appointment.create({
      userId: req.user.userId,
      clientName,
      clientPhone,
      title,
      start,
      end,
      type
    });

    res.status(201).json(newAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar agendamento' });
  }
});

// PUT /api/appointments/:id
// Atualiza agendamento
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Sanitização para evitar Mass Assignment
    const allowedFields = ['clientName', 'clientPhone', 'title', 'start', 'end', 'type', 'status', 'notes', 'description'];
    const updateData = {};
    Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
            updateData[key] = req.body[key];
        }
    });

    const updated = await Appointment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Agendamento não encontrado' });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar' });
  }
});

// PATCH /api/appointments/:id/status
// Atualiza Status do Ciclo de Vida
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findOne({ _id: req.params.id, userId: req.user.userId });

    if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado' });

    appointment.status = status;
    appointment.statusHistory.push({
      status: status,
      changedAt: new Date(),
      changedBy: req.user.userId
    });

    await appointment.save();
    res.json(appointment);
  } catch (error) {
    console.error('Erro status update:', error);
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

// ROTA: DELETE /api/appointments/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await Appointment.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Agendamento removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' });
  }
});

export default router;
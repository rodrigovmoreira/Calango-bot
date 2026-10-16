import mongoose from 'mongoose';
const systemUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true
  },
  avatarUrl: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true
  },
  // Legado: usuários SSO não possuem senha real (placeholder).
  // Mantido no schema para retrocompatibilidade com registros antigos.
  password: {
    type: String,
    required: false,
    minlength: 6,
    select: false
  },
  activeBusinessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig'
  },
  businesses: [{
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessConfig',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'operator', 'campaign_manager'],
      required: true,
      default: 'operator'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  googleId: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  whatsappConnected: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Atualiza o timestamp de modificação antes de salvar.
// As senhas são gerenciadas pelo Squamata-Login (SSO) — não há mais hash local.
systemUserSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  next();
});

export default mongoose.model('SystemUser', systemUserSchema);
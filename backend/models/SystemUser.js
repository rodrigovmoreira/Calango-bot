import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  password: {
    type: String,
    required: false,  // ← mudado para false (SSO users usam placeholder)
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

// Hash password antes de salvar
systemUserSchema.pre('save', async function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  
  // Pular hash para placeholder de SSO ou se senha não foi modificada
  if (!this.isModified('password')) return next();
  
  // SSO users: placeholder não precisa de hash
  if (this.password === 'sso_placeholder_do_not_use') {
    console.log('🔑 SystemUser SSO — pulando hash do placeholder');
    return next();
  }
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    console.log('✅ Senha hasheada com sucesso para SystemUser:', this.email);
    next();
  } catch (error) {
    console.error('💥 ERRO ao hashear senha do SystemUser:', error);
    next(error);
  }
});

// Método para comparar password
systemUserSchema.methods.correctPassword = async function(candidatePassword) {
  console.log('🔑 Comparando senhas para SystemUser:', this.email);
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('✅ Comparação de senha do SystemUser:', isMatch ? 'VÁLIDA' : 'INVÁLIDA');
    return isMatch;
  } catch (error) {
    console.error('💥 ERRO ao comparar senhas do SystemUser:', error);
    return false;
  }
};

export default mongoose.model('SystemUser', systemUserSchema);
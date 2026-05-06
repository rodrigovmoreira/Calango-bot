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
    required: [true, 'Senha é obrigatória'],
    minlength: 6,
    select: false
  },
  company: {
    type: String,
    trim: true,
    default: 'Meu Negócio'
  },
  role: { // Legacy
    type: String,
    enum: ['admin', 'vendedor', 'atendente'],
    default: 'vendedor'
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
      enum: ['admin', 'operator'],
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
  console.log('🔑 Hashando senha para SystemUser:', this.email);
  
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    console.log('✅ Senha hasheada com sucesso para SystemUser');
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
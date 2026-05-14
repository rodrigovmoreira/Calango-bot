import axios from 'axios';

// Se estiver rodando localmente, mantém localhost.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
});

// Interceptor: Adiciona Token se existir.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Redireciona se Token expirar (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpa dados locais
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Só redireciona se já não estiver na tela de login para evitar loop
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Rotas de Autenticação (Atualizadas para /api/auth) ---
export const authAPI = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  updateUser: (data) => api.put('/api/auth/update', data),
  // Team & Invites (Ponto 2.2 - Roadmap 1)
  createInvite: (data) => api.post('/api/auth/invites', data), // { role }
  getInvite: (token) => api.get(`/api/auth/invites/${token}`), // Validação pública de convite
};

// --- Rotas de Negócio (Dashboard) ---
export const businessAPI = {
  // 1. Configurações Gerais (Atualizado para /api/business)
  getConfig: () => api.get('/api/business/config'),
  updateConfig: (data) => api.put('/api/business/config', data),
  getTeam: () => api.get('/api/business/team'),
  
  // 2. Controle do WhatsApp (Atualizado para /api/whatsapp)
  getWhatsAppStatus: () => api.get('/api/whatsapp/status'),
  startWhatsApp: () => api.post('/api/whatsapp/start'), // <--- Botão "Ligar"
  logoutWhatsApp: () => api.post('/api/whatsapp/logout'), // <--- Botão "Desconectar"

  // 3. Inteligência e Presets (Atualizado para /api/business)
  getPresets: () => api.get('/api/business/presets'),
  getBusinessTags: () => api.get('/api/business/tags'), // <--- NOVO: Get defined tags with colors
  importWhatsAppLabels: () => api.post('/api/whatsapp/import-labels'), // <--- NOVO: Import labels
  applyPreset: (presetKey) => api.post('/api/business/apply-preset', { presetKey }),

  // Novo fluxo: Solicita URL assinada do Squamata Upload
  requestUploadUrl: (fileName, contentType) => api.post('/api/business/request-upload-url', { fileName, contentType }),
  
  // Upload de Imagem - Agora é feito direto no cliente
  // Use uploadHelper.uploadFileToFirebase() ou uploadHelper.uploadMultipleFiles() ao invés disso
  uploadImage: (formData) => {
    // Mantido para compatibilidade, mas redireciona para o novo fluxo
    const file = formData.get('image');
    const type = formData.get('type') || 'product';
    
    if (!file) return Promise.reject(new Error('Nenhum arquivo enviado'));
    
    // Importa dinamicamente para evitar circular dependency
    return import('../utils/uploadHelper.js').then(({ uploadFileToFirebase }) => {
      return uploadFileToFirebase(file, type).then(result => ({
        data: { imageUrl: result.imageUrl }
      }));
    });
  },
  
  // Deleção de imagem pode ser feita via Firebase Admin ou Squamata
  // Por enquanto mantém compatibilidade mas não faz nada
  deleteImage: (imageUrl) => {
    console.warn('deleteImage: Firebase image deletion via URL not yet implemented');
    return Promise.resolve({ message: 'Imagem marcada para remoção' });
  },

  // 4. Meus Modelos (Custom Prompts) (Atualizado para /api/business)
  getCustomPrompts: () => api.get('/api/business/custom-prompts'),
  saveCustomPrompt: (data) => api.post('/api/business/custom-prompts', data), // data = { name, prompts: { chatSystem, visionSystem } }
  deleteCustomPrompt: (id) => api.delete(`/api/business/custom-prompts/${id}`),
  
  // 5. Agendamentos (NOVO - /api/appointments)
  // O parâmetro 'params' serve para filtrar data { start: '...', end: '...' }
  getAppointments: (params) => api.get('/api/appointments', { params }), 
  createAppointment: (data) => api.post('/api/appointments', data),
  updateAppointment: (id, data) => api.put(`/api/appointments/${id}`, data), // <--- NOVO
  updateAppointmentStatus: (id, status, __v) => api.patch(`/api/appointments/${id}/status`, { status, __v }), // <--- NOVO
  deleteAppointment: (id) => api.delete(`/api/appointments/${id}`),

  // 6. Admin Chat (NOVO - Fase 3)
  getConversations: () => api.get('/api/business/conversations'),
  getMessages: (contactId) => api.get(`/api/business/conversations/${contactId}/messages`),
  sendMessage: (contactId, message) => api.post(`/api/business/conversations/${contactId}/messages`, { message }), // <--- NOVO: Send as Agent
  clearHistory: (contactId) => api.delete(`/api/business/conversations/${contactId}/messages`), // <--- NOVO

  // 7. Contatos (Active CRM)
  getContacts: () => api.get('/api/contacts'),
  getTags: () => api.get('/api/contacts/tags'),
  updateContact: (id, data) => api.put(`/api/contacts/${id}`, data),
  assignContact: (id, userId, __v) => api.patch(`/api/contacts/${id}/assign`, { assignedTo: userId, __v }), // <--- NOVO: Atribuir contato (Ponto 3)
  importContacts: (formData) => api.post('/api/contacts/import', formData),
  syncContacts: () => api.post('/api/contacts/sync'), // <--- FIXED: Correct sync endpoint
};

export const dashboardAPI = {
  getSummary: () => api.get('/api/dashboard/summary'),
};

// --- Tags (Sistema Unificado) ---
export const tagAPI = {
  getAll: () => api.get('/api/tags'),
  create: (data) => api.post('/api/tags', data), // { name, color }
  update: (id, data) => api.put(`/api/tags/${id}`, data), // { name, color }
  delete: (id) => api.delete(`/api/tags/${id}`),
  sync: () => api.post('/api/tags/sync')
};

export default api;
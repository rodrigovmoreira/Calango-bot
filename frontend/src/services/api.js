import axios from 'axios';
import { normalizeApiBase } from './apiBase';

// URL do Squamata-Login (Identity Provider / SSO).
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';
const APP_SLUG = 'calango-bot';

// Se estiver rodando localmente, mantém localhost.
// baseURL aponta para o host; o caminho versionado (/api/v1/...) vem das chamadas.
const api = axios.create({
  baseURL: normalizeApiBase(process.env.REACT_APP_API_URL || 'http://localhost:3000'),
});

// Interceptor: Adiciona Token se existir.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Redireciona ao portal central se o Token expirar (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpa dados locais
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantId');

      // Devolve ao Squamata-Login (evita loop se já estiver no /login)
      if (window.location.pathname !== '/login') {
        window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}`;
      }
    }
    return Promise.reject(error);
  }
);

// --- Rotas de Autenticação (Atualizadas para /api/auth) ---
export const authAPI = {
  login: (data) => api.post('/api/v1/auth/login', data),
  register: (data) => api.post('/api/v1/auth/register', data),
  logout: () => api.post('/api/v1/auth/logout'),
  getProfile: () => api.get('/api/v1/auth/profile'), // NOVO (SSO - CP1)
  updateUser: (data) => api.put('/api/v1/auth/update', data),
  switchBusiness: (targetBusinessId) => api.post('/api/v1/auth/switch-business', { targetBusinessId }),
  // Team & Invites (Ponto 2.2 - Roadmap 1)
  createInvite: (data) => api.post('/api/v1/auth/invites', data), // { role }
  getInvite: (token) => api.get(`/api/v1/auth/invites/${token}`), // Validação pública de convite
  acceptInvite: (inviteToken) => api.post('/api/v1/auth/accept-invite', { inviteToken }), // NOVO (SSO - CP3)
};

// --- Rotas de Negócio (Dashboard) ---
export const businessAPI = {
  // 1. Configurações Gerais (Atualizado para /api/business)
  createBusiness: (data) => api.post('/api/v1/business/create', data),
  getConfig: () => api.get('/api/v1/business/config'),
  updateConfig: (data) => api.put('/api/v1/business/config', data),
  getTeam: () => api.get('/api/v1/business/team'),
  
  // 2. Controle do WhatsApp (Atualizado para /api/whatsapp)
  getWhatsAppStatus: () => api.get('/api/v1/whatsapp/status'),
  startWhatsApp: () => api.post('/api/v1/whatsapp/start'), // <--- Botão "Ligar"
  logoutWhatsApp: () => api.post('/api/v1/whatsapp/logout'), // <--- Botão "Desconectar"

  // 3. Inteligência e Presets (Atualizado para /api/business)
  getPresets: () => api.get('/api/v1/business/presets'),
  getBusinessTags: () => api.get('/api/v1/business/tags'), // <--- NOVO: Get defined tags with colors
  importWhatsAppLabels: () => api.post('/api/v1/whatsapp/import-labels'), // <--- NOVO: Import labels
  applyPreset: (presetKey) => api.post('/api/v1/business/apply-preset', { presetKey }),

  // Novo fluxo: Solicita URL assinada do Squamata Upload
  requestUploadUrl: (fileName, contentType) => api.post('/api/v1/business/request-upload-url', { fileName, contentType }),
  
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
  getCustomPrompts: () => api.get('/api/v1/business/custom-prompts'),
  saveCustomPrompt: (data) => api.post('/api/v1/business/custom-prompts', data), // data = { name, prompts: { chatSystem, visionSystem } }
  deleteCustomPrompt: (id) => api.delete(`/api/v1/business/custom-prompts/${id}`),
  
  // 5. Agendamentos (NOVO - /api/appointments)
  // O parâmetro 'params' serve para filtrar data { start: '...', end: '...' }
  getAppointments: (params) => api.get('/api/v1/appointments', { params }), 
  createAppointment: (data) => api.post('/api/v1/appointments', data),
  updateAppointment: (id, data) => api.put(`/api/v1/appointments/${id}`, data), // <--- NOVO
  updateAppointmentStatus: (id, status, __v) => api.patch(`/api/v1/appointments/${id}/status`, { status, __v }), // <--- NOVO
  deleteAppointment: (id) => api.delete(`/api/v1/appointments/${id}`),

  // 6. Admin Chat (NOVO - Fase 3)
  getConversations: () => api.get('/api/v1/business/conversations'),
  getMessages: (contactId) => api.get(`/api/v1/business/conversations/${contactId}/messages`),
  sendMessage: (contactId, message) => api.post(`/api/v1/business/conversations/${contactId}/messages`, { message }), // <--- NOVO: Send as Agent
  clearHistory: (contactId) => api.delete(`/api/v1/business/conversations/${contactId}/messages`), // <--- NOVO

  // 7. Contatos (Active CRM)
  getContacts: () => api.get('/api/v1/contacts'),
  getTags: () => api.get('/api/v1/contacts/tags'),
  createContact: (data) => api.post('/api/v1/contacts', data),
  updateContact: (id, data) => api.put(`/api/v1/contacts/${id}`, data),
  deleteContact: (id) => api.delete(`/api/v1/contacts/${id}`),
  bulkDeleteContacts: (ids) => api.post('/api/v1/contacts/bulk-delete', { ids }),
  bulkAddTags: (ids, tags) => api.post('/api/v1/contacts/bulk-tags', { ids, tags }),
  assignContact: (id, userId, __v) => api.patch(`/api/v1/contacts/${id}/assign`, { assignedTo: userId, __v }), // <--- NOVO: Atribuir contato (Ponto 3)
  importContacts: (formData) => api.post('/api/v1/contacts/import', formData),
  syncContacts: () => api.post('/api/v1/contacts/sync'), // <--- FIXED: Correct sync endpoint
};

export const dashboardAPI = {
  getSummary: () => api.get('/api/v1/dashboard/summary'),
};

// --- Tags (Sistema Unificado) ---
export const tagAPI = {
  getAll: () => api.get('/api/v1/tags'),
  create: (data) => api.post('/api/v1/tags', data), // { name, color }
  update: (id, data) => api.put(`/api/v1/tags/${id}`, data), // { name, color }
  delete: (id) => api.delete(`/api/v1/tags/${id}`),
  sync: () => api.post('/api/v1/tags/sync')
};

export default api;
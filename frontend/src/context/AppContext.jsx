import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { io } from "socket.io-client";
import { businessAPI } from '../services/api';

const AppContext = createContext();

const initialState = {
  user: null,
  businessConfig: null,
  whatsappStatus: {
    isConnected: false,
    mode: 'Iniciando...',
    qrCode: null,
    error: null
  },
  loading: false
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_BUSINESS_CONFIG':
      return { ...state, businessConfig: action.payload };
    
    case 'SET_WHATSAPP_STATUS': 
      const isConnected = action.payload.isConnected;
      const isDisconnected = action.payload.mode === 'Desconectado';
      return { 
        ...state, 
        whatsappStatus: { 
          ...state.whatsappStatus,
          isConnected: isConnected,
          mode: action.payload.mode,
          error: action.payload.error || null,
          qrCode: (isConnected || isDisconnected || action.payload.error) ? null : state.whatsappStatus.qrCode
        }
      };
      
    case 'SET_QR_CODE':
      return {
        ...state,
        whatsappStatus: { 
          ...state.whatsappStatus, 
          qrCode: action.payload,
          isConnected: false,
          mode: 'Aguardando Leitura',
          error: null
        }
      };

    default:
      return state;
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 1. Carregar dados iniciais (User + Token + Config)
  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        const userObj = JSON.parse(userStr);
        dispatch({ type: 'SET_USER', payload: userObj });
        
        try {
          const config = await businessAPI.getConfig();
          dispatch({ type: 'SET_BUSINESS_CONFIG', payload: config.data });
        } catch (e) { 
          console.error("Erro config inicial:", e); 
        }
      }
    };
    loadInitialData();
  }, []);

  // 2. CONEXÃO SOCKET.IO (CRUCIAL PARA O QR CODE)
  useEffect(() => {
    // Só conecta se tivermos um usuário logado
    if (!state.user || !state.user.id) return;

    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      // --- O PULO DO GATO ---
      // Emitimos o join_session imediatamente após conectar
      socket.emit('join_session', state.user.activeBusinessId);
    });

    socket.on('wwebjs_qr', (qr) => {
      dispatch({ type: 'SET_QR_CODE', payload: qr });
    });

    socket.on('wwebjs_status', (status) => {
      let isConnected = false;
      let mode = 'Desconectado';
      let error = null;

      if (status === 'ready' || status === 'authenticated') {
        isConnected = true;
        mode = 'Conectado';
      } else if (status === 'qrcode') {
        mode = 'Aguardando Leitura';
      } else if (status === 'initializing') {
        mode = 'Iniciando...';
      } else if (status === 'authenticating') {
        mode = 'authenticating';
      } else if (status === 'error') {
        mode = 'Erro Fatal';
        error = "Ocorreu uma falha na inicialização do robô. Por favor, aguarde alguns instantes e recarregue a página.";
      }

      dispatch({ 
        type: 'SET_WHATSAPP_STATUS', 
        payload: { isConnected, mode, error }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [state.user]); // Executa sempre que o usuário muda (Login/Logout)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
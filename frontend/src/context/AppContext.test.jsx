import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import { io } from 'socket.io-client';

const mockSocketInstance = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

// We mock io directly
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn().mockReturnValue({
      on: jest.fn((event, callback) => {
        if (event === 'connect') {
          // Guardar a callback para a podermos invocar
          mockSocketInstance.on.connectCallback = callback;
        }
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
    })
  };
});

// Atualizar o mockSocketInstance para usar as mocks que o jest.fn().mockReturnValue retorna
beforeEach(() => {
  io.mockImplementation(() => mockSocketInstance);
});

// Mock da api para evitar chamadas reais (o AppContext chama businessAPI.getConfig)
jest.mock('../services/api', () => ({
  businessAPI: {
    getConfig: jest.fn().mockResolvedValue({ data: { name: 'Test Business' } }),
  },
}));

const TestComponent = () => {
  const { state } = useApp();
  return (
    <div>
      <span data-testid="user-id">{state.user?.id || 'none'}</span>
      <span data-testid="business-id">{state.user?.activeBusinessId || 'none'}</span>
    </div>
  );
};

describe('AppContext', () => {
  beforeEach(() => {
    // Limpar mocks e localStorage antes de cada teste
    jest.clearAllMocks();
    localStorage.clear();
    mockSocketInstance.on.mockClear();
    mockSocketInstance.emit.mockClear();
    mockSocketInstance.disconnect.mockClear();
    mockSocketInstance.on.connectCallback = undefined;
  });

  it('deve carregar os dados iniciais do utilizador a partir do localStorage', async () => {
    const mockUser = { id: 'user-123', activeBusinessId: 'biz-456' };
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    const { getByTestId } = render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    await waitFor(() => {
      expect(getByTestId('user-id').textContent).toBe('user-123');
      expect(getByTestId('business-id').textContent).toBe('biz-456');
    });
  });

  it('deve emitir o evento join_session via socket quando o utilizador estiver logado e conectado', async () => {
    const mockUser = { id: 'user-123', activeBusinessId: 'biz-456' };
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    // Esperar que o utilizador seja carregado e o io() chamado
    await waitFor(() => {
      // O AppContext deve ter chamado io()
      expect(io).toHaveBeenCalled();
    });

    // Simular o evento 'connect' no socket
    const connectHandlerCall = mockSocketInstance.on.mock.calls.find(call => call[0] === 'connect');
    expect(connectHandlerCall).toBeDefined();

    const connectHandler = connectHandlerCall[1];

    // Executar a callback associada ao evento 'connect' envolta em act()
    act(() => {
      connectHandler();
    });

    // Verificar se o join_session foi emitido com o activeBusinessId correto
    expect(mockSocketInstance.emit).toHaveBeenCalledWith('join_session', 'biz-456');
  });
});

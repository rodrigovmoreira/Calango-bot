import api from './api';

// By importing api, the interceptors are registered on the underlying axios instance.
// In tests, api.interceptors object contains the registered interceptors.
describe('API Services', () => {
  beforeEach(() => {
    localStorage.clear();

    // Configurar property window.location.href (sendo getter/setter readonly em JSDOM)
    delete window.location;
    window.location = { href: '', pathname: '/dashboard' };
  });

  describe('Request Interceptor', () => {
    it('deve injetar o token de autorização nos headers quando existir token no localStorage', async () => {
      localStorage.setItem('token', 'fake-jwt-token');

      // Accessing the request interceptor handler correctly using the instance (api)
      const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;

      const config = { headers: {} };
      const newConfig = await requestInterceptor(config);

      expect(newConfig.headers.Authorization).toBe('Bearer fake-jwt-token');
    });

    it('não deve injetar o token de autorização quando não existir token no localStorage', async () => {
      const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;

      const config = { headers: {} };
      const newConfig = await requestInterceptor(config);

      expect(newConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('deve limpar localStorage e redirecionar para /login num erro 401 Unauthorized', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ id: 1 }));

      const errorInterceptor = api.interceptors.response.handlers[0].rejected;

      const mockError = {
        response: {
          status: 401
        }
      };

      try {
        await errorInterceptor(mockError);
      } catch (e) {
        // Interceptor rejeita a promise
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('não deve redirecionar nem limpar se o erro não for 401', async () => {
      localStorage.setItem('token', 'fake-jwt-token');

      const errorInterceptor = api.interceptors.response.handlers[0].rejected;

      const mockError = {
        response: {
          status: 500
        }
      };

      try {
        await errorInterceptor(mockError);
      } catch (e) {
        // Interceptor rejeita a promise
      }

      expect(localStorage.getItem('token')).toBe('fake-jwt-token');
      expect(window.location.href).not.toBe('/login');
    });
  });
});

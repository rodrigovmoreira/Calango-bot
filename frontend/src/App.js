import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import { AppProvider } from './context/AppContext';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import PublicChat from './pages/PublicChat';
import InvitePage from './pages/InvitePage';
import PrivacyPolicy from './pages/PrivacyPolicy';

// URL do Squamata-Login (Identity Provider / SSO).
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';
const APP_SLUG = 'calango-bot';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  // Sem token → devolve o usuário ao portal central de autenticação.
  React.useEffect(() => {
    if (!token) {
      window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}`;
    }
  }, [token]);

  return token ? children : null;
};

const PublicOnlyRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AppProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              } />
              <Route path="/register" element={
                <PublicOnlyRoute>
                  <Navigate to="/login" replace />
                </PublicOnlyRoute>
              } />
              {/* Callback SSO: captura o token retornado pelo Squamata-Login */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/chat/:businessId" element={<PublicChat />} />
              <Route path="/invite/:token" element={
                <PublicOnlyRoute>
                  <InvitePage />
                </PublicOnlyRoute>
              } />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/funnel"
                element={
                  <ProtectedRoute>
                    <Dashboard initialTab={8} />
                  </ProtectedRoute>
                }
              />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
            </Routes>
          </div>
        </Router>
      </AppProvider>
    </ChakraProvider>
  );
}

export default App;

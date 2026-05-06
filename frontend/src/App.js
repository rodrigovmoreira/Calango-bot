import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import { AppProvider } from './context/AppContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import GoogleCallback from './pages/GoogleCallback';
import PublicChat from './pages/PublicChat';
import InvitePage from './pages/InvitePage';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
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
              <Route path="/google-callback" element={<GoogleCallback />} />
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
            </Routes>
          </div>
        </Router>
      </AppProvider>
    </ChakraProvider>
  );
}

export default App;

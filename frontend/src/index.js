import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { HelmetProvider } from 'react-helmet-async';
import theme from './theme';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* O Script precisa ficar ANTES do Provider para evitar "flicker" */}
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <HelmetProvider>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </HelmetProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

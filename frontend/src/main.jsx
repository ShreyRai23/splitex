import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--black)',
            color: '#fff',
            borderRadius: 'var(--r-pill)',
            padding: '12px 24px',
            fontSize: '0.875rem',
            fontWeight: 600,
          },
          success: { iconTheme: { primary: 'var(--lime)', secondary: 'var(--black)' } },
          error: { iconTheme: { primary: 'var(--coral)', secondary: 'white' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);

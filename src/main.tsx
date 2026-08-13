import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@ui/App';
import './styles.css';

// Ponte de verificação automatizada: só existe em desenvolvimento.
if (import.meta.env.DEV) {
  void import('@platform/devBridge').then((m) => m.installDevBridge());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@chasehorse/design-tokens/web.css';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/landing.css';
import './styles/partners.css';
import './styles/registration.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

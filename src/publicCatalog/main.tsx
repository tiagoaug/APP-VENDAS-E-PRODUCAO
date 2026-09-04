import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PublicCatalogApp from './PublicCatalogApp.tsx';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicCatalogApp />
  </StrictMode>,
);

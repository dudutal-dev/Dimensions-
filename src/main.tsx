import '@fontsource-variable/heebo/wght.css';
import '@fontsource-variable/frank-ruhl-libre/wght.css';
import './design/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('חסר אלמנט #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyBands, getBandsEnabled } from './settings';
import { applyTheme, getStoredTheme } from './theme';
import './index.css';

applyTheme(getStoredTheme());
applyBands(getBandsEnabled());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

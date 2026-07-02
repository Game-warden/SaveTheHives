import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Register Service Worker for Offline PWA Support
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Ensuring relative pathing for Vercel deployment compatibility
    navigator.serviceWorker.register('./sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
}
*/

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

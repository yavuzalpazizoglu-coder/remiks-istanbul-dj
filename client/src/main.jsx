import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:40px;color:#ff4444;font-family:monospace;background:#111;min-height:100vh">
      <h2 style="color:#fff">JS Error</h2>
      <pre style="white-space:pre-wrap;font-size:14px;margin-top:20px">${e.message}\n${e.filename}:${e.lineno}</pre>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;font-size:16px;cursor:pointer">Yenile</button>
    </div>`;
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

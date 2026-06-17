import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { msalInstance, ssoEnabled, MS_PENDING_IDTOKEN } from './msal'

const mount = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// --- Microsoft SSO (redirect) ---
// Al volver de Microsoft, la URL trae el token en el hash (.../#code=...).
// Procesamos la respuesta del redirect ANTES de montar React: MSAL lee y limpia
// el hash, así el Router nunca lo ve ni lo borra al navegar. El idToken resultante
// se deja en sessionStorage para que Login lo intercambie por la sesión de la app.
if (ssoEnabled && msalInstance) {
  msalInstance
    .initialize()
    .then(() => msalInstance.handleRedirectPromise())
    .then((response) => {
      if (response && response.idToken) {
        sessionStorage.setItem(MS_PENDING_IDTOKEN, response.idToken);
      }
    })
    .catch((err) => {
      console.error('Error procesando el redirect de Microsoft:', err?.errorCode || err?.message);
    })
    .finally(mount);
} else {
  mount();
}

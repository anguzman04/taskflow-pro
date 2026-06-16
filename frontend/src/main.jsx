import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// --- Microsoft SSO (popup) ---
// Cuando MSAL abre el popup, al autenticar Microsoft lo redirige de vuelta a esta
// misma app (redirectUri = origin) con el token en el hash. Si dejamos que React monte
// y el Router navegue, se pierde el hash antes de que MSAL lo lea y el login falla.
// Por eso: si estamos DENTRO del popup de MSAL, no montamos la app. Dejamos la página
// quieta con el hash para que la ventana principal lo lea y cierre el popup.
const params = window.location.hash + window.location.search;
const isMsalPopup =
  window.opener && window.opener !== window &&
  /[#?&](code|error|state)=/.test(params);

if (!isMsalPopup) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

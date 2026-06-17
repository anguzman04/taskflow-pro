import { PublicClientApplication } from '@azure/msal-browser';

// --- Microsoft Entra ID (SSO) — instancia compartida ---
// Usamos el flujo de REDIRECT (no popup): Microsoft Entra envía cabeceras
// Cross-Origin-Opener-Policy que rompen `window.opener`, lo que hacía que el
// popup nunca devolviera la respuesta a la ventana principal (timed_out).
// Con redirect la propia ventana navega a Microsoft y regresa con el token.
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

export const ssoEnabled = Boolean(AZURE_CLIENT_ID && AZURE_TENANT_ID);

// Clave temporal en sessionStorage donde main.jsx deja el idToken recién
// recibido del redirect para que Login.jsx lo intercambie por la sesión propia.
export const MS_PENDING_IDTOKEN = 'ms_pending_idtoken';

export const msalInstance = ssoEnabled
  ? new PublicClientApplication({
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    })
  : null;

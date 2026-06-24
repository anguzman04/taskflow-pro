# STATUS.md — TaskFlow Pro

_Última actualización: 2026-06-24_

---

## Estado General
El proyecto está activo y en desarrollo continuo. Frontend operativo.
**SSO con Microsoft Entra ID: ✅ FUNCIONANDO end-to-end** (flujo `loginRedirect`; validado Microsoft → token → BD → dashboard). Debug temporal removido y **commiteado**. Ver sección 17.
**BD: ✅ RESUELTO** — era el `DATABASE_URL` con la contraseña sin URL-encodear. Ver sección 18.
**`JWT_SECRET`: ✅ ROTADO** (sesión 2026-06-24) — secreto nuevo + fallback hardcodeado eliminado + guard de arranque. Ver sección 22. ⚠️ Falta aplicar el secreto nuevo en la env var del SO de producción y reiniciar Node.

---

## Completado en sesión 2026-06-03

### 1. Editar tarea desde Gestión de Proyectos
- Estado `editingTaskFromProject` en `Dashboard.tsx` para abrir el modal de tarea desde la vista de proyectos sin cambiar `currentView`.
- Botón `Edit2` en filas de tarea del proyecto expandido (respeta permisos, bloquea Completado/Cancelado).

### 2. Permiso `perm_subtasks_edit_title`
- Nuevo campo en schema Prisma + BD actualizada con `prisma db push`.
- Endpoint `PATCH /api/tasks/subtasks/:id/titulo` en backend.
- Edición inline (Enter/Escape/blur) en UI de subtareas.
- Checkbox "Editar" en sección Subtareas del formulario de usuario.

### 3. Validación de permisos en backend (ambos endpoints de subtarea)
- Helper `checkSubtaskEditAccess(subtaskId, userId)` en `taskController.js`.
- Regla: `is_admin | perm_subtasks_edit_title | created_by_id | responsable` → 403 si ninguna aplica.
- Commit: `c703078`.

---

## Tabla de Permisos de Subtareas (estado actual)

| Campo | UI Label | Controla |
|---|---|---|
| `perm_subtasks_view` | Ver | Ver la sección de subtareas |
| `perm_subtasks_create` | Crear | Agregar nuevas subtareas |
| `perm_subtasks_edit` | Marcar | Marcar como completada/pendiente |
| `perm_subtasks_edit_title` | Editar | Editar título y fecha de compromiso |
| `perm_subtasks_delete` | Eliminar | Eliminar subtareas |

---

## Completado en sesión 2026-06-04

### 4. Filtros en Gestión de Proyectos
- 4 filtros nuevos (antes no tenía ninguno): búsqueda por nombre, estado (Activo/Finalizado/Cancelado), líder y toggle "Solo prioritarios".
- Computed `filteredProjects` aplica los 4 en cadena.
- Barra de filtros entre stats cards y lista. Botón Limpiar condicional. Contador "Mostrando X de Y proyectos".
- Estado vacío diferenciado: sin proyectos en BD vs sin coincidencias con filtros.

### 5. Filtros en Panel de Actividades (refuerzo)
- Nuevos filtros: `taskPriorityFilter` (prioridad) y `taskDateFrom`/`taskDateTo` (rango de fecha compromiso).
- Aplicados en `filteredTasks` junto a los existentes (búsqueda, estado, tab personal/equipo).
- UI: select de prioridad + dos `<input type="date">` con ícono Calendar + botón Limpiar condicional.

### 6. Filtros en Control de Gestión (refuerzo)
- Nuevos filtros: `controlPriorityFilter` y `controlDateFrom`/`controlDateTo`.
- Segunda fila de filtros debajo de la existente (área/responsable/estado) con separador `border-t`.
- Aplicados en `filteredControlTasks`.

### 7. Export Excel — reescritura completa
Función `exportToExcelData(tasks, prefix, filterDesc?)` completamente reescrita. Genera 3 hojas:

**Hoja 1 — Listado de Tareas (23 columnas):**
- Fila 1: título con fecha y quién exportó. Fila 2: filtros aplicados + cantidad de registros.
- Header en fila 4 congelado (`ySplit: 4`) + AutoFilter habilitado (`A4:W4`).
- Filas alternas zebra; filas atrasadas en rojo suave.
- Estado: celda coloreada por valor (verde=Completado, azul=En curso, amarillo=En espera).
- % Avance: número real con formato `0%` + escala de color rojo→verde por rango.
- Fecha compromiso: tipo `Date` Excel real (`DD/MM/YYYY`), no string.
- Columna nueva **"Días de Atraso"**: número positivo rojo si atrasada, "Al día"/"Completada" si no.
- Columna nueva **"Subtareas"**: formato `3/5` o `-`.

**Hoja 2 — Resumen por Área:**
Total / Completadas / En Curso / En Espera / Atrasadas / % Completadas / Avance Promedio + fila TOTALES.

**Hoja 3 — Resumen por Responsable:**
Todos los usuarios con tareas (ordenados por total desc): Total / Completadas / Pendientes / Atrasadas / Avance Promedio.

Call sites actualizados para construir descripción de filtros activos en la fila de metadatos.

### 8. Módulo de Reportes — mejoras visuales
`renderReportsView` completamente reescrita. Estructura en 5 secciones:

**KPIs (5 tarjetas):** Total, Completadas, En Curso (nuevo), Atrasadas (rojo condicional), Avance Global (con mini barra).

**Fila 2:** Volumen por Área (existente) + **Donut de distribución por estado** (nuevo).
- Donut innerRadius con total en el centro, leyenda con conteo y %, tooltip al hover.

**Fila 3 — 2 gráficas nuevas:**
- **Avance por Proyecto**: barras horizontales (`layout="vertical"`) con escala de color rojo→verde, ordenadas desc.
- **Distribución por Prioridad**: barras verticales Total vs Atrasadas por nivel de prioridad.

**Fila 4 — 2 paneles nuevos:**
- **Tabla Salud por Área**: columnas Total / Complet. / En Curso / Atrasadas / Avance Promedio (barra) / Riesgo (semáforo Alto/Medio/Bajo según tasa de atraso `>30% | >0% | 0%`). Ordenada de mayor riesgo.
- **Próximas a Vencer (14 días)**: tareas activas con `fecha_fin` en los próximos 14 días. Etiquetas "Hoy" / Xd con gradiente rojo→amarillo según urgencia. Estado vacío positivo si no hay vencimientos.

**Ranking Empleados**: expandido de Top 5 a Top 10, grilla de 3 columnas, muestra completadas + atrasadas por persona.

- **Commit:** `08533dc` — pusheado a `main`.

---

## Completado en sesión 2026-06-05

### 9. Modal solo lectura para tareas Completadas/Canceladas
- Click en el nombre de una tarea Completada o Cancelada abre el modal de edición en modo **solo lectura** en lugar del modal de detalles.
- Todos los campos (`input`, `select`, `textarea`, checkboxes, selector de ejecutores) quedan deshabilitados con estilo gris.
- Header del modal muestra "Ver Tarea" + badge "Solo lectura" en amber.
- Banner informativo dentro del formulario: _"Esta tarea está completada. Los campos son de solo lectura."_
- Botón "Guardar Cambios" oculto; botón "Cerrar" ocupa todo el ancho.
- El ícono 👁️ en la columna de acciones sigue abriendo el modal de detalles (subtareas, comentarios, evidencias) sin cambios.
- Admins no se ven afectados: siguen abriendo el modal en modo editable.
- Control de Gestión: sin cambio (comportamiento anterior intacto).

### 10. Fix: formulario de proyectos aparecía al editar tarea desde Gestión de Proyectos
- Bug: al abrir el modal de edición de tarea con `editingTaskFromProject = true`, el formulario de proyecto se renderizaba debajo del formulario de tarea porque `currentView === 'projects'` seguía siendo `true`.
- Fix: condición del bloque de proyectos cambiada a `currentView === 'projects' && !editingTaskFromProject`.

### 11. Filtros de fecha por fecha de registro (antes fecha de compromiso)
- En Panel de Actividades: `taskDateFrom` / `taskDateTo` ahora filtran por `fecha_registro` en lugar de `fecha_fin`.
- En Control de Gestión: `controlDateFrom` / `controlDateTo` ídem.
- Tooltips de los inputs de fecha actualizados a "Registro desde / Registro hasta".

### 12. Timeout de inactividad extendido a 30 minutos
- Valor cambiado de `900000` ms (15 min) → `1800000` ms (30 min) en el `useEffect` de detección de actividad en `Dashboard.tsx`.

- **Commit:** `282f6b0` — pusheado a `main`.

---

## Completado en sesión 2026-06-10

### 13. Sidebar colapsable (desktop)
- Nuevo estado `isSidebarCollapsed` + `toggleSidebarCollapsed` en `Dashboard.tsx`, persistido en localStorage (`taskflow_sidebar_collapsed`).
- Botón circular flotante con chevron en el borde derecho del sidebar (`-right-3 top-7`, visible solo en `md:`).
- Modo contraído: ancho `w-64` → `md:w-20`, solo íconos centrados; textos de menú, nombre "TaskFlow Pro" y datos de usuario ocultos con `md:hidden`. Tooltips nativos (`title`) en cada ítem.
- Transición animada 300ms (`transition-all`); el contenido principal se expande automáticamente (layout flex).
- Móvil sin cambios: sigue funcionando como overlay con botón hamburguesa.

- **Commit:** `53acdb5` — pusheado a `main`.

---

## Completado en sesión 2026-06-11

### 14. Evidencias tipo enlace además de archivos (estilo Microsoft Planner)

**Backend:**
- Campo nuevo `type` en modelo `Attachment` (`"file"` | `"link"`, default `"file"`); BD sincronizada con `prisma db push`.
- Endpoint nuevo `POST /api/attachments/:taskId/link` en `attachmentController.js`:
  - Normaliza la URL anteponiendo `https://` si no trae protocolo.
  - Valida hostname con regex (con punto o `localhost`) porque `new URL()` solo es demasiado permisivo y aceptaba URLs basura.
  - Título opcional; si no se envía, se usa la URL como nombre.
  - Deja huella en auditoría: "EVIDENCIA ENLACE AGREGADO".
- `deleteEvidence` (taskController.js): omite el borrado físico en disco cuando `type === 'link'` (guard adicional: el filepath debe empezar con `/api/uploads/`).

**Frontend (pestaña Evidencias del modal de detalles):**
- Pie con dos opciones en grid: "Subir archivo" (igual que antes) y "Agregar enlace" (nuevo).
- Form desplegable animado con URL + nombre para mostrar opcional.
- Tarjetas de enlace: ícono azul `Link2`, nombre clickeable que abre en pestaña nueva, dominio + fecha como subtítulo.
- Permisos: abrir enlace es libre para todos; descargar archivos sigue gateado por `can_download_evidence`; eliminar (ambos tipos) sigue gateado por `can_delete_evidence` o admin.

**Verificación:** probado e2e con script + token JWT firmado contra el servidor real (crear con normalización, URL inválida → 400, listado con `type`, eliminación limpia). Datos de prueba eliminados.

- **Commit:** `015d5f8` — pusheado a `main`.

### 15. Bloc de notas personal "Mis Notas"

**Backend:**
- Modelo nuevo `Note` en Prisma (`id`, `user_id`, `content`, `created_at`, `updated_at`) + relación `notes Note[]` en `User`; BD sincronizada con `prisma db push`.
- Controlador nuevo `noteController.js` con CRUD completo, todo scoped al usuario del token:
  - `GET /api/notes` — solo las notas propias, ordenadas por última edición.
  - `POST /api/notes` — rechaza notas vacías y mayores a 2000 caracteres.
  - `PUT /api/notes/:id` y `DELETE /api/notes/:id` — devuelven 404 si la nota no existe o pertenece a otro usuario.

**Frontend (header, junto a la campana):**
- Ícono `NotebookPen` que abre un panel desplegable estilo notificaciones con tema ámbar.
- Alta rápida con input + botón `+`; edición inline con textarea (Guardar/Cancelar); eliminación con confirmación.
- Cada nota muestra contenido (respeta saltos de línea) y fecha de última edición.
- Exclusión mutua: abrir notas cierra notificaciones y viceversa.
- Las notas viven en BD → el usuario las conserva desde cualquier equipo/navegador.

**Verificación:** probado e2e con dos usuarios distintos — CRUD completo, validación de vacíos, y aislamiento (un usuario no ve ni puede borrar notas ajenas; 404).

- **Commit:** `55b973f` — pusheado a `main`.

---

## En progreso — sesión 2026-06-16

### 16. Login con Microsoft Entra ID (SSO) — Ruta B (OIDC / Azure AD)

**Decisión:** la empresa usa Microsoft 365, así que se eligió SSO vía Entra ID (no LDAP on-premise). Esquema **híbrido**: el login local con contraseña sigue funcionando; Microsoft es una opción adicional. Sin auto-registro: solo entran correos que ya existen en la tabla `users` (el control de acceso sigue en TaskFlow).

**Backend:**
- `authController.microsoftLogin`: valida el `idToken` de Microsoft con `jwks-rsa` (firma RS256, `audience` = client ID, `issuer` = `.../v2.0`), busca el correo (case-insensitive) en `users` y emite el JWT propio de la app. 503 si faltan variables, 403 si el correo no está registrado.
- Ruta pública nueva `POST /api/auth/microsoft` (antes del middleware `verifyToken`).
- Dependencia nueva: `jwks-rsa`.
- Variables de entorno: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`.

**Frontend:**
- `@azure/msal-browser` (`PublicClientApplication`, `loginPopup`).
- Botón "Iniciar sesión con Microsoft" en `Login.jsx`, solo visible si las `VITE_AZURE_*` están definidas (`ssoEnabled`).
- Variables: `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID` (se incrustan en el build; NO son runtime).
- Alert con detalle técnico del error + logs de consola para depuración.

**Estado actual: ✅ RESUELTO a nivel de código en sesión 2026-06-17 — ver sección 17.** (El historial de depuración 2026-06-16 abajo queda como referencia.)

**Sesión de depuración 2026-06-16 (esperando Azure):**
- Código completo; rutas de error probadas (503 sin config, 401 token inválido).
- IDs reales cargados en `.env`; el botón aparece (frontend OK).
- Se resolvieron 3 bugs de frontend en cadena:
  1. `handleRedirectPromise` ejecutándose dentro del popup → `no_token_request_cache_error`. Fix: efecto de montaje protegido para correr solo en la ventana principal (`if (window.opener && window.opener !== window) return`).
  2. Bandera `interaction_in_progress` colgada de intentos previos. Fix: el efecto de montaje la limpia + recuperación en el `catch`.
  3. El popup recargaba la app completa y `<Route path="*" → Navigate to /login>` se llevaba el hash con el token antes de que MSAL lo leyera. Fix en `main.jsx`: si la ventana es el popup de MSAL (`window.opener` + hash con `code/state/error`), **no se monta la app** (`isMsalPopup`), dejando el hash quieto para que MSAL lo lea.
- **Diagnóstico final:** con logging del cliente a archivo (`backend/sso-debug.log` vía endpoint temporal `/api/clientlog`) se confirmó que el flujo llega hasta "abriendo popup" pero **MSAL nunca recibe respuesta** → Microsoft rechaza el redirect dentro del popup.
- ⚠️ **PENDIENTE (en pausa, usuario revisa con admin de Azure):** registrar `http://localhost:5173` en App Registration → Authentication como plataforma **Single-page application (SPA)**, NO "Web", sin barra final. Causa raíz casi segura (`AADSTS50011` / `AADSTS9002326`).
- ⚠️ **DEBUG TEMPORAL en el código (quitar antes del commit final):** `ssoDebug`→archivo, endpoint `POST /api/clientlog`, helper `clog` en `Login.jsx`. Los fixes reales (efecto guardado, recuperación en catch, popup-bail de `main.jsx`) SÍ se conservan.

**Notas de producción:**
- Backend: definir `AZURE_*` como variables de entorno del servidor (Windows/IIS) y reiniciar Node.
- Frontend: las `VITE_AZURE_*` deben existir al hacer `npm run build` (build-time, no runtime). Usar `.env.production` o variables de la máquina de build.
- Azure: registrar la URL HTTPS de producción como redirect URI adicional (localhost es la única excepción a HTTPS).

### Hallazgo de seguridad (corregido en código, acción pendiente del usuario)
- Los archivos `.env` y `backend/.env` **estaban trackeados en git** (exponían `DATABASE_URL` y `JWT_SECRET` en el historial de GitHub).
- Corregido: `git rm --cached` de ambos, `.gitignore` añadidos (raíz, backend, frontend) y plantillas `.env.example` creadas.
- ⚠️ **Acción pendiente del usuario:** rotar la contraseña de PostgreSQL y el `JWT_SECRET`, ya que el historial viejo del repo aún los contiene.

---

## Completado en sesión 2026-06-17

### 17. SSO Microsoft — migración de `loginPopup` a `loginRedirect` (RESUELTO)

**Diagnóstico:** con Azure ya configurado (localhost:5173 registrado como SPA), el popup seguía fallando con `timed_out`. Instrumentando `main.jsx` se capturó la causa raíz: al volver de Microsoft, **`window.opener` llega `null`** (`hasOpener:false`) porque Microsoft Entra envía cabeceras **Cross-Origin-Opener-Policy**. Eso rompía tanto el guard `isMsalPopup` como el polling de MSAL desde la ventana principal → popup estructuralmente inviable.

**Solución (flujo redirect, a prueba de COOP):**
- **`frontend/src/msal.js` (NUEVO):** instancia única `PublicClientApplication` compartida + `ssoEnabled` + constante `MS_PENDING_IDTOKEN`. `redirectUri = window.location.origin`.
- **`frontend/src/main.jsx`:** antes de montar React, ejecuta `initialize()` → `handleRedirectPromise()`; si vuelve un `idToken`, lo deja en `sessionStorage`. Así MSAL consume y limpia el hash ANTES de que el Router toque la URL (evita el bug #3 sin tocar `App.jsx`). Se eliminó el hack `isMsalPopup`.
- **`frontend/src/components/Login.jsx`:** `handleMicrosoftLogin` ahora llama `msalInstance.loginRedirect(...)`. Un `useEffect` al montar lee el `idToken` pendiente de `sessionStorage` y lo intercambia con `POST /api/auth/microsoft` (`exchangeMicrosoftToken`). Se quitó todo lo de `loginPopup`/`getMsalInstance`.

**Verificación e2e (log del backend):** flujo completo OK — redirect procesado con `idToken` → backend **"Token verificado OK"** → correo extraído → JWT emitido → **dashboard**. **UX nueva:** ya no hay popup; la página completa navega a Microsoft y regresa.

**Debug temporal REMOVIDO:** se eliminaron `ssoDebug`/`clientLog`/imports `fs`/`path` y el bloque `peek` (`authController.js`), la ruta `POST /api/clientlog` (`routes/api.js`) y el helper `clog` (`main.jsx`, `Login.jsx`; los `catch` ahora usan `console.error`). Borrados `sso-debug*.log`, `.env.bak`, `.env.bak.preenc`. Los fixes reales (redirect, `msal.js`, `main.jsx`) se conservan. **Commiteado.**

### 18. ✅ RESUELTO: PostgreSQL rechazaba la conexión — `DATABASE_URL` mal codificado

Al validar el SSO el backend NO conectaba a la BD (Prisma: `User was denied access on the database`); el cron fallaba igual cada minuto.

**Causa raíz:** el `DATABASE_URL` de `backend/.env` tenía la contraseña **en crudo** con caracteres especiales (`& @ ) \ { + <`). El `@` interno de la contraseña hacía que el parser de URL cortara ahí y tomara mitad de la contraseña como host → nunca autenticaba bien. Por eso la misma contraseña conectaba pegada directo en PostgreSQL pero fallaba vía la URL.

**Fix:** se URL-encodeó **solo la contraseña** (verificado roundtrip exacto con `decodeURIComponent`). Conexión confirmada con Prisma: `current_user = app_taskflow_user`, `current_database = taskflow_db`. Cron arranca sin errores.

**Nota producción:** en el servidor el `DATABASE_URL` va por **variable de entorno**; si la contraseña trae caracteres especiales, debe ir igualmente URL-encodeada.

---

## Completado en sesión 2026-06-19

### 19. Rediseño jerárquico de la pantalla de Login — Microsoft como opción principal

Se invirtió la jerarquía visual del login (`frontend/src/components/Login.jsx`) para dar prioridad al SSO de Microsoft sobre el acceso local con contraseña.

- **Microsoft = opción principal:** único botón visible al cargar, con estilo destacado (fondo `slate-900`, sombra, ancho completo) y el logo de Microsoft sobre un recuadro blanco para que resalte.
- **Login local = opción secundaria discreta:** oculto por defecto detrás de un enlace pequeño en gris _"Acceder con correo y contraseña"_. Al hacer clic, el formulario (email + contraseña) se despliega con animación (`AnimatePresence` + `height: auto`), separado por el divisor _"o con tu cuenta local"_. Su botón "Iniciar Sesión" quedó con estilo secundario (blanco con borde) para no competir con el de Microsoft.
- **Estado nuevo:** `showLocalLogin` + derivado `localLoginVisible = !ssoEnabled || showLocalLogin`.
- **Fallback:** si el SSO no está habilitado (`ssoEnabled === false`), el formulario local se muestra directamente como antes. Los inputs solo son `required` cuando el form está visible (no bloquean el submit estando colapsados).
- La Pantalla 2 (cambio de contraseña obligatorio) quedó intacta.

**Verificación:** validado visualmente por el usuario.

---

## Completado en sesión 2026-06-22

### 20. Filtros de selección múltiple en todas las vistas

Se convirtieron los filtros categóricos de selección única (`<select>`) a **multi-selección** mediante un componente reutilizable nuevo.

**Componente nuevo `frontend/src/components/MultiSelect.tsx`:**
- Dropdown con checkboxes en un popover. El disparador muestra el ítem si hay uno solo, o _"N seleccionados"_ si hay varios.
- Botón "X" para limpiar la selección + cierre al hacer click afuera (listener `mousedown`).
- API: `options`, `selected: string[]`, `onChange`, `placeholder`, `className` (replica el estilo del `<select>` que reemplaza), `panelAlign`.
- Convención: **array vacío = sin filtro** (muestra todo).

**Filtros migrados a multi-selección (`Dashboard.tsx`):**

| Vista | Filtros |
|---|---|
| Panel de Actividades | Prioridad |
| Control de Gestión | Responsable, Prioridad |
| Reportes | Área, Proyecto |
| Gestión de Proyectos | Líder |

- Estados cambiados de `string`/`'All'` a `string[]` (`[]` inicial).
- Lógica de filtrado pasó de `=== valor` a `arr.length === 0 || arr.includes(...)` (OR: coincide con cualquiera de los seleccionados). En Responsable: la tarea coincide si comparte alguno de los responsables seleccionados.
- Las descripciones de filtros en los **export a Excel** ahora listan los valores con coma (p. ej. _"Prioridad: Alta, Media"_).
- Constante `PRIORITY_OPTIONS` a nivel de módulo, reutilizada en Panel y Control.

**Decisión de alcance:** el filtro de **Estado** y sus **tarjetas KPI** se dejaron como selección única (se evaluó hacerlo multi, pero rompía la metáfora de las tarjetas clicables). Fechas, búsquedas de texto y el toggle "Solo prioritarios" quedan igual.

**Verificación:** `vite build` exitoso (2840 módulos, sin errores) + validado visualmente por el usuario.

---

## Completado en sesión 2026-06-23

### 21. Despliegue en producción — SSO Microsoft funcionando end-to-end

Se publicó la aplicación en producción (`https://taskprojit.atlanticqi.com`, detrás de IIS en Windows) con un **App Registration productivo nuevo** en Azure. El login con Microsoft quedó **funcionando end-to-end** (Microsoft → token → backend → JWT → dashboard).

**Manejo de configuración en producción:** las variables sensibles se gestionan como **variables de entorno del sistema operativo** del servidor (no en archivos `.env`). Variables para Entra ID:

| Variable | Capa | Cuándo se lee |
|---|---|---|
| `AZURE_TENANT_ID` | Backend | runtime (`process.env`) |
| `AZURE_CLIENT_ID` | Backend | runtime (`process.env`) |
| `VITE_AZURE_TENANT_ID` | Frontend | **build-time** (horneada por Vite en el bundle) |
| `VITE_AZURE_CLIENT_ID` | Frontend | **build-time** |

- Solo son **2 valores distintos** (Tenant ID y Client ID del mismo App Registration), repetidos en backend y frontend.
- **No se requiere `AZURE_CLIENT_SECRET`**: el flujo valida el `idToken` con las llaves públicas de Azure (JWKS vía `jwks-rsa`), no con secreto.

**Problemas resueltos durante el despliegue:**
1. **El build seguía usando el `client_id` de desarrollo.** Causa: `frontend/.env` contenía el `VITE_AZURE_CLIENT_ID` de dev y quedaba horneado en el bundle. Recordatorio: cambiar una `VITE_*` exige **recompilar (`npm run build`) y republicar `dist/`** — reiniciar no basta porque el valor va incrustado en el bundle.
2. **`POST /api/auth/microsoft` devolvía 401** aunque el frontend ya usaba el client_id productivo. Causa raíz: **el proceso de Node no se había reiniciado** tras crear las variables del SO, así que `process.env.AZURE_CLIENT_ID`/`AZURE_TENANT_ID` seguían con los valores viejos → el `audience`/`issuer` del token (emitido por el app productivo) no coincidía con lo que validaba el backend → `jwt.verify` lanzaba excepción → 401 (catch en `authController.microsoftLogin`). **Solución: reiniciar Node** para que tomara las variables productivas.

**Regla operativa para producción:**
- Cambiar una variable del SO del **backend** (`AZURE_*`, `JWT_SECRET`, `DATABASE_URL`, etc.) → **reiniciar el proceso de Node** (se leen al arrancar).
- Cambiar una `VITE_*` del **frontend** → **recompilar y republicar** (no basta reiniciar).

**Pendiente de infraestructura en producción (de la lista de checklist, ver notas de despliegue):**
- CORS en `backend/index.js` está fijo a `http://localhost:5173`; revisar para el dominio productivo o confirmar que IIS sirve front+back en el mismo origen.
- El front llama a `/api` por ruta relativa → IIS debe hacer reverse-proxy de `/api` al backend Node y servir el `dist/`.
- Gestor de proceso para Node (iisnode/pm2/nssm) para reinicio automático tras caída o reboot.

---

## Completado en sesión 2026-06-24

### 22. Rotación de `JWT_SECRET` + endurecimiento

Se rotó el `JWT_SECRET` (antes el de ejemplo `taskflow_secret_key_123`, expuesto en el historial de git) y se eliminó el fallback hardcodeado que era el verdadero riesgo.

- **Secreto nuevo:** 64 caracteres aleatorios (`crypto.randomBytes(48).base64url`), cargado en `backend/.env` (gitignoreado, no se commitea).
- **Fallback eliminado:** los 3 puntos activos (`authController.login`, `authController.microsoftLogin`, `verifyToken` en `routes/api.js`) usaban `process.env.JWT_SECRET || 'taskflow_secret_key_123'`. Ahora usan `process.env.JWT_SECRET` a secas: si la env var no carga, ya no se cae silenciosamente al secreto público.
- **Guard de arranque (`index.js`):** si `JWT_SECRET` no está definido, el backend imprime `FATAL` y hace `process.exit(1)` en vez de operar inseguro.
- **Verificación:** syntax check OK en los 3 archivos; guard dispara exit 1 sin la var; roundtrip firma/verifica OK con el secreto nuevo.
- Archivos copia/backup (`authController - copia.js`, `api - copia.js`, `authControllerbk.js`) son código muerto (no se importan) y usan otro default; no se tocaron.

**Efecto esperado:** rotar el secreto **invalida todas las sesiones activas** → los usuarios deben volver a iniciar sesión.

⚠️ **PENDIENTE en producción:** el servidor lee `JWT_SECRET` como **variable de entorno del SO**. Hay que actualizar esa variable con el secreto nuevo y **reiniciar el proceso de Node** (ver regla operativa sesión 2026-06-23: cambiar una env del backend exige reiniciar Node). Mientras no se actualice, producción sigue con el secreto viejo.

---

## Deuda técnica conocida
- Drift de migraciones Prisma: se ha usado `prisma db push` sin generar migraciones formales. Resolver con `prisma migrate resolve` o generando una migración base.
- Backend corre con `node index.js` (sin nodemon en producción). Para dev usar `npm run dev`.

---

## Próximos pasos sugeridos

- ✅ **HECHO (sesión 2026-06-24):** `JWT_SECRET` rotado y fallback hardcodeado eliminado (ver sección 22). ⚠️ Falta aplicar el secreto nuevo en la variable de entorno del SO en **producción** y reiniciar Node.
- ⚠️ **Seguridad (de sesión 2026-06-16):** rotar la contraseña de PostgreSQL expuesta en el historial de git (cuando se rote, re-encodear el `DATABASE_URL`).
- **node_modules trackeado:** `backend/node_modules` está versionado y genera ruido en cada `git status`. Conviene `git rm -r --cached backend/node_modules` y añadirlo al `.gitignore`.
- **Diagrama Gantt** (evaluado): implementar con `gantt-task-react` (MIT, ~100KB) como vista separada en sidebar. Estimado medio día. Blocker: muchas tareas sin `fecha_inicio`; dependencias (`prerequisito`) son texto libre sin FK real.
- Edición inline de título de subtarea en la vista de lista de tareas (actualmente solo en modal de detalles).
- Verificar comportamiento de permisos con usuarios reales no-admin en producción.
- Resolver drift de migraciones Prisma.

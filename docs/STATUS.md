# STATUS.md — TaskFlow Pro

_Última actualización: 2026-06-16 (tarde)_

---

## Estado General
El proyecto está activo y en desarrollo continuo. Backend y frontend operativos. BD PostgreSQL sincronizada.
SSO con Microsoft Entra ID: bugs de frontend resueltos; **en pausa esperando config de Azure (plataforma SPA)** — ver sección 16.

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

**Estado actual (EN PAUSA — esperando Azure):**
- Código completo; rutas de error probadas (503 sin config, 401 token inválido).
- IDs reales cargados en `.env`; el botón aparece (frontend OK).
- **Sesión de depuración 2026-06-16** — se resolvieron 3 bugs de frontend en cadena:
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

## Deuda técnica conocida
- Drift de migraciones Prisma: se ha usado `prisma db push` sin generar migraciones formales. Resolver con `prisma migrate resolve` o generando una migración base.
- Backend corre con `node index.js` (sin nodemon en producción). Para dev usar `npm run dev`.

---

## Próximos pasos sugeridos

- **Diagrama Gantt** (evaluado): implementar con `gantt-task-react` (MIT, ~100KB) como vista separada en sidebar. Estimado medio día. Blocker: muchas tareas sin `fecha_inicio`; dependencias (`prerequisito`) son texto libre sin FK real.
- Edición inline de título de subtarea en la vista de lista de tareas (actualmente solo en modal de detalles).
- Verificar comportamiento de permisos con usuarios reales no-admin en producción.
- Resolver drift de migraciones Prisma.

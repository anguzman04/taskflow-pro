# STATUS.md — TaskFlow Pro

_Última actualización: 2026-06-05_

---

## Estado General
El proyecto está activo y en desarrollo continuo. Backend y frontend operativos. BD PostgreSQL sincronizada.
Último commit pusheado: `282f6b0` — feat: modal solo lectura para tareas completadas, fix bug form proyectos y ajustes de filtros.

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

## Deuda técnica conocida
- Drift de migraciones Prisma: se ha usado `prisma db push` sin generar migraciones formales. Resolver con `prisma migrate resolve` o generando una migración base.
- Backend corre con `node index.js` (sin nodemon en producción). Para dev usar `npm run dev`.

---

## Próximos pasos sugeridos

- **Diagrama Gantt** (evaluado): implementar con `gantt-task-react` (MIT, ~100KB) como vista separada en sidebar. Estimado medio día. Blocker: muchas tareas sin `fecha_inicio`; dependencias (`prerequisito`) son texto libre sin FK real.
- Edición inline de título de subtarea en la vista de lista de tareas (actualmente solo en modal de detalles).
- Verificar comportamiento de permisos con usuarios reales no-admin en producción.
- Resolver drift de migraciones Prisma.

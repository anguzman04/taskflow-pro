# STATUS.md — TaskFlow Pro

_Última actualización: 2026-06-03_

---

## Estado General
El proyecto está activo y en desarrollo continuo. Backend y frontend operativos. BD PostgreSQL sincronizada.

---

## Completado en esta sesión (2026-06-03)

### 1. Editar tarea desde Gestión de Proyectos
- **Problema:** En la vista de proyectos las tareas eran solo de lectura (solo había botón de ver detalles).
- **Solución:** Se agregó estado `editingTaskFromProject` (boolean) en `Dashboard.tsx` para que el modal de tarea se abra desde la vista de proyectos sin cambiar `currentView`.
- **Cambios en `Dashboard.tsx`:**
  - Nuevo estado `editingTaskFromProject`
  - Botón `Edit2` en cada fila de tarea dentro del proyecto expandido (respeta permisos `is_admin` / `can_edit_tasks`, bloquea tareas Completado/Cancelado)
  - Modal: título, `onSubmit`, render del formulario y cierre/backdrop ahora contemplan `editingTaskFromProject`
  - `useEffect` de `selectedResponsibles` incluye `editingTaskFromProject` como dependencia para pre-cargar responsables correctamente
  - `handleTaskSubmit` limpia `editingTaskFromProject` en éxito, error y catch

### 2. Permiso de editar subtareas (`perm_subtasks_edit_title`)
- **Problema:** No existía permiso para editar el título ni la fecha de una subtarea (la fecha era editable por cualquiera sin control).
- **Solución:** Nuevo permiso granular `perm_subtasks_edit_title` integrado en schema, backend y frontend.
- **Cambios:**
  - `backend/prisma/schema.prisma`: nuevo campo `perm_subtasks_edit_title Boolean @default(false)` en modelo `User`
  - BD actualizada con `prisma db push` (sin pérdida de datos)
  - `backend/controllers/taskController.js`: nuevo método `updateSubtaskTitulo` (valida título no vacío)
  - `backend/routes/api.js`: nueva ruta `PATCH /api/tasks/subtasks/:subtaskId/titulo`
  - `frontend/src/components/Dashboard.tsx`:
    - Estado `editingSubtaskTitleId` para edición inline
    - Función `canEditSubtaskContent` (admin | `perm_subtasks_edit_title` | responsable de tarea)
    - Handler `handleUpdateSubtaskTitle` (llama al nuevo endpoint)
    - UI del row de subtarea: icono `Edit2` al hover → input inline con Enter/Escape/blur; fecha protegida por permiso (solo lectura si no tiene acceso)
    - Icono `Lock` solo aparece si el usuario no tiene ningún permiso (toggle, editar ni eliminar)
    - Checkbox "Editar" en sección Subtareas del formulario de usuario (entre Marcar y Eliminar)
    - `handleUserSubmit` incluye `perm_subtasks_edit_title`

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

## Próximos pasos sugeridos

- Verificar comportamiento en producción del nuevo permiso con usuarios no-admin
- Considerar agregar edición de título de subtarea también en la vista de lista de tareas (actualmente solo en el modal de detalles)
- El drift de migraciones Prisma debe resolverse en algún momento con `prisma migrate resolve` o generando una migración base desde el estado actual de la BD

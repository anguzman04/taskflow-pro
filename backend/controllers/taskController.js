const { PrismaClient } = require('@prisma/client');
const notificationService = require('./notificationService');
const prisma = new PrismaClient();

// Estados que representan una tarea "cerrada" (terminada o cancelada).
// Al ENTRAR a uno de ellos (por cualquier vía) se estampa fecha_ejecucion
// (fecha real de cierre) y se deja rastro en AuditLog. Tolerante a variantes
// de mayúsculas/género ("Completado/a", "Finalizado", "Cancelado/a").
const esEstadoCerrado = (estado) => {
  const s = String(estado || '').trim().toLowerCase();
  return s.startsWith('complet') || s.startsWith('finaliz') || s.startsWith('cancel');
};

// Registra en AuditLog el cierre de una tarea. No lanza: si falla, solo loguea.
const registrarCierreAudit = async (taskId, userId, oldEstado, newEstado, fechaCierre) => {
  try {
    await prisma.auditLog.create({
      data: {
        task_id: taskId,
        user_id: userId,
        action: esEstadoCerrado(newEstado) && String(newEstado).toLowerCase().startsWith('cancel')
          ? 'TAREA CANCELADA'
          : 'TAREA COMPLETADA',
        details: `Estado: "${oldEstado || '—'}" → "${newEstado}". Fecha de cierre registrada: ${fechaCierre ? new Date(fechaCierre).toISOString() : '—'}.`,
      },
    });
  } catch (e) {
    console.error('⚠️ No se pudo registrar el cierre en AuditLog (task ' + taskId + '):', e.message);
  }
};

// --- NUEVA FUNCIÓN: INTERCEPTOR DE ZONA HORARIA Y FORMATOS ---
// --- NUEVO INTERCEPTOR: DESTRUCTOR DE ZONAS HORARIAS ---
// --- INTERCEPTOR DE FECHAS EXCEL ---
const procesarFechaSegura = (fechaInput) => {
  if (!fechaInput) return new Date(); // Fallback si la celda está vacía

  // 1. Si Excel manda un número de serie (ej. 46167 que es 25/05/2026)
  if (typeof fechaInput === 'number' || (!isNaN(fechaInput) && String(fechaInput).trim() !== '')) {
    const num = Number(fechaInput);
    if (num < 100000) {
      const excelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
      return new Date(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate(), 12, 0, 0);
    }
  }

  let dateStr = String(fechaInput).trim();

  // 2. Si viene con Zona Horaria (Ej: "2026-05-24T23:00:00.000Z"), la decapitamos
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0]; 
  }

  let year, month, day;

  // 3. Extracción Quirúrgica
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) { 
      year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; day = parseInt(parts[2], 10);
    } else { 
      day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10);
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10);
  } else {
    return new Date();
  }

  // 4. EL ANCLA: Clavamos la fecha a las 12:00 del mediodía local para evitar que brinque de día
  return new Date(year, month, day, 12, 0, 0);
};

const calcularCalificacion = (impacto, viabilidad) => {
  if (!impacto || !viabilidad) return null;
  const valImpacto = parseInt(impacto.split('.')[0]) || 0;
  const valViabilidad = parseInt(viabilidad.split('.')[0]) || 0;
  return (valImpacto + valViabilidad).toString();
};

const actualizarPorcentajeTarea = async (taskId) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { subtasks: true }
    });
    
    if (task && task.subtasks && task.subtasks.length > 0) {
      const total = task.subtasks.length;
      const completadas = task.subtasks.filter(st => st.completada).length;
      const nuevoAvance = Math.round((completadas / total) * 100);
      
      await prisma.task.update({
        where: { id: taskId },
        data: { porcentaje_avance: nuevoAvance }
      });
    }
  } catch (error) {
    console.error("Error al actualizar porcentaje de tarea:", error);
  }
};

const normalizeText = (text) =>
  text ? text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';

const checkSubtaskEditAccess = async (subtaskId, userId) => {
  const subtask = await prisma.subtask.findUnique({ where: { id: parseInt(subtaskId) } });
  if (!subtask) return { allowed: false, error: 'Subtarea no encontrada', status: 404 };

  const [task, user] = await Promise.all([
    prisma.task.findUnique({ where: { id: subtask.task_id } }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);
  if (!task || !user) return { allowed: false, error: 'Recurso no encontrado', status: 404 };

  if (user.is_admin || user.perm_subtasks_edit_title) return { allowed: true, subtask };
  if (task.created_by_id === userId) return { allowed: true, subtask };

  const userName = normalizeText(`${user.nombre || ''} ${user.apellido || ''}`);
  if (normalizeText(task.responsable || '').includes(userName)) return { allowed: true, subtask };

  return { allowed: false, error: 'No tienes permiso para editar esta subtarea', status: 403 };
};

const taskController = {
/*   getAll: async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({ 
        orderBy: { id: 'desc' },
        include: { subtasks: true }
      });
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener las tareas" });
    }
  }, */
  
  
  getAll: async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({ 
        orderBy: { id: 'desc' },
        include: { subtasks: true }
      });

      // Interceptamos y limpiamos el formato ISO de Prisma antes de enviarlo a React
      const formattedTasks = tasks.map(task => ({
        ...task,
        // Tomamos el string '2026-05-11T00:00:00.000Z', lo partimos por la 'T' y enviamos solo '2026-05-11'
        fecha_registro: task.fecha_registro ? new Date(task.fecha_registro).toISOString().split('T')[0] : '',
        fecha_inicio: task.fecha_inicio ? new Date(task.fecha_inicio).toISOString().split('T')[0] : '',
        fecha_fin: task.fecha_fin ? new Date(task.fecha_fin).toISOString().split('T')[0] : '',
        fecha_ejecucion: task.fecha_ejecucion ? new Date(task.fecha_ejecucion).toISOString().split('T')[0] : null
      }));

      res.json(formattedTasks);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener las tareas" });
    }
  },

  create: async (req, res) => {
    try {
      const { 
        actividad, responsable, fecha_registro, fecha_inicio, fecha_fin, 
        prioridad, prerequisito, observacion, porcentaje_avance, estado,
        proyecto_id, area_origen_id, gerente_responsable, tipo, tematica, compromiso_semanal, 
        requiere_inversion, alineacion_estrategica, impacto, viabilidad_tecnica, orden_ejecucion
      } = req.body;

      const calificacion_calculada = calcularCalificacion(impacto, viabilidad_tecnica);
      
      // FORZAMOS A MAYÚSCULAS DE FORMA SEGURA
      const actividadEnMayusculas = actividad ? String(actividad).toUpperCase() : 'ACTIVIDAD SIN NOMBRE';

      const newTask = await prisma.task.create({
        data: {
          actividad: actividadEnMayusculas,
          responsable: responsable || 'Sin responsable',
      /*     fecha_registro: fecha_registro || new Date().toISOString().split('T')[0],
          fecha_inicio: fecha_inicio || '',
          fecha_fin: fecha_fin || '', */
		  // ... dentro de prisma.task.create({ data: { ...
       fecha_registro: fecha_registro ? procesarFechaSegura(fecha_registro) : procesarFechaSegura(new Date()),
          fecha_inicio: fecha_inicio ? procesarFechaSegura(fecha_inicio) : procesarFechaSegura(new Date()),
          fecha_fin: fecha_fin ? procesarFechaSegura(fecha_fin) : procesarFechaSegura(new Date()),

		  
		  
          prioridad: prioridad || '2|Media',
          prerequisito: prerequisito || '',
          observacion: observacion || '',
          porcentaje_avance: parseInt(porcentaje_avance) || 0,
          estado: estado || 'Pendiente',
          created_by_id: req.userId, 
          proyecto_id: proyecto_id ? parseInt(proyecto_id) : null,
          area_origen_id: area_origen_id ? parseInt(area_origen_id) : null,
          gerente_responsable: gerente_responsable || null,
          tipo: tipo || '',
          tematica: tematica || '',
          compromiso_semanal: compromiso_semanal || '',
          requiere_inversion: requiere_inversion === true || requiere_inversion === 'true',
          alineacion_estrategica: alineacion_estrategica || null,
          impacto: impacto || null,
          viabilidad_tecnica: viabilidad_tecnica || null,
          calificacion: calificacion_calculada,
          orden_ejecucion: orden_ejecucion ? parseInt(orden_ejecucion) : null
        }
      });
      
      try {
        const allUsers = await prisma.user.findMany();
        const creator = allUsers.find(u => u.id === req.userId);
        const creatorName = creator ? `${creator.nombre} ${creator.apellido}` : 'Un administrador';
        const prioridadLimpia = prioridad.includes('|') ? prioridad.split('|')[1] : prioridad;
        const responsablesArray = responsable.split(',').map(r => r.trim());

        for (const respName of responsablesArray) {
          const assignedUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === respName);
          if (assignedUser) {
            await notificationService.dispatch({
              userId: assignedUser.id,
              taskId: newTask.id,
              message: `<strong>${creatorName}</strong> te ha asignado una nueva tarea en el sistema.`,
              type: 'INFO',
              forceEmail: true,
              extraData: { userName: assignedUser.nombre, actividad: actividadEnMayusculas, fecha_fin, prioridadLimpia }
            });
          }
        }
      } catch (notifError) {
         console.error("Error procesando notificaciones:", notifError);
      }

      res.status(201).json(newTask);
    } catch (error) {
      res.status(500).json({ error: "Fallo en la base de datos al crear tarea" });
    }
  },

quickUpdate: async (req, res) => {
    try {
      const { id } = req.params;
      let dataToUpdate = req.body;

      // 1. Buscamos la tarea actual y el usuario que hace la petición
      const oldTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!oldTask || !user) return res.status(404).json({ error: "Registro no encontrado" });

      // --- INICIO DE REGLAS DE NEGOCIO (AUDITORÍA) ---
      if (!user.is_admin) {
        // Regla 1: Tareas finalizadas o canceladas no se tocan
        if (oldTask.estado === 'Completado' || oldTask.estado === 'Cancelado') {
           return res.status(403).json({ error: "🚫 AUDITORÍA: Esta tarea ya está finalizada o cancelada y no puede ser editada por esta vía." });
        }

        // Regla 2: No regresar a estado inicial si ya avanzó
        if (oldTask.estado !== 'Pendiente' && oldTask.estado !== 'Planeado') {
           if (dataToUpdate.estado === 'Pendiente' || dataToUpdate.estado === 'Planeado') {
              return res.status(403).json({ error: "🚫 AUDITORÍA: No puedes regresar una tarea en curso al estado inicial." });
           }
        }

        // Regla 3: No reducir el porcentaje de avance
        if (dataToUpdate.porcentaje_avance !== undefined && dataToUpdate.porcentaje_avance < oldTask.porcentaje_avance) {
           return res.status(403).json({ error: `🚫 AUDITORÍA: No puedes reducir un avance ya registrado. El porcentaje actual es ${oldTask.porcentaje_avance}%.` });
        }
      }
      // --- FIN DE REGLAS DE AUDITORÍA ---

      // --- AUTOMATIZACIÓN LÓGICA (Si pasa la auditoría) ---
      
      // Si el usuario cambia el porcentaje manualmente:
      if (dataToUpdate.porcentaje_avance !== undefined) {
        if (dataToUpdate.porcentaje_avance === 100) {
          dataToUpdate.estado = 'Completado';
        } else if (dataToUpdate.porcentaje_avance > 0 && (oldTask.estado === 'Pendiente' || oldTask.estado === 'Planeado')) {
          dataToUpdate.estado = 'En curso';
        }
      }

      // Si el usuario cambia el estado desde el menú:
      if (dataToUpdate.estado !== undefined) {
        if (dataToUpdate.estado === 'Completado') {
          dataToUpdate.porcentaje_avance = 100;
        } else if (dataToUpdate.estado === 'Pendiente' || dataToUpdate.estado === 'Planeado') {
          dataToUpdate.porcentaje_avance = 0;
        }
      }

      // Estampar la fecha real de cierre cuando la tarea entra a un estado cerrado.
      const cerrandoQuick = esEstadoCerrado(dataToUpdate.estado) && !esEstadoCerrado(oldTask.estado);
      if (cerrandoQuick) dataToUpdate.fecha_ejecucion = new Date();

      // 2. Guardamos la actualización
      const updatedTask = await prisma.task.update({
        where: { id: parseInt(id) },
        data: dataToUpdate
      });

      // Rastro del cierre en auditoría.
      if (cerrandoQuick) {
        await registrarCierreAudit(updatedTask.id, req.userId, oldTask.estado, updatedTask.estado, updatedTask.fecha_ejecucion);
      }

      // 3. Disparar notificación si se completó la tarea mediante edición rápida
      if (oldTask.estado !== 'Completado' && updatedTask.estado === 'Completado') {
        try {
          const allUsers = await prisma.user.findMany();
          const normalize = (str) => str.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
          const prioridadLimpia = updatedTask.prioridad?.includes('|') ? updatedTask.prioridad.split('|')[1] : updatedTask.prioridad;
          const extraData = { actividad: updatedTask.actividad, fecha_fin: updatedTask.fecha_fin, prioridadLimpia };

          // Notificar al creador
          await notificationService.dispatch({
            userId: updatedTask.created_by_id,
            taskId: updatedTask.id,
            message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> ha sido completada.`,
            type: 'SUCCESS',
            forceEmail: false
          });

          // Notificar al responsable (si es distinto al creador)
          const responsablesArray = updatedTask.responsable ? updatedTask.responsable.split(',').map(r => r.trim()) : [];
          for (const respName of responsablesArray) {
            const respUser = allUsers.find(u => normalize(`${u.nombre} ${u.apellido}`) === normalize(respName));
            if (respUser && respUser.id !== updatedTask.created_by_id) {
              await notificationService.dispatch({
                userId: respUser.id,
                taskId: updatedTask.id,
                message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> que tienes asignada ha sido marcada como completada.`,
                type: 'SUCCESS',
                forceEmail: false,
                extraData: { userName: respUser.nombre, ...extraData }
              });
            }
          }
        } catch (eventError) {
          console.error("Error disparando evento de quickUpdate:", eventError);
        }
      }

      res.json(updatedTask);
    } catch (error) {
      console.error("Error en actualización rápida:", error);
      res.status(500).json({ error: "Error interno al actualizar la tarea." });
    }
  },



createBulk: async (req, res) => {
    try {
      const { tasks } = req.body;
      if (!tasks || !Array.isArray(tasks)) return res.status(400).json({error: "Formato de datos inválido"});

      // 🟢 EL RADAR: Imprimimos la primera tarea para ver qué carajos envía Excel
      if (tasks.length > 0) {
        console.log("📥 [EXCEL] Payload crudo recibido (Primera tarea):", tasks[0].fecha_inicio, "Tipo:", typeof tasks[0].fecha_inicio);
      }

      const mappedTasks = tasks.map(data => {
        const calificacion_calculada = calcularCalificacion(data.impacto, data.viabilidad_tecnica);
        const actividadEnMayusculas = data.actividad ? String(data.actividad).toUpperCase() : 'ACTIVIDAD IMPORTADA';

        return {
          actividad: actividadEnMayusculas,
          responsable: data.responsable || 'Sin responsable',
          // 👇 APLICAMOS EL INTERCEPTOR DE FECHAS AQUÍ
          fecha_registro: procesarFechaSegura(data.fecha_registro),
          fecha_inicio: procesarFechaSegura(data.fecha_inicio),
          fecha_fin: procesarFechaSegura(data.fecha_fin),
          prioridad: data.prioridad,
          prerequisito: data.prerequisito,
          observacion: data.observacion,
          porcentaje_avance: parseInt(data.porcentaje_avance) || 0,
          estado: data.estado || 'Pendiente',
          created_by_id: req.userId,
          proyecto_id: data.proyecto_id ? parseInt(data.proyecto_id) : null,
          area_origen_id: data.area_origen_id ? parseInt(data.area_origen_id) : null,
          gerente_responsable: data.gerente_responsable,
          tipo: data.tipo,
          tematica: data.tematica,
          compromiso_semanal: data.compromiso_semanal,
          // Blindaje extra para los booleanos en Excel
          requiere_inversion: data.requiere_inversion === true || data.requiere_inversion === 'true' || data.requiere_inversion === 1,
          alineacion_estrategica: data.alineacion_estrategica,
          impacto: data.impacto,
          viabilidad_tecnica: data.viabilidad_tecnica,
          calificacion: calificacion_calculada,
          orden_ejecucion: null 
        };
      });

      const result = await prisma.task.createMany({ data: mappedTasks, skipDuplicates: true });
      res.status(201).json({ message: "Importación exitosa", count: result.count });
    } catch (error) {
      console.error("❌ Error en createBulk:", error);
      res.status(500).json({ error: "Fallo en la base de datos al importar" });
    }
  },






  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const taskId = parseInt(id);
      
      const calificacion_calculada = calcularCalificacion(data.impacto, data.viabilidad_tecnica);
      const oldTask = await prisma.task.findUnique({ where: { id: taskId } });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!oldTask || !user) return res.status(404).json({ error: "Registro no encontrado" });

      // --- BLOQUE DE AUDITORÍA SINCRONIZADO ---
      if (!user.is_admin) {
        // Regla 1: No editar finalizadas/canceladas
        if (oldTask.estado === 'Completado' || oldTask.estado === 'Cancelado') {
           return res.status(403).json({ error: "🚫 AUDITORÍA: Esta tarea ya está finalizada y no puede ser editada. Contacta a un administrador." });
        }

        // Regla 2: No reducir el porcentaje de avance
        const nuevoAvance = parseInt(data.porcentaje_avance) || 0;
        const avanceActual = parseInt(oldTask.porcentaje_avance) || 0;
        if (nuevoAvance < avanceActual) {
           return res.status(403).json({ error: `🚫 AUDITORÍA: No puedes reducir un avance ya registrado. El valor actual es ${avanceActual}%.` });
        }

        // Regla 3: No regresar a estado inicial
        if ((oldTask.estado !== 'Pendiente' && oldTask.estado !== 'Planeado') && 
            (data.estado === 'Pendiente' || data.estado === 'Planeado')) {
           return res.status(403).json({ error: "🚫 AUDITORÍA: No puedes regresar una tarea en curso al estado inicial." });
        }
      }

      // --- AUTOMATIZACIÓN DE ESTADOS ---
      let estadoFinal = data.estado || oldTask.estado;
      let avanceFinal = parseInt(data.porcentaje_avance) || 0;

      if (avanceFinal === 100) {
        estadoFinal = 'Completado';
      } else if (estadoFinal === 'Completado') {
        avanceFinal = 100;
      }

      // ¿La tarea entra a un estado cerrado en esta edición? (para estampar fecha_ejecucion)
      const cerrandoUpdate = esEstadoCerrado(estadoFinal) && !esEstadoCerrado(oldTask.estado);

      const actividadEnMayusculas = data.actividad ? String(data.actividad).toUpperCase() : oldTask.actividad;

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          actividad: actividadEnMayusculas,
          responsable: data.responsable || oldTask.responsable,
      /*     fecha_registro: data.fecha_registro,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.fecha_fin, */
		  
		  // ... dentro de prisma.task.update({ data: { ...
fecha_registro: data.fecha_registro ? procesarFechaSegura(data.fecha_registro) : oldTask.fecha_registro,
          fecha_inicio: data.fecha_inicio ? procesarFechaSegura(data.fecha_inicio) : oldTask.fecha_inicio,
          fecha_fin: data.fecha_fin ? procesarFechaSegura(data.fecha_fin) : oldTask.fecha_fin,
// ...
		  
          prioridad: data.prioridad,
          prerequisito: data.prerequisito,
          observacion: data.observacion,
          porcentaje_avance: avanceFinal,
          estado: estadoFinal,
          fecha_ejecucion: cerrandoUpdate ? new Date() : oldTask.fecha_ejecucion,
          proyecto_id: data.proyecto_id ? parseInt(data.proyecto_id) : null,
          area_origen_id: data.area_origen_id ? parseInt(data.area_origen_id) : null,
          gerente_responsable: data.gerente_responsable,
          tipo: data.tipo,
          tematica: data.tematica,
          compromiso_semanal: data.compromiso_semanal,
          requiere_inversion: data.requiere_inversion === true || data.requiere_inversion === 'true',
          alineacion_estrategica: data.alineacion_estrategica,
          impacto: data.impacto,
          viabilidad_tecnica: data.viabilidad_tecnica,
          calificacion: calificacion_calculada,
          orden_ejecucion: data.orden_ejecucion ? parseInt(data.orden_ejecucion) : null
        }
      });

      // Rastro del cierre en auditoría (Completado o Cancelado).
      if (cerrandoUpdate) {
        await registrarCierreAudit(updatedTask.id, req.userId, oldTask.estado, updatedTask.estado, updatedTask.fecha_ejecucion);
      }

      try {
        if (oldTask.estado !== 'Completado' && updatedTask.estado === 'Completado') {
          const allUsers = await prisma.user.findMany();
          const normalize = (str) => str.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
          const prioridadLimpia = updatedTask.prioridad?.includes('|') ? updatedTask.prioridad.split('|')[1] : updatedTask.prioridad;
          const extraData = { actividad: updatedTask.actividad, fecha_fin: updatedTask.fecha_fin, prioridadLimpia };

          // Notificar al creador
          await notificationService.dispatch({
            userId: updatedTask.created_by_id,
            taskId: updatedTask.id,
            message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> ha sido completada.`,
            type: 'SUCCESS',
            forceEmail: false
          });

          // Notificar al responsable (si es distinto al creador)
          const responsablesArray = updatedTask.responsable ? updatedTask.responsable.split(',').map(r => r.trim()) : [];
          for (const respName of responsablesArray) {
            const respUser = allUsers.find(u => normalize(`${u.nombre} ${u.apellido}`) === normalize(respName));
            if (respUser && respUser.id !== updatedTask.created_by_id) {
              await notificationService.dispatch({
                userId: respUser.id,
                taskId: updatedTask.id,
                message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> que tienes asignada ha sido marcada como completada.`,
                type: 'SUCCESS',
                forceEmail: false,
                extraData: { userName: respUser.nombre, ...extraData }
              });
            }
          }
        }
      } catch (e) { console.error(e); }

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar la tarea" });
    }
  },








  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!task || !user) return res.status(404).json({ error: "Registro no encontrado" });

      const yaInicio = task.estado !== 'Pendiente' || task.porcentaje_avance > 0;
      
      if (yaInicio && !user.is_admin) {
        return res.status(403).json({ 
          error: "🚫 AUDITORÍA: No puedes eliminar una tarea que ya tiene progreso o está completada.\n\n💡 Sugerencia: Si la tarea ya no aplica, edítala y cambia su estado a 'Cancelado' para mantener el historial." 
        });
      }

      await prisma.subtask.deleteMany({ where: { task_id: parseInt(id) } }); 
      await prisma.auditLog.deleteMany({ where: { task_id: parseInt(id) } });
      await prisma.attachment.deleteMany({ where: { task_id: parseInt(id) } });
      await prisma.comment.deleteMany({ where: { task_id: parseInt(id) } });
      await prisma.notification.deleteMany({ where: { task_id: parseInt(id) } });
      await prisma.task.delete({ where: { id: parseInt(id) } });
      
      res.json({ message: "Tarea eliminada exitosamente" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar la tarea" });
    }
  },
  
  
  

 getControlTasks: async (req, res) => {
    try {
      const userId = parseInt(req.query.userId);
      const areaId = req.query.areaId ? parseInt(req.query.areaId) : null;

      // 1. Obtener el supervisor (Solo pedimos a la BD los campos necesarios para ahorrar memoria)
      const supervisor = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { is_admin: true, acceso_supervision: true, areas_autorizadas: true }
      });
      
      if (!supervisor) return res.status(404).json({ error: "Usuario no encontrado" });

      // 2. Determinar las áreas autorizadas
      let areasAutorizadas = [];
      
      if (supervisor.is_admin) {
        // SUPER OPTIMIZACIÓN: Si es admin, tiene derecho a ver TODO. 
        // No necesitamos calcular usuarios, simplemente devolvemos todas las tareas y nos ahorramos consultas.
        const allTasks = await prisma.task.findMany({ 
          orderBy: { id: 'desc' },
          include: { subtasks: true }
        });
        return res.json(allTasks);
      } else if (supervisor.acceso_supervision) {
        // Extraemos el array de áreas permitidas para este supervisor
        areasAutorizadas = supervisor.areas_autorizadas ? supervisor.areas_autorizadas.split(',').map(Number) : [];
      } else {
        return res.status(403).json({ error: "No tienes permisos de supervisión" });
      }

      // Si el frontend solicita filtrar por un área en específico, validamos que tenga permiso
      if (areaId) {
        if (areasAutorizadas.includes(areaId)) {
          areasAutorizadas = [areaId]; // Reducimos el filtro solo a esta área
        } else {
          return res.json([]); // Pide un área no autorizada, devolvemos vacío
        }
      }

      if (areasAutorizadas.length === 0) return res.json([]);

      // 3. Obtener SOLO LOS NOMBRES de los usuarios que pertenecen a las áreas autorizadas
      const validUsers = await prisma.user.findMany({
        where: { area_id: { in: areasAutorizadas } },
        select: { nombre: true, apellido: true }
      });

      if (validUsers.length === 0) return res.json([]); // Si no hay personal en esas áreas, no hay tareas que supervisar

      // 4. Construir las reglas de búsqueda (Operador OR de Prisma)
      // Le decimos: "Busca si el string 'responsable' contiene 'Nombre Apellido'"
      const orConditions = validUsers.map(u => ({
        responsable: { contains: `${u.nombre} ${u.apellido}` }
      }));

      // 5. Ejecutar la búsqueda delegando el 100% del esfuerzo a PostgreSQL
      /* const controlTasks = await prisma.task.findMany({ 
        where: { OR: orConditions },
        orderBy: { id: 'desc' },
        include: { subtasks: true }
      });

      res.json(controlTasks); */
	  
	  // Formateamos las fechas para que el módulo de Control de Gestión las vea limpias
      const formattedControlTasks = controlTasks.map(task => ({
        ...task,
        fecha_registro: task.fecha_registro ? new Date(task.fecha_registro).toISOString().split('T')[0] : '',
        fecha_inicio: task.fecha_inicio ? new Date(task.fecha_inicio).toISOString().split('T')[0] : '',
        fecha_fin: task.fecha_fin ? new Date(task.fecha_fin).toISOString().split('T')[0] : '',
        fecha_ejecucion: task.fecha_ejecucion ? new Date(task.fecha_ejecucion).toISOString().split('T')[0] : null
      }));

      res.json(formattedControlTasks);
	  
	  
	  
    } catch (error) {
      console.error("❌ Error en getControlTasks optimizado:", error);
      res.status(500).json([]);
    }
  },
  
  
  
  
  

  addSubtask: async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, fecha_compromiso } = req.body;
      const last = await prisma.subtask.findFirst({
        where: { task_id: parseInt(id) },
        orderBy: { orden: 'desc' }
      });
      const newSubtask = await prisma.subtask.create({
        data: {
          titulo,
          task_id: parseInt(id),
          fecha_compromiso: fecha_compromiso || null,
          orden: last ? last.orden + 1 : 0
        }
      });
      await actualizarPorcentajeTarea(parseInt(id));
      res.status(201).json(newSubtask);
    } catch (error) {
      res.status(500).json({ error: "Error al crear la subtarea" });
    }
  },

  toggleSubtask: async (req, res) => {
    try {
      const { subtaskId } = req.params;
      const { completada } = req.body;
      const updatedSubtask = await prisma.subtask.update({
        where: { id: parseInt(subtaskId) },
        data: { completada }
      });
      await actualizarPorcentajeTarea(updatedSubtask.task_id);
      res.json(updatedSubtask);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar la subtarea" });
    }
  },

  updateSubtaskFecha: async (req, res) => {
    try {
      const { subtaskId } = req.params;
      const { fecha_compromiso } = req.body;
      const access = await checkSubtaskEditAccess(subtaskId, req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const updated = await prisma.subtask.update({
        where: { id: parseInt(subtaskId) },
        data: { fecha_compromiso: fecha_compromiso || null }
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar la fecha de la subtarea" });
    }
  },

  updateSubtaskTitulo: async (req, res) => {
    try {
      const { subtaskId } = req.params;
      const { titulo } = req.body;
      if (!titulo?.trim()) return res.status(400).json({ error: "El título no puede estar vacío" });
      const access = await checkSubtaskEditAccess(subtaskId, req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const updated = await prisma.subtask.update({
        where: { id: parseInt(subtaskId) },
        data: { titulo: titulo.trim() }
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar el título de la subtarea" });
    }
  },

  reorderSubtasks: async (req, res) => {
    try {
      const items = req.body; // [{ id, orden }]
      await Promise.all(items.map(item =>
        prisma.subtask.update({ where: { id: item.id }, data: { orden: item.orden } })
      ));
      res.json({ message: "Orden actualizado" });
    } catch (error) {
      res.status(500).json({ error: "Error al reordenar las subtareas" });
    }
  },

  deleteSubtask: async (req, res) => {
    try {
      const { subtaskId } = req.params;
      const subtask = await prisma.subtask.findUnique({ where: { id: parseInt(subtaskId) } });
      if (subtask) {
         await prisma.subtask.delete({ where: { id: parseInt(subtaskId) } });
         await actualizarPorcentajeTarea(subtask.task_id);
      }
      res.json({ message: "Subtarea eliminada" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar la subtarea" });
    }
  },
  
  
  
  
deleteEvidence: async (req, res) => {
    const fs = require('fs');
    const path = require('path');

    try {
      const { id } = req.params;
      const evidenceId = parseInt(id);

      // 1. CONTROL DE SEGURIDAD: Verificar el usuario y sus permisos de auditoría
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      if (!user.is_admin && !user.can_delete_evidence) {
        return res.status(403).json({ error: "🚫 AUDITORÍA: No tienes los permisos requeridos para eliminar archivos de evidencia." });
      }

      // 2. BUSCAR EL REGISTRO: Corrección al modelo correcto 'attachment'
      const evidence = await prisma.attachment.findUnique({
        where: { id: evidenceId }
      });

      if (!evidence) {
        return res.status(404).json({ error: "La evidencia ya no existe o ya fue eliminada." });
      }

      // 3. ELIMINACIÓN FÍSICA: solo aplica a archivos subidos; los enlaces no tienen archivo en disco
      if (evidence.type !== 'link' && evidence.filepath && evidence.filepath.startsWith('/api/uploads/')) {
        // Extraemos solo el nombre real del archivo guardado en disco
        const actualFileName = evidence.filepath.replace('/api/uploads/', '');
        // Construimos la ruta absoluta hacia tu carpeta 'uploads' física
        const absolutePath = path.join(__dirname, '../uploads', actualFileName);
        
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath); // Elimina el archivo físico de forma síncrona y segura
          console.log(`🗑️ [Storage] Archivo físico eliminado: ${actualFileName}`);
        } else {
          console.warn(`⚠️ [Storage] Archivo no encontrado en disco, pero se procederá con la eliminación lógica: ${absolutePath}`);
        }
      }

      // 4. ELIMINACIÓN LÓGICA: Borrar el registro de la Base de Datos
      await prisma.attachment.delete({
        where: { id: evidenceId }
      });

      // 5. REGISTRO EN AUDITORÍA (Opcional pero altamente recomendado)
      // Dejamos rastro de quién eliminó el archivo para mantener la trazabilidad
      await prisma.auditLog.create({
        data: {
          task_id: evidence.task_id,
          user_id: user.id,
          action: "EVIDENCIA ELIMINADA",
          details: `Se eliminó permanentemente la evidencia (${evidence.type === 'link' ? 'enlace' : 'archivo adjunto'}): ${evidence.filename}`
        }
      });

      res.json({ message: "Evidencia y archivo físico eliminados con éxito." });
    } catch (error) {
      console.error("❌ Error al eliminar evidencia:", error);
      res.status(500).json({ error: "Error interno del servidor al procesar la eliminación." });
    }
  }, // 👈 FIX 1: Cambiamos el ';' por ',' porque seguimos dentro del objeto taskController

// --- NUEVA FUNCIÓN: BORRADO LÓGICO DESDE CONTROL DE GESTIÓN ---
  eliminarTareaDesdeControl: async (req, res) => {
      try {
          const taskId = parseInt(req.params.id);
          
          // 1. Buscamos el usuario en la BD usando req.userId (como lo hace tu middleware)
          const user = await prisma.user.findUnique({ where: { id: req.userId } });
          
          if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

          // 2. Validación de seguridad
          if (!user.is_admin && user.perm_control_delete !== 1) {
              return res.status(403).json({ 
                  error: 'Acceso denegado. No tienes permisos para eliminar tareas en Control de Gestión.' 
              });
          }

          // 3. Borrado lógico (cancelación). Estampamos fecha de cierre si aún no tenía.
          const prevTask = await prisma.task.findUnique({ where: { id: taskId }, select: { fecha_ejecucion: true } });
          const tareaEliminada = await prisma.task.update({
              where: { id: taskId },
              data: { estado: 'Cancelado', fecha_ejecucion: prevTask?.fecha_ejecucion ?? new Date() }
          });

          // 4. Registro en auditoría
          await prisma.auditLog.create({
              data: {
                  task_id: taskId,
                  user_id: user.id,
                  action: "TAREA ELIMINADA DESDE CONTROL",
                  details: `El usuario removió la tarea del tablero de Control de Gestión.`
              }
          });

          res.status(200).json({ message: 'Tarea removida con éxito.', task: tareaEliminada });

      } catch (error) {
          console.error("❌ Error en BD al eliminar desde control:", error);
          if (error.code === 'P2025') return res.status(404).json({ error: 'La tarea no existe.' });
          res.status(500).json({ error: 'Error interno del servidor.' });
      }
  }

}; // 👈 Esto cierra el objeto taskController

module.exports = taskController;
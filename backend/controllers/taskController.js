const { PrismaClient } = require('@prisma/client');
const notificationService = require('./notificationService'); 
const prisma = new PrismaClient();

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

const taskController = {
  getAll: async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({ 
        orderBy: { id: 'desc' },
        include: { subtasks: true }
      });
      res.json(tasks);
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
          fecha_registro: fecha_registro || new Date().toISOString().split('T')[0],
          fecha_inicio: fecha_inicio || '',
          fecha_fin: fecha_fin || '',
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

      // 2. Guardamos la actualización
      const updatedTask = await prisma.task.update({
        where: { id: parseInt(id) },
        data: dataToUpdate
      });

      // 3. Disparar notificación si se completó la tarea mediante edición rápida
      if (oldTask.estado !== 'Completado' && updatedTask.estado === 'Completado') {
        try {
          await notificationService.dispatch({
            userId: updatedTask.created_by_id,
            taskId: updatedTask.id,
            message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> ha sido completada.`,
            type: 'SUCCESS',
            forceEmail: false 
          });
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

      const mappedTasks = tasks.map(data => {
        const calificacion_calculada = calcularCalificacion(data.impacto, data.viabilidad_tecnica);
        
        // FORZAMOS A MAYÚSCULAS EN LA IMPORTACIÓN MASIVA
        const actividadEnMayusculas = data.actividad ? String(data.actividad).toUpperCase() : 'ACTIVIDAD IMPORTADA';

        return {
          actividad: actividadEnMayusculas,
          responsable: data.responsable || 'Sin responsable',
          fecha_registro: data.fecha_registro,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.fecha_fin,
          prioridad: data.prioridad,
          prerequisito: data.prerequisito,
          observacion: data.observacion,
          porcentaje_avance: data.porcentaje_avance,
          estado: data.estado,
          created_by_id: req.userId,
          proyecto_id: data.proyecto_id,
          area_origen_id: data.area_origen_id,
          gerente_responsable: data.gerente_responsable,
          tipo: data.tipo,
          tematica: data.tematica,
          compromiso_semanal: data.compromiso_semanal,
          requiere_inversion: data.requiere_inversion,
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

      const actividadEnMayusculas = data.actividad ? String(data.actividad).toUpperCase() : oldTask.actividad;

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          actividad: actividadEnMayusculas,
          responsable: data.responsable || oldTask.responsable,
          fecha_registro: data.fecha_registro,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.fecha_fin,
          prioridad: data.prioridad,
          prerequisito: data.prerequisito,
          observacion: data.observacion,
          porcentaje_avance: avanceFinal,
          estado: estadoFinal,
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

      // (Aquí se mantiene tu código de notificaciones que ya tenías...)
      try {
        if (oldTask.estado !== 'Completado' && updatedTask.estado === 'Completado') {
          await notificationService.dispatch({
            userId: updatedTask.created_by_id,
            taskId: updatedTask.id,
            message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> ha sido completada.`,
            type: 'SUCCESS',
            forceEmail: false 
          });
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
      const supervisor = await prisma.user.findUnique({ where: { id: userId } });
      if (!supervisor) return res.status(404).json({ error: "Usuario no encontrado" });

      let areasAutorizadas = [];
      if (supervisor.is_admin) {
        const allAreas = await prisma.area.findMany();
        areasAutorizadas = allAreas.map(a => a.id);
      } else if (supervisor.acceso_supervision) {
        areasAutorizadas = supervisor.areas_autorizadas ? supervisor.areas_autorizadas.split(',').map(Number) : [];
      } else {
        return res.status(403).json({ error: "No tienes permisos de supervisión" });
      }

      const allTasks = await prisma.task.findMany({ 
        orderBy: { id: 'desc' },
        include: { subtasks: true }
      });
      const allUsers = await prisma.user.findMany();

      const controlTasks = allTasks.filter(task => {
        const responsablesArray = task.responsable ? task.responsable.split(',').map(r => r.trim()) : [];
        let isValidForControl = false;
        for (const respName of responsablesArray) {
           const responsableUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === respName);
           const taskAreaId = responsableUser ? responsableUser.area_id : null;
           if (taskAreaId) {
             if (areaId && taskAreaId === areaId && areasAutorizadas.includes(taskAreaId)) {
               isValidForControl = true; break;
             } else if (!areaId && areasAutorizadas.includes(taskAreaId)) {
               isValidForControl = true; break;
             }
           }
        }
        return isValidForControl;
      });
      res.json(controlTasks);
    } catch (error) {
      res.status(500).json([]);
    }
  },

  addSubtask: async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo } = req.body;
      const newSubtask = await prisma.subtask.create({
        data: { titulo, task_id: parseInt(id) }
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
  }
};

module.exports = taskController;
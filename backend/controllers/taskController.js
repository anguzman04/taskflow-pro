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
      
      const calificacion_calculada = calcularCalificacion(data.impacto, data.viabilidad_tecnica);

      const oldTask = await prisma.task.findUnique({ where: { id: parseInt(id) } });
      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      if (!oldTask || !user) return res.status(404).json({ error: "Registro no encontrado" });

      if (!user.is_admin) {
        if (oldTask.estado === 'Completado' || oldTask.estado === 'Cancelado') {
           return res.status(403).json({ error: "🚫 AUDITORÍA: Esta tarea ya está finalizada o cancelada y no puede ser editada. Contacta a un administrador." });
        }
        if (oldTask.estado !== 'Pendiente' && data.estado === 'Pendiente') {
           return res.status(403).json({ error: "🚫 AUDITORÍA: No puedes regresar una tarea en curso al estado 'Pendiente'. Si hubo un error, utiliza el estado 'Cancelado'." });
        }
      }

      // FORZAMOS A MAYÚSCULAS AL EDITAR
      const actividadEnMayusculas = data.actividad ? String(data.actividad).toUpperCase() : 'ACTIVIDAD SIN NOMBRE';

      const updatedTask = await prisma.task.update({
        where: { id: parseInt(id) },
        data: {
          actividad: actividadEnMayusculas,
          responsable: data.responsable || 'Sin responsable',
          fecha_registro: data.fecha_registro || new Date().toISOString().split('T')[0],
          fecha_inicio: data.fecha_inicio || '',
          fecha_fin: data.fecha_fin || '',
          prioridad: data.prioridad || '2|Media',
          prerequisito: data.prerequisito || '',
          observacion: data.observacion || '',
          porcentaje_avance: parseInt(data.porcentaje_avance) || 0,
          estado: data.estado || 'Pendiente',
          proyecto_id: data.proyecto_id ? parseInt(data.proyecto_id) : null,
          area_origen_id: data.area_origen_id ? parseInt(data.area_origen_id) : null,
          gerente_responsable: data.gerente_responsable || null,
          tipo: data.tipo || '',
          tematica: data.tematica || '',
          compromiso_semanal: data.compromiso_semanal || '',
          requiere_inversion: data.requiere_inversion === true || data.requiere_inversion === 'true',
          alineacion_estrategica: data.alineacion_estrategica || null,
          impacto: data.impacto || null,
          viabilidad_tecnica: data.viabilidad_tecnica || null,
          calificacion: calificacion_calculada,
          orden_ejecucion: data.orden_ejecucion ? parseInt(data.orden_ejecucion) : null
        }
      });

      try {
        const allUsers = await prisma.user.findMany();
        
        if (oldTask && oldTask.estado !== 'Completado' && updatedTask.estado === 'Completado') {
          await notificationService.dispatch({
            userId: updatedTask.created_by_id,
            taskId: updatedTask.id,
            message: `¡Excelente! La actividad <strong>"${updatedTask.actividad}"</strong> ha sido completada.`,
            type: 'SUCCESS',
            forceEmail: false 
          });
        }

        if (oldTask && oldTask.responsable !== updatedTask.responsable) {
          const oldResp = oldTask.responsable ? oldTask.responsable.split(',').map(r => r.trim()) : [];
          const newResp = updatedTask.responsable ? updatedTask.responsable.split(',').map(r => r.trim()) : [];
          
          const newlyAssigned = newResp.filter(r => !oldResp.includes(r));
          const prioridadLimpia = updatedTask.prioridad.includes('|') ? updatedTask.prioridad.split('|')[1] : updatedTask.prioridad;

          for (const respName of newlyAssigned) {
            const assignedUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === respName);
            if (assignedUser) {
              await notificationService.dispatch({
                userId: assignedUser.id,
                taskId: updatedTask.id,
                message: `🔔 Se te ha reasignado la actividad: <strong>"${updatedTask.actividad}"</strong>.`,
                type: 'INFO',
                forceEmail: true,
                extraData: { userName: assignedUser.nombre, actividad: updatedTask.actividad, fecha_fin: updatedTask.fecha_fin, prioridadLimpia }
              });
            }
          }
        }
      } catch (eventError) {
        console.error("Error disparando eventos de actualización:", eventError);
      }

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
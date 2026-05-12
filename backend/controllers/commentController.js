const { PrismaClient } = require('@prisma/client');
const notificationService = require('./notificationService'); 
const prisma = new PrismaClient();

const commentController = {
  getByTask: async (req, res) => {
    try {
      const comments = await prisma.comment.findMany({
        where: { task_id: parseInt(req.params.taskId) },
        include: { 
          user: { select: { nombre: true, apellido: true } },
          // 👇 NUEVO: Le decimos a la BD que nos traiga también el título de la subtarea asociada
          subtask: { select: { titulo: true } } 
        },
        orderBy: { created_at: 'asc' }
      });
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener avances" });
    }
  },

  create: async (req, res) => {
    try {
      // 👇 NUEVO: Extraemos el subtask_id del body
      const { task_id, content, subtask_id } = req.body; 
      
      const userId = parseInt(req.userId); 
      
      console.log(`\n--- NUEVO AVANCE DETECTADO ---`);
      console.log(`Usuario ID [${userId}] registrando avance en Tarea ID [${task_id}]`);

      // 1. Guardar el avance
      const newComment = await prisma.comment.create({
        data: {
          task_id: parseInt(task_id),
          user_id: userId, 
          content,
          // 👇 NUEVO: Si llega un subtask_id lo guardamos como número, si no, se guarda como null
          subtask_id: subtask_id ? parseInt(subtask_id) : null 
        },
        include: { 
          user: { select: { nombre: true, apellido: true } },
          // 👇 NUEVO: Devolvemos la subtarea recién vinculada al frontend para que el tag aparezca de inmediato
          subtask: { select: { titulo: true } }
        }
      });

      // --- LÓGICA DE NOTIFICACIONES ---
      try {
        const task = await prisma.task.findUnique({ 
          where: { id: parseInt(task_id) },
          include: { comments: { select: { user_id: true } } } 
        });
        
        if (task) {
          const allUsers = await prisma.user.findMany();
          
          const commenter = allUsers.find(u => u.id === userId);
          const commenterName = commenter ? `${commenter.nombre} ${commenter.apellido}` : 'Un usuario';

          const usersToNotify = new Set();

          usersToNotify.add(task.created_by_id);
          console.log(`[+] Creador añadido a la lista (ID: ${task.created_by_id})`);

          const responsablesArray = task.responsable ? task.responsable.split(',').map(r => r.trim()) : [];
          for (const respName of responsablesArray) {
            const responsableObj = allUsers.find(u => `${u.nombre} ${u.apellido}` === respName);
            if (responsableObj) {
              usersToNotify.add(responsableObj.id);
            }
          }
          console.log(`[+] Ejecutores añadidos.`);

          if (task.comments && task.comments.length > 0) {
            task.comments.forEach(c => usersToNotify.add(c.user_id));
            console.log(`[+] Participantes anteriores añadidos.`);
          }

          console.log(`[=] IDs totales en la lista:`, Array.from(usersToNotify));

          usersToNotify.delete(userId);
          
          console.log(`[=] IDs FINAL a notificar (excluyendo al autor ID ${userId}):`, Array.from(usersToNotify));

          for (const targetUserId of usersToNotify) {
            console.log(`🚀 Despachando campana in-app al Usuario ID: ${targetUserId}`);
            await notificationService.dispatch({
              userId: targetUserId,
              taskId: task.id,
              message: `📢 <strong>${commenterName}</strong> registró un avance en: "${task.actividad}"`,
              type: 'INFO',
              forceEmail: false, 
              extraData: { actividad: task.actividad }
            });
          }
          console.log(`--- FIN PROCESO DE REGISTRO DE AVANCE ---\n`);
        }
      } catch (notifError) {
        console.error("❌ Error interno al procesar notificaciones:", notifError);
      }

      res.status(201).json(newComment);
    } catch (error) {
      console.error("❌ Error general al crear el avance:", error);
      res.status(500).json({ error: "Error interno del servidor al crear el avance" });
    }
  }
};

module.exports = commentController;
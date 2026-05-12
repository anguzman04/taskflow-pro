const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const commentController = {
  getByTask: async (req, res) => {
    try {
      const comments = await prisma.comment.findMany({
        where: { task_id: parseInt(req.params.taskId) },
        include: { user: { select: { nombre: true, apellido: true } } },
        orderBy: { created_at: 'asc' }
      });
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener comentarios" });
    }
  },

  create: async (req, res) => {
    try {
      const { task_id, content } = req.body;
      const newComment = await prisma.comment.create({
        data: {
          task_id: parseInt(task_id),
          user_id: req.userId, // Lo tomaremos del token de seguridad
          content
        },
        include: { user: { select: { nombre: true, apellido: true } } }
      });

      // ¡Magia de Notificaciones! Avisar al creador de la tarea
      const task = await prisma.task.findUnique({ where: { id: parseInt(task_id) } });
      if (task && task.created_by_id !== req.userId) {
         await prisma.notification.create({
           data: {
             user_id: task.created_by_id,
             message: `Nuevo comentario en tu tarea: "${task.actividad}"`
           }
         });
      }

      res.status(201).json(newComment);
    } catch (error) {
      res.status(500).json({ error: "Error al crear comentario" });
    }
  }
};
module.exports = commentController;
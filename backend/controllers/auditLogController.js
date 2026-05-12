const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auditLogController = {
  getByTask: async (req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { task_id: parseInt(req.params.taskId) },
        include: { user: true },
        orderBy: { created_at: 'desc' }
      });

      // Lo formateamos para que el frontend pueda leer el nombre del usuario
      const formattedLogs = logs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details,
        created_at: log.created_at,
        user_name: log.user ? `${log.user.nombre} ${log.user.apellido}` : 'Sistema'
      }));

      res.json(formattedLogs);
    } catch (error) {
      console.error("Error al obtener historial:", error);
      res.json([]); // Si hay error, devolvemos vacío para no romper la pantalla
    }
  }
};

module.exports = auditLogController;
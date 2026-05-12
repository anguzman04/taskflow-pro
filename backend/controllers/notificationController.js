const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const notificationController = {
  getByUser: async (req, res) => {
    try {
      // req.userId viene del token de seguridad
      if (!req.userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const notifications = await prisma.notification.findMany({
        where: { user_id: req.userId },
        orderBy: { created_at: 'desc' },
        take: 20 // Solo traemos las últimas 20 para no saturar
      });
      
      // Siempre devolvemos un arreglo (array), incluso si está vacío
      res.json(notifications || []);
    } catch (error) {
      console.error("💥 Error al obtener notificaciones:", error);
      // Enviar un array vacío en caso de error evita que React explote
      res.status(500).json([]); 
    }
  },

  markAsRead: async (req, res) => {
    try {
      await prisma.notification.updateMany({
        where: { user_id: req.userId, read: false },
        data: { read: true }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("💥 Error al marcar notificaciones como leídas:", error);
      res.status(500).json({ error: "Error interno" });
    }
  }
};

module.exports = notificationController;
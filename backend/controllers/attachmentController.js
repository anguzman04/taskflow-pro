const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crea la carpeta 'uploads' si no existe
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')); // Evita espacios en nombres
  }
});

const upload = multer({ storage: storage });

const attachmentController = {
  getByTask: async (req, res) => {
    try {
      const attachments = await prisma.attachment.findMany({
        where: { task_id: parseInt(req.params.taskId) },
        orderBy: { uploaded_at: 'desc' }
      });
      res.json(attachments);
    } catch (error) {
      console.error("Error al obtener evidencias:", error);
      res.json([]); 
    }
  },

  uploadMiddleware: upload.single('file'), // 'file' es el nombre que envía el frontend

  uploadFile: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });
      
      const taskId = parseInt(req.params.taskId);
      
      // 1. Guardar en Base de Datos
      const newAttachment = await prisma.attachment.create({
        data: {
          task_id: taskId,
          filename: req.file.originalname,
          // --- CORRECCIÓN: Guardamos la ruta con el camuflaje /api/uploads ---
          filepath: `/api/uploads/${req.file.filename}`
        }
      });

      // 2. Dejar huella en el Historial
      await prisma.auditLog.create({
        data: {
          task_id: taskId,
          user_id: req.userId,
          action: "EVIDENCIA SUBIDA",
          details: `Se adjuntó el archivo: ${req.file.originalname}`
        }
      });

      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Error al subir archivo:", error);
      res.status(500).json({ error: "Error interno al subir evidencia" });
    }
  }
};

module.exports = attachmentController;
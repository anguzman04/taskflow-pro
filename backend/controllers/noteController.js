const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Bloc de notas personal: cada usuario solo ve y gestiona sus propias notas
const noteController = {
  getMine: async (req, res) => {
    try {
      const notes = await prisma.note.findMany({
        where: { user_id: req.userId },
        orderBy: { updated_at: 'desc' }
      });
      res.json(notes);
    } catch (error) {
      console.error("Error al obtener notas:", error);
      res.json([]);
    }
  },

  create: async (req, res) => {
    try {
      const content = (req.body.content || '').trim();
      if (!content) return res.status(400).json({ error: "La nota no puede estar vacía" });
      if (content.length > 2000) return res.status(400).json({ error: "La nota no puede superar los 2000 caracteres" });

      const note = await prisma.note.create({
        data: { user_id: req.userId, content }
      });
      res.status(201).json(note);
    } catch (error) {
      console.error("Error al crear nota:", error);
      res.status(500).json({ error: "Error interno al crear la nota" });
    }
  },

  update: async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      const content = (req.body.content || '').trim();
      if (!content) return res.status(400).json({ error: "La nota no puede estar vacía" });
      if (content.length > 2000) return res.status(400).json({ error: "La nota no puede superar los 2000 caracteres" });

      const existing = await prisma.note.findUnique({ where: { id: noteId } });
      if (!existing || existing.user_id !== req.userId) {
        return res.status(404).json({ error: "Nota no encontrada" });
      }

      const note = await prisma.note.update({
        where: { id: noteId },
        data: { content }
      });
      res.json(note);
    } catch (error) {
      console.error("Error al actualizar nota:", error);
      res.status(500).json({ error: "Error interno al actualizar la nota" });
    }
  },

  delete: async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);

      const existing = await prisma.note.findUnique({ where: { id: noteId } });
      if (!existing || existing.user_id !== req.userId) {
        return res.status(404).json({ error: "Nota no encontrada" });
      }

      await prisma.note.delete({ where: { id: noteId } });
      res.json({ message: "Nota eliminada" });
    } catch (error) {
      console.error("Error al eliminar nota:", error);
      res.status(500).json({ error: "Error interno al eliminar la nota" });
    }
  }
};

module.exports = noteController;

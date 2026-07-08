const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Verifica que el usuario tenga acceso al módulo (admin o permiso explícito).
const checkAccess = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, status: 401, error: 'Usuario no encontrado' };
  if (user.is_admin || user.perm_change_control) return { allowed: true };
  return { allowed: false, status: 403, error: 'No autorizado' };
};

const personController = {
  // Agenda de personas para diligenciar los formularios de control de cambios.
  getAll: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const persons = await prisma.person.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
      });
      res.json(persons);
    } catch (error) {
      console.error('Error al obtener personas:', error);
      res.status(500).json({ error: 'Error al obtener las personas' });
    }
  },

  create: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { nombre, rol, telefono, email } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
      const person = await prisma.person.create({
        data: {
          nombre: nombre.trim(),
          rol: rol?.trim() || null,
          telefono: telefono?.trim() || null,
          email: email?.trim() || null,
        },
      });
      res.status(201).json(person);
    } catch (error) {
      console.error('Error al crear persona:', error);
      res.status(500).json({ error: 'Error al crear la persona' });
    }
  },

  update: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { id } = req.params;
      const { nombre, rol, telefono, email } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
      const person = await prisma.person.update({
        where: { id: parseInt(id) },
        data: {
          nombre: nombre.trim(),
          rol: rol?.trim() || null,
          telefono: telefono?.trim() || null,
          email: email?.trim() || null,
        },
      });
      res.json(person);
    } catch (error) {
      console.error('Error al actualizar persona:', error);
      res.status(500).json({ error: 'Error al actualizar la persona' });
    }
  },

  // Borrado lógico: no se elimina físicamente para no romper documentos
  // que ya guardaron un snapshot de la persona.
  delete: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { id } = req.params;
      await prisma.person.update({ where: { id: parseInt(id) }, data: { activo: false } });
      res.json({ message: 'Persona eliminada de la agenda' });
    } catch (error) {
      console.error('Error al eliminar persona:', error);
      res.status(500).json({ error: 'Error al eliminar la persona' });
    }
  },
};

module.exports = personController;

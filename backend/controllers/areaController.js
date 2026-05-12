const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const areaController = {
  getAll: async (req, res) => {
    try {
      const areas = await prisma.area.findMany({
        include: { jefe: true } // Traemos los datos del jefe
      });
      // Adaptamos el formato para el frontend
      const formattedAreas = areas.map(a => ({
        ...a,
        jefe_nombre: a.jefe ? `${a.jefe.nombre} ${a.jefe.apellido}` : null
      }));
      res.json(formattedAreas);
    } catch (error) {
      res.status(500).json({ error: "Error al cargar las áreas" });
    }
  },

  create: async (req, res) => {
    try {
      const { nombre, descripcion, jefe_id, parent_area_id } = req.body;
      const newArea = await prisma.area.create({
        data: {
          nombre,
          descripcion,
          jefe_id: jefe_id ? parseInt(jefe_id) : null,
          parent_area_id: parent_area_id ? parseInt(parent_area_id) : null
        }
      });
      res.status(201).json(newArea);
    } catch (error) {
      res.status(500).json({ error: "Error al crear el área" });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, descripcion, jefe_id, parent_area_id } = req.body;
      const updatedArea = await prisma.area.update({
        where: { id: parseInt(id) },
        data: {
          nombre,
          descripcion,
          jefe_id: jefe_id ? parseInt(jefe_id) : null,
          parent_area_id: parent_area_id ? parseInt(parent_area_id) : null
        }
      });
      res.json(updatedArea);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar el área" });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.area.delete({ where: { id: parseInt(id) } });
      res.json({ message: "Área eliminada" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar el área (Verifique que no tenga usuarios asignados)" });
    }
  }
};

module.exports = areaController;
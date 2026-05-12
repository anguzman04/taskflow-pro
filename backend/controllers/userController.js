const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Traductor Mágico: Convierte 1 y 0 a true y false (¡Esto también procesará 'debe_cambiar_password' automáticamente!)
const parseBooleans = (data) => {
  const parsed = { ...data };
  for (const key in parsed) {
    if (parsed[key] === 1) parsed[key] = true;
    if (parsed[key] === 0) parsed[key] = false;
  }
  return parsed;
};

const userController = {
  getAll: async (req, res) => {
    try {
      const users = await prisma.user.findMany({ include: { area: true } });
      const formattedUsers = users.map(u => ({
        ...u,
        area_nombre: u.area ? u.area.nombre : null,
        password: "" 
      }));
      res.json(formattedUsers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  },

  create: async (req, res) => {
    try {
      const { password, area_id, ...userData } = req.body;
      
      // Aplicamos la traducción antes de guardar
      const parsedData = parseBooleans(userData);
      const hashedPassword = await bcrypt.hash(password || "taskflow123", 10);
      
      const newUser = await prisma.user.create({
        data: {
          ...parsedData,
          password: hashedPassword,
          area_id: area_id ? parseInt(area_id) : null
        }
      });
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Fallo al crear usuario:", error);
      res.status(500).json({ error: "Error interno al crear el usuario" });
    }
  },
  
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { password, area_id, email, ...userData } = req.body;
      const parsedData = parseBooleans(userData);
      
      const updateData = {
        ...parsedData,
        area_id: area_id ? parseInt(area_id) : null,
        email
      };

      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id: parseInt(id) },
        data: updateData
      });
      res.json(updatedUser);
    } 
	catch (error) {
      // 👇 Añadimos estos console.error para ver exactamente qué le duele a Prisma
      console.error("🔴 ERROR DETALLADO EN PRISMA:", error);
      res.status(500).json({ 
        error: "Error al actualizar el usuario", 
        detalles: error.message 
      });
}
/* 	catch (error) {
      
	  res.status(500).json({ error: "Error al actualizar el usuario" });
    } */
  },
  
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.user.delete({ where: { id: parseInt(id) } });
      res.json({ message: "Usuario eliminado con éxito" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar el usuario" });
    }
  }
};

module.exports = userController;
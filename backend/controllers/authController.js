const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { area: true }
      });

      if (!user) {
        return res.status(401).json({ error: "Usuario no encontrado" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }

      if (user.debe_cambiar_password) {
        return res.status(403).json({ 
          requiere_cambio: true, 
          email: user.email,
          mensaje: "Debes cambiar tu contraseña temporal" 
        });
      }

      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET || 'taskflow_secret_key_123',
        { expiresIn: '8h' }
      );

      const formattedUser = {
        ...user,
        area_nombre: user.area ? user.area.nombre : null,
      };
      delete formattedUser.password; 

      res.json({ token, user: formattedUser });

    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ error: "Error interno del servidor al iniciar sesión" });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { email, currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) return res.status(401).json({ error: "La contraseña actual es incorrecta" });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // --- CORRECCIÓN DE SEGURIDAD ---
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          debe_cambiar_password: false // Apaga la bandera obligatoriamente
        }
      });
      console.log(`[Seguridad] El usuario ${email} cambió su contraseña. Flag apagado.`);

      res.json({ message: "Contraseña actualizada exitosamente. Por favor, inicia sesión de nuevo." });

    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      res.status(500).json({ error: "Error interno al cambiar la contraseña" });
    }
  },

  me: async (req, res) => {
    res.json({ message: "Sesión activa" });
  }
};

module.exports = authController;
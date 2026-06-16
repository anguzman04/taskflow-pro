const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const prisma = new PrismaClient();

// Cliente JWKS para validar tokens de Microsoft Entra ID (se crea una sola vez)
let msJwksClient = null;
const getMicrosoftSigningKey = (header, callback) => {
  if (!msJwksClient) {
    msJwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true
    });
  }
  msJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
};

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

  // Login con Microsoft Entra ID (Azure AD): valida el idToken emitido por Microsoft
  // y, si el correo existe en TaskFlow, emite el JWT propio de la aplicación.
  microsoftLogin: async (req, res) => {
    try {
      if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID) {
        return res.status(503).json({ error: "El inicio de sesión con Microsoft no está configurado en el servidor" });
      }

      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ error: "Falta el token de Microsoft" });

      const claims = await new Promise((resolve, reject) => {
        jwt.verify(idToken, getMicrosoftSigningKey, {
          algorithms: ['RS256'],
          audience: process.env.AZURE_CLIENT_ID,
          issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`
        }, (err, decoded) => err ? reject(err) : resolve(decoded));
      });

      const msEmail = String(claims.preferred_username || claims.email || '').toLowerCase().trim();
      if (!msEmail) return res.status(400).json({ error: "La cuenta de Microsoft no reporta un correo válido" });

      const user = await prisma.user.findFirst({
        where: { email: { equals: msEmail, mode: 'insensitive' } },
        include: { area: true }
      });

      if (!user) {
        console.warn(`[SSO] Intento de login Microsoft con cuenta no registrada: ${msEmail}`);
        return res.status(403).json({ error: `La cuenta ${msEmail} no está registrada en TaskFlow Pro. Contacta al administrador.` });
      }

      // Los usuarios que entran por Microsoft no pasan por el cambio de contraseña local:
      // su identidad ya fue verificada por Entra ID (incluye MFA si la empresa lo exige).
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

      console.log(`[SSO] Login Microsoft exitoso: ${msEmail}`);
      res.json({ token, user: formattedUser });

    } catch (error) {
      console.error("Error en login Microsoft:", error.message);
      res.status(401).json({ error: "No se pudo validar la sesión de Microsoft. Intenta de nuevo." });
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
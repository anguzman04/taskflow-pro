const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Gestionar solicitudes (listar/aprobar/rechazar) requiere admin o permiso de crear usuarios.
const checkAdmin = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, status: 401, error: 'Usuario no encontrado' };
  if (user.is_admin || user.perm_users_create) return { allowed: true, user };
  return { allowed: false, status: 403, error: 'No autorizado' };
};

const normEmail = (e) => String(e || '').toLowerCase().trim();

const accessRequestController = {
  // ---------- PÚBLICO: enviar una solicitud (formulario del login) ----------
  submit: async (req, res) => {
    try {
      const { nombre, email, cargo, area, justificacion } = req.body;
      const mail = normEmail(email);
      if (!nombre?.trim() || !mail) return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return res.status(400).json({ error: 'Correo no válido' });

      // ¿Ya es usuario?
      const existingUser = await prisma.user.findFirst({ where: { email: { equals: mail, mode: 'insensitive' } } });
      if (existingUser) return res.status(409).json({ error: 'Ese correo ya tiene una cuenta. Inicia sesión o contacta al administrador.' });

      // ¿Ya hay una solicitud pendiente? (evita duplicados)
      const pending = await prisma.accessRequest.findFirst({ where: { email: { equals: mail, mode: 'insensitive' }, estado: 'pendiente' } });
      if (pending) return res.status(200).json({ ok: true, message: 'Ya existe una solicitud pendiente para ese correo. El administrador la revisará.' });

      await prisma.accessRequest.create({
        data: {
          nombre: nombre.trim(), email: mail,
          cargo: cargo?.trim() || null, area: area?.trim() || null, justificacion: justificacion?.trim() || null,
          origen: 'manual',
        }
      });
      res.status(201).json({ ok: true, message: 'Tu solicitud de acceso fue enviada al administrador.' });
    } catch (e) { console.error('Error submit access request:', e); res.status(500).json({ error: 'Error al enviar la solicitud' }); }
  },

  // ---------- ADMIN: listar solicitudes ----------
  list: async (req, res) => {
    try {
      const access = await checkAdmin(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const estado = req.query.estado; // opcional: pendiente|aprobada|rechazada
      const where = estado ? { estado } : {};
      const items = await prisma.accessRequest.findMany({ where, orderBy: { created_at: 'desc' } });
      res.json(items);
    } catch (e) { console.error('Error list access requests:', e); res.status(500).json({ error: 'Error al listar solicitudes' }); }
  },

  // ---------- ADMIN: aprobar (crea el usuario SIN permisos) ----------
  approve: async (req, res) => {
    try {
      const access = await checkAdmin(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const reqId = parseInt(req.params.id);
      const solicitud = await prisma.accessRequest.findUnique({ where: { id: reqId } });
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
      if (solicitud.estado !== 'pendiente') return res.status(409).json({ error: 'La solicitud ya fue resuelta' });

      const mail = normEmail(solicitud.email);
      const yaExiste = await prisma.user.findFirst({ where: { email: { equals: mail, mode: 'insensitive' } } });
      if (yaExiste) {
        // El usuario ya existe (p. ej. creado a mano entre tanto): solo cerramos la solicitud.
        await prisma.accessRequest.update({ where: { id: reqId }, data: { estado: 'aprobada', resolved_at: new Date(), resolved_by_id: access.user.id } });
        return res.json({ ok: true, message: 'El usuario ya existía; la solicitud se marcó como aprobada.', user_id: yaExiste.id });
      }

      // Nombre completo -> nombre + apellido
      const parts = String(solicitud.nombre || '').trim().split(/\s+/);
      const nombre = parts[0] || 'Usuario';
      const apellido = parts.slice(1).join(' ') || '-';
      // Contraseña inicial (los de origen SSO entran por Microsoft; los manuales deben cambiarla).
      const hashed = await bcrypt.hash('taskflow123', 10);

      const nuevo = await prisma.user.create({
        data: {
          nombre, apellido,
          cargo: solicitud.cargo?.trim() || '-',
          email: mail,
          password: hashed,
          debe_cambiar_password: solicitud.origen === 'manual',
          is_admin: false,
          // Sin permisos: todos los perm_* quedan en su default (false). El admin los asigna luego.
        }
      });

      await prisma.accessRequest.update({ where: { id: reqId }, data: { estado: 'aprobada', resolved_at: new Date(), resolved_by_id: access.user.id } });
      res.json({ ok: true, message: 'Solicitud aprobada y usuario creado (sin permisos). Asígnalos en Gestión de Usuarios.', user_id: nuevo.id });
    } catch (e) { console.error('Error approve access request:', e); res.status(500).json({ error: 'Error al aprobar la solicitud' }); }
  },

  // ---------- ADMIN: rechazar ----------
  reject: async (req, res) => {
    try {
      const access = await checkAdmin(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const reqId = parseInt(req.params.id);
      const solicitud = await prisma.accessRequest.findUnique({ where: { id: reqId } });
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
      if (solicitud.estado !== 'pendiente') return res.status(409).json({ error: 'La solicitud ya fue resuelta' });
      await prisma.accessRequest.update({ where: { id: reqId }, data: { estado: 'rechazada', resolved_at: new Date(), resolved_by_id: access.user.id } });
      res.json({ ok: true, message: 'Solicitud rechazada' });
    } catch (e) { console.error('Error reject access request:', e); res.status(500).json({ error: 'Error al rechazar la solicitud' }); }
  },

  // Helper usado por el login SSO: registra una solicitud pendiente para un correo no registrado.
  ensurePendingFromSso: async (nombre, email) => {
    const mail = normEmail(email);
    const pending = await prisma.accessRequest.findFirst({ where: { email: { equals: mail, mode: 'insensitive' }, estado: 'pendiente' } });
    if (pending) return pending;
    return prisma.accessRequest.create({ data: { nombre: nombre?.trim() || mail, email: mail, origen: 'sso' } });
  },
};

module.exports = accessRequestController;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow_super_secret_key';

const authController = {
    // 1. LOGIN
    login: async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await prisma.user.findUnique({ where: { email }, include: { area: true } });
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ error: "Credenciales inválidas" });
            }
            const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });
            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword, token });
        } catch (error) { res.status(500).json({ error: "Error en el login" }); }
    },

    // 2. LOGOUT (Añadido para evitar error de undefined)
    logout: (req, res) => {
        res.json({ message: "Sesión cerrada con éxito" });
    },

    // 3. PERFIL Y LISTADO
    me: async (req, res) => {
        try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { area: true } });
            const { password: _, ...u } = user;
            res.json(u);
        } catch (error) { res.status(500).json({ error: "Error al obtener perfil" }); }
    },

    getUsers: async (req, res) => {
        try {
            const users = await prisma.user.findMany({ include: { area: true }, orderBy: { nombre: 'asc' } });
            res.json(users.map(({ password, ...u }) => u));
        } catch (error) { res.status(500).json({ error: "Error al listar usuarios" }); }
    },

    // 4. CRUD DE USUARIOS (Incluyendo deleteUser que faltaba)
    createUser: async (req, res) => {
        try {
            const hashedPassword = bcrypt.hashSync(req.body.password || "taskflow123", 10);
            const newUser = await prisma.user.create({ data: { ...req.body, password: hashedPassword } });
            const { password: _, ...u } = newUser;
            res.status(201).json(u);
        } catch (error) { res.status(500).json({ error: "Error al crear usuario" }); }
    },

    updateUser: async (req, res) => {
        try {
            const data = { ...req.body };
            if (data.password) data.password = bcrypt.hashSync(data.password, 10);
            const updated = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data });
            const { password: _, ...u } = updated;
            res.json(u);
        } catch (error) { res.status(500).json({ error: "Error al actualizar" }); }
    },

    deleteUser: async (req, res) => {
        try {
            await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
            res.status(204).send();
        } catch (error) { res.status(500).json({ error: "Error al eliminar usuario" }); }
    },

    // 5. NOTIFICACIONES (Añadido markNotificationRead que faltaba)
    getNotifications: async (req, res) => {
        try {
            const notifications = await prisma.notification.findMany({ where: { user_id: req.user.id }, orderBy: { created_at: 'desc' } });
            res.json(notifications);
        } catch (error) { res.status(500).json({ error: "Error al obtener notificaciones" }); }
    },

    markNotificationRead: async (req, res) => {
        try {
            await prisma.notification.update({ where: { id: parseInt(req.params.id) }, data: { leida: true } });
            res.json({ message: "Notificación leída" });
        } catch (error) { res.status(500).json({ error: "Error al marcar como leída" }); }
    }
};

module.exports = authController;
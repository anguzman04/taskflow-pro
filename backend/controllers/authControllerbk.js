// controllers/authController.js
//const bcrypt = require('bcryptjs'); // Asegúrate de que termine en 'js'
/* const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Solo esta línea para bcrypt

// ... el resto del código

//const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'taskflow_super_secret_key';

const authController = {
    // 1. LOGIN CON GENERACIÓN DE JWT
    login: async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await prisma.user.findUnique({ 
                where: { email },
                include: { area: true }
            });

            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ error: "Credenciales inválidas" });
            }

            // Generar Token JWT (Válido por 24h)
            const token = jwt.sign(
                { id: user.id, email: user.email, is_admin: user.is_admin },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            const { password: _, ...userWithoutPassword } = user;
            
            res.json({
                user: userWithoutPassword,
                token: token
            });
        } catch (error) {
            res.status(500).json({ error: "Error en el servidor durante el login" });
        }
    },

    // 2. OBTENER PERFIL ACTUAL (Verificación de Token)
    me: async (req, res) => {
        // req.user viene del middleware de protección que definiremos en routes/api.js
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { area: true }
            });
            const { password: _, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
        } catch (error) {
            res.status(500).json({ error: "Error al obtener datos del usuario" });
        }
    },

    // 3. GESTIÓN DE USUARIOS (CRUD)
    getUsers: async (req, res) => {
        try {
            const users = await prisma.user.findMany({
                include: { area: true },
                orderBy: { nombre: 'asc' }
            });
            res.json(users.map(({ password, ...u }) => u));
        } catch (error) {
            res.status(500).json({ error: "Error al listar usuarios" });
        }
    },

    createUser: async (req, res) => {
        const data = req.body;
        try {
            const hashedPassword = bcrypt.hashSync(data.password || "taskflow123", 10);
            const newUser = await prisma.user.create({
                data: {
                    ...data,
                    password: hashedPassword,
                    // Asegurar que los booleanos se guarden correctamente
                    is_admin: Boolean(data.is_admin),
                    can_create_tasks: Boolean(data.can_create_tasks),
                    can_edit_tasks: Boolean(data.can_edit_tasks),
                    can_delete_tasks: Boolean(data.can_delete_tasks),
                    acceso_supervision: Boolean(data.acceso_supervision)
                }
            });
            const { password: _, ...userWithoutPassword } = newUser;
            res.status(201).json(userWithoutPassword);
        } catch (error) {
            res.status(500).json({ error: "Error al crear el usuario" });
        }
    },

    updateUser: async (req, res) => {
        const { id } = req.params;
        const data = req.body;
        try {
            if (data.password) {
                data.password = bcrypt.hashSync(data.password, 10);
            } else {
                delete data.password;
            }

            const updatedUser = await prisma.user.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    is_admin: Boolean(data.is_admin),
                    can_create_tasks: Boolean(data.can_create_tasks),
                    can_edit_tasks: Boolean(data.can_edit_tasks),
                    can_delete_tasks: Boolean(data.can_delete_tasks),
                    acceso_supervision: Boolean(data.acceso_supervision)
                }
            });
            const { password: _, ...userWithoutPassword } = updatedUser;
            res.json(userWithoutPassword);
        } catch (error) {
            res.status(500).json({ error: "Error al actualizar el usuario" });
        }
    },

    // 4. NOTIFICACIONES
    getNotifications: async (req, res) => {
        try {
            const notifications = await prisma.notification.findMany({
                where: { user_id: req.user.id },
                orderBy: { created_at: 'desc' },
                take: 20
            });
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: "Error al obtener notificaciones" });
        }
    }
};

module.exports = authController; */


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
            const user = await prisma.user.findUnique({ 
                where: { email },
                include: { area: true }
            });

            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ error: "Credenciales inválidas" });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, is_admin: user.is_admin },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword, token });
        } catch (error) {
            res.status(500).json({ error: "Error en el servidor durante el login" });
        }
    },

    // 2. LOGOUT (Añadido para evitar error en index.js)
    logout: (req, res) => {
        res.json({ message: "Sesión cerrada correctamente" });
    },

    // 3. PERFIL ACTUAL
    me: async (req, res) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { area: true }
            });
            const { password: _, ...u } = user;
            res.json(u);
        } catch (error) {
            res.status(500).json({ error: "Error al obtener perfil" });
        }
    },

    // 4. GESTIÓN DE USUARIOS
    getUsers: async (req, res) => {
        try {
            const users = await prisma.user.findMany({
                include: { area: true },
                orderBy: { nombre: 'asc' }
            });
            res.json(users.map(({ password, ...u }) => u));
        } catch (error) {
            res.status(500).json({ error: "Error al listar usuarios" });
        }
    },

    createUser: async (req, res) => {
        try {
            const hashedPassword = bcrypt.hashSync(req.body.password || "taskflow123", 10);
            const newUser = await prisma.user.create({
                data: {
                    ...req.body,
                    password: hashedPassword,
                    is_admin: Boolean(req.body.is_admin),
                    areaId: req.body.areaId ? parseInt(req.body.areaId) : null
                }
            });
            const { password: _, ...u } = newUser;
            res.status(201).json(u);
        } catch (error) {
            res.status(500).json({ error: "Error al crear usuario" });
        }
    },

    updateUser: async (req, res) => {
        try {
            const data = { ...req.body };
            if (data.password) data.password = bcrypt.hashSync(data.password, 10);
            const updated = await prisma.user.update({
                where: { id: parseInt(req.params.id) },
                data: {
                    ...data,
                    is_admin: Boolean(data.is_admin),
                    areaId: data.areaId ? parseInt(data.areaId) : null
                }
            });
            const { password: _, ...u } = updated;
            res.json(u);
        } catch (error) {
            res.status(500).json({ error: "Error al actualizar usuario" });
        }
    },

    deleteUser: async (req, res) => {
        try {
            await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: "Error al eliminar usuario" });
        }
    },

    // 5. NOTIFICACIONES
    getNotifications: async (req, res) => {
        try {
            const notifications = await prisma.notification.findMany({
                where: { user_id: req.user.id },
                orderBy: { created_at: 'desc' }
            });
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: "Error al obtener notificaciones" });
        }
    },

    markNotificationRead: async (req, res) => {
        try {
            await prisma.notification.update({
                where: { id: parseInt(req.params.id) },
                data: { leida: true }
            });
            res.json({ message: "Notificación marcada como leída" });
        } catch (error) {
            res.status(500).json({ error: "Error al actualizar notificación" });
        }
    }
};

module.exports = authController;
// routes/api.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Importar Controladores
const authController = require('../controllers/authController');
const taskController = require('../controllers/taskController');
const areaController = require('../controllers/areaController');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow_super_secret_key';

// --- MIDDLEWARES DE SEGURIDAD ---

// 1. Verificar Token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: "Acceso denegado. Token no proporcionado." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido o expirado." });
        req.user = user;
        next();
    });
};

// 2. Verificar si es Administrador
const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: "Permiso denegado. Se requieren privilegios de Administrador." });
    }
    next();
};

// --- RUTAS PÚBLICAS ---
router.post('/login', authController.login);

// --- RUTAS PROTEGIDAS (Requieren Login) ---
router.use(authenticateToken); // A partir de aquí, todas las rutas requieren JWT

router.get('/me', authController.me);
router.get('/notifications', authController.getNotifications);

// Tareas (Lógica de visibilidad interna en el controlador)
router.get('/tasks', taskController.getAll);
router.get('/tasks/control', taskController.getControl);
router.post('/tasks', taskController.create);
router.put('/tasks/:id', taskController.update);
router.delete('/tasks/:id', taskController.delete);
router.get('/tasks/:id/history', taskController.getHistory);
router.get('/tasks/:id/details', taskController.getDetails);
router.post('/tasks/:id/upload', taskController.uploadFile);

// --- RUTAS DE ADMINISTRACIÓN (Solo Admin) ---

// Gestión de Usuarios
router.get('/users', isAdmin, authController.getUsers);
router.post('/users', isAdmin, authController.createUser);
router.put('/users/:id', isAdmin, authController.updateUser);
router.delete('/users/:id', isAdmin, authController.deleteUser);

// Gestión de Áreas
router.get('/areas', isAdmin, areaController.getAll);
router.post('/areas', isAdmin, areaController.create);
router.put('/areas/:id', isAdmin, areaController.update);
router.delete('/areas/:id', isAdmin, areaController.delete);

module.exports = router;
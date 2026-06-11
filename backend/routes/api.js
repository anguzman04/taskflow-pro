const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Controladores
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const areaController = require('../controllers/areaController');
const taskController = require('../controllers/taskController');
const auditLogController = require('../controllers/auditLogController');
const attachmentController = require('../controllers/attachmentController');
const commentController = require('../controllers/commentController');
const notificationController = require('../controllers/notificationController');
const projectController = require('../controllers/projectController');

// ==========================================
// 1. RUTAS PÚBLICAS
// ==========================================
router.post('/login', authController.login); 
router.post('/change-password', authController.changePassword);

// ==========================================
// 2. FILTRO DE SEGURIDAD (MIDDLEWARE)
// ==========================================
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: "Token requerido" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'taskflow_secret_key_123');
        req.userId = decoded.id || decoded.userId; 
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido" });
    }
};

// Aplicar el filtro a todas las rutas que estén debajo de esta línea
router.use(verifyToken);


// ==========================================
// 3. RUTAS PROTEGIDAS
// ==========================================

// Usuarios
router.get('/users', userController.getAll);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

// Áreas
router.get('/areas', areaController.getAll);
router.post('/areas', areaController.create);
router.put('/areas/:id', areaController.update);
router.delete('/areas/:id', areaController.delete);

// Tareas
router.get('/tasks', taskController.getAll);
router.post('/tasks', taskController.create);
router.post('/tasks/bulk', taskController.createBulk);
router.put('/tasks/:id', taskController.update);   
router.delete('/tasks/:id', taskController.delete); 
// Ruta para edición rápida (inline)
router.patch('/tasks/:id/quick', taskController.quickUpdate);

// --- RUTAS DE SUBTAREAS ---
router.post('/tasks/:id/subtasks', taskController.addSubtask);
router.put('/tasks/:id/subtasks/reorder', taskController.reorderSubtasks);
router.put('/tasks/subtasks/:subtaskId', taskController.toggleSubtask);
router.patch('/tasks/subtasks/:subtaskId/fecha', taskController.updateSubtaskFecha);
router.patch('/tasks/subtasks/:subtaskId/titulo', taskController.updateSubtaskTitulo);
router.delete('/tasks/subtasks/:subtaskId', taskController.deleteSubtask);

// Proyectos
router.get('/projects', projectController.getAll);
router.post('/projects', projectController.create);
router.put('/projects/:id', projectController.update);
router.delete('/projects/:id', projectController.delete);

// Control de Gestión
router.get('/control/tasks', taskController.getControlTasks);
router.patch('/control/tasks/:id/delete', taskController.eliminarTareaDesdeControl); // 👈 Limpia y protegida

// Comentarios
router.get('/comments/:taskId', commentController.getByTask);
router.post('/comments', commentController.create);
router.put('/comments/:id', commentController.update);
router.delete('/comments/:id', commentController.delete);

// Evidencias
router.delete('/tasks/evidence/:id', taskController.deleteEvidence);

// Notificaciones
router.get('/notifications', notificationController.getByUser);
router.put('/notifications/read', notificationController.markAsRead);

// Historial y Evidencias
router.get('/audit-logs/:taskId', auditLogController.getByTask);
router.get('/attachments/:taskId', attachmentController.getByTask);
router.post('/attachments/:taskId', attachmentController.uploadMiddleware, attachmentController.uploadFile);
router.post('/attachments/:taskId/link', attachmentController.addLink);

module.exports = router;
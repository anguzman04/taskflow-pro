const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { id: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error("Error obteniendo proyectos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

exports.create = async (req, res) => {
    try {
        const { nombre, descripcion, estado, fecha_inicio, fecha_fin, lider_id, prioritario } = req.body;
        const newProject = await prisma.project.create({
            data: { 
                nombre, 
                descripcion, 
                estado, 
                fecha_inicio, 
                fecha_fin,
                lider_id: lider_id ? parseInt(lider_id) : null,
                prioritario: prioritario === true || prioritario === 'true' // <-- Nuevo campo guardado
            }
        });
        res.status(201).json(newProject);
    } catch (error) {
        console.error("Error creando proyecto:", error);
        res.status(500).json({ error: "Error al crear el proyecto" });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, estado, fecha_inicio, fecha_fin, lider_id, prioritario } = req.body;
        const updatedProject = await prisma.project.update({
            where: { id: Number(id) },
            data: { 
                nombre, 
                descripcion, 
                estado, 
                fecha_inicio, 
                fecha_fin,
                lider_id: lider_id ? parseInt(lider_id) : null,
                prioritario: prioritario === true || prioritario === 'true' // <-- Nuevo campo actualizado
            }
        });
        res.json(updatedProject);
    } catch (error) {
        console.error("Error actualizando proyecto:", error);
        res.status(500).json({ error: "Error al actualizar el proyecto" });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Primero, "desamogramos" las tareas que pertenezcan a este proyecto
        await prisma.task.updateMany({
            where: { proyecto_id: Number(id) },
            data: { proyecto_id: null }
        });
        
        // Luego eliminamos el proyecto
        await prisma.project.delete({
            where: { id: Number(id) }
        });
        
        res.json({ message: "Proyecto eliminado correctamente" });
    } catch (error) {
        console.error("Error eliminando proyecto:", error);
        res.status(500).json({ error: "Error al eliminar el proyecto" });
    }
};
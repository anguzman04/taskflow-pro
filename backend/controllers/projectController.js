const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res) => {
    try {
        // 1. Traemos los proyectos de la base de datos
        const projects = await prisma.project.findMany({
            orderBy: { id: 'desc' } // Opcional: para que los más nuevos salgan primero
        });

        // 2. 🧹 INTERCEPTOR: Limpiamos la basura de la zona horaria (la "T" y los ceros)
        const formattedProjects = projects.map(project => ({
            ...project,
            fecha_inicio: project.fecha_inicio ? new Date(project.fecha_inicio).toISOString().split('T')[0] : '',
            fecha_fin: project.fecha_fin ? new Date(project.fecha_fin).toISOString().split('T')[0] : ''
        }));

        // 3. Enviamos los proyectos limpios a React
        res.json(formattedProjects);
        
    } catch (error) {
        console.error("Error al obtener proyectos:", error);
        res.status(500).json({ error: "Error al obtener los proyectos" });
    }
};

/* exports.create = async (req, res) => {
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
}; */

exports.create = async (req, res) => {
    try {
        const { nombre, descripcion, estado, fecha_inicio, fecha_fin, lider_id, prioritario } = req.body;
        
        const newProject = await prisma.project.create({
            data: {
                nombre,
                descripcion,
                estado: estado || 'Activo',
                
                // 🚀 FIX: Convertimos el texto a un Objeto Date de JavaScript
                fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
                fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
                
                // Aseguramos que los tipos coincidan (ID como número, prioritario como booleano)
                lider_id: lider_id ? parseInt(lider_id) : null,
                prioritario: prioritario === true || prioritario === 'true' || prioritario === 1
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
                // En tu exports.update, asegúrate de aplicar el mismo formato:
                fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : undefined,
                fecha_fin: fecha_fin ? new Date(fecha_fin) : undefined,
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
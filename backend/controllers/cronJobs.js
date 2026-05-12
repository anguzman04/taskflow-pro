const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const notificationService = require('./controllers/notificationService'); 
const prisma = new PrismaClient();

const startCronJobs = () => {
  console.log("⏳ Motor de Alertas activado. Esperando el cambio de minuto...");
  
  // Ejecutar CADA MINUTO para pruebas
  cron.schedule('* * * * *', async () => {
    console.log("\n--------------------------------------------------");
    console.log("🔍 [CRON] Iniciando validación de tareas...");
    
    // Calcular fechas locales
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

    try {
      const allUsers = await prisma.user.findMany();
      const activeTasks = await prisma.task.findMany({
        where: {
          estado: { notIn: ['Completado', 'Finalizado', 'Cancelado'] }
        }
      });

      console.log(`📊 Tareas activas en BD: ${activeTasks.length}`);
      let atrasadas = 0;

      for (const task of activeTasks) {
        const responsablesArray = task.responsable ? task.responsable.split(',').map(r => r.trim()) : [];
        
        // --- LÓGICA TAREAS ATRASADAS ---
        if (task.fecha_fin < todayStr) {
          atrasadas++;
          const notifiedToday = await prisma.notification.findFirst({
            where: { 
              task_id: task.id, 
              type: 'CRITICAL', 
              created_at: { gte: new Date(new Date().setHours(0,0,0,0)) } 
            }
          });

          if (!notifiedToday) {
            console.log(`🚨 Tarea atrasada detectada: "${task.actividad}"`);
            await notifyResponsibles(task, responsablesArray, allUsers, 'CRITICAL', `🚨 URGENTE: La actividad "${task.actividad}" está ATRASADA (Debió finalizar el ${task.fecha_fin}).`);
          } else {
            console.log(`ℹ️ La tarea "${task.actividad}" está atrasada, pero ya se avisó hoy.`);
          }
        }
      }
      
      console.log(`✅ [CRON] Fin de validación. Tareas Atrasadas: ${atrasadas}`);
      console.log("--------------------------------------------------\n");
    } catch (error) {
      console.error("❌ Error en Cron Job:", error);
    }
  });
};

async function notifyResponsibles(task, responsablesNames, allUsers, type, message) {
  for (const respName of responsablesNames) {
    // Normalizar texto para evitar fallos por tildes o mayúsculas
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    
    const respUser = allUsers.find(u => normalize(`${u.nombre} ${u.apellido}`) === normalize(respName));
    
    if (respUser) {
      console.log(`➡️ Preparando alerta para: ${respUser.email} (${respUser.nombre})`);
      await notificationService.dispatch({
        userId: respUser.id,
        taskId: task.id,
        message: message,
        type: type,
        forceEmail: true,
        extraData: { 
          userName: respUser.nombre, 
          actividad: task.actividad, 
          fecha_fin: task.fecha_fin,
          prioridadLimpia: task.prioridad.includes('|') ? task.prioridad.split('|')[1] : task.prioridad
        }
      });
    } else {
      console.log(`⚠️ ALERTA: No se encontró en la base de datos el correo para el responsable: "${respName}"`);
    }
  }
}

module.exports = startCronJobs;
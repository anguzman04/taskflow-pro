const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
// CÁMBIALO A ESTO:
const notificationService = require('./controllers/notificationService'); // Ajusta la ruta si es necesario
const prisma = new PrismaClient();

const startCronJobs = () => {
  console.log("⏳ Motor de Alertas activado. Esperando el cambio de minuto...");
  
  cron.schedule('* * * * *', async () => {
    console.log("\n--------------------------------------------------");
    console.log("🔍 [CRON] Iniciando validación de tareas...");
    
    // --- NUEVA LÓGICA DE FECHAS NATURA ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizamos a la medianoche (00:00:00) para evitar desfases de horas
    
    try {
      const allUsers = await prisma.user.findMany();
      const activeTasks = await prisma.task.findMany({
        where: {
          estado: { notIn: ['Completado', 'Finalizado', 'Cancelado'] }
        }
      });

/*       console.log(`📊 Tareas activas en BD: ${activeTasks.length}`);
      let atrasadas = 0;

      for (const task of activeTasks) {
        const responsablesArray = task.responsable ? task.responsable.split(',').map(r => r.trim()) : [];
        
        // Convertimos la fecha de la base de datos a un objeto Date real para compararlo
        const fechaFinTarea = task.fecha_fin ? new Date(task.fecha_fin) : null;

        // --- VALIDACIÓN MATEMÁTICA REAL ---
        if (fechaFinTarea && fechaFinTarea < today) {
          atrasadas++;
          
          const notifiedToday = await prisma.notification.findFirst({
            where: { 
              task_id: task.id, 
              type: 'CRITICAL', 
              created_at: { gte: today } // Comparamos desde el inicio del día de hoy
            }
          });

          if (!notifiedToday) {
            // Formateamos visualmente para el correo
            const fechaLimpia = fechaFinTarea.toISOString().split('T')[0];
            console.log(`🚨 Tarea atrasada detectada: "${task.actividad}"`);
            
            await notifyResponsibles(task, responsablesArray, allUsers, 'CRITICAL', `🚨 URGENTE: La actividad "${task.actividad}" está ATRASADA (Debió finalizar el ${fechaLimpia}).`);
          } else {
            console.log(`ℹ️ La tarea "${task.actividad}" está atrasada, pero ya se avisó hoy.`);
          }
        }
      } */
	  
	  
	  
	  console.log(`📊 Tareas activas en BD: ${activeTasks.length}`);
      let atrasadas = 0;

      for (const task of activeTasks) {
        const responsablesArray = task.responsable ? task.responsable.split(',').map(r => r.trim()) : [];
        const fechaFinTarea = task.fecha_fin ? new Date(task.fecha_fin) : null;

        // 🟢 EL RADAR: Imprimimos exactamente qué está comparando Node.js
        const fechaCorta = fechaFinTarea ? fechaFinTarea.toISOString().split('T')[0] : 'Sin fecha';
        console.log(`🔎 Evaluando: "${task.actividad.substring(0, 20)}..." | Estado: ${task.estado} | Vence: ${fechaCorta}`);

        if (fechaFinTarea && fechaFinTarea < today) {
          atrasadas++;
          
          const notifiedToday = await prisma.notification.findFirst({
            where: { 
              task_id: task.id, 
              type: 'CRITICAL', 
              created_at: { gte: today } 
            }
          });

          if (!notifiedToday) {
            console.log(`   🚨 ATRASADA DETECTADA. Enviando alerta a responsables...`);
            const fechaLimpia = fechaFinTarea.toISOString().split('T')[0];
            await notifyResponsibles(task, responsablesArray, allUsers, 'CRITICAL', `🚨 URGENTE: La actividad "${task.actividad}" está ATRASADA (Debió finalizar el ${fechaLimpia}).`);
          } else {
            console.log(`   🚫 BLOQUEO ANTI-SPAM: La tarea está atrasada, pero ya se envió la alerta hoy.`);
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
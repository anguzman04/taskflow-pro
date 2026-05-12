const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, 
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const notificationService = {
  dispatch: async ({ userId, taskId, message, type = 'INFO', forceEmail = false, extraData = {} }) => {
    try {
      const notif = await prisma.notification.create({
        data: { user_id: userId, task_id: taskId, message, type }
      });

      const tiposQueEnvianEmail = ['CRITICAL', 'WARNING', 'SUCCESS']; 

      if (tiposQueEnvianEmail.includes(type) || forceEmail) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        if (user && user.email) {
          console.log(`   ⏳ Conectando con Office365 para enviar a ${user.email}...`);

          const headerColor = type === 'WARNING' ? '#f59e0b' : type === 'SUCCESS' ? '#10b981' : type === 'CRITICAL' ? '#ef4444' : '#2563eb';
          
          // 👇 NUEVO: Construimos la tarjeta de detalles dinámicamente si enviamos extraData
          let detallesAdicionales = '';
          if (extraData && extraData.actividad) {
            detallesAdicionales += `
              <div style="background-color: #f8fafc; border-left: 4px solid ${headerColor}; padding: 15px; margin-top: 25px; border-radius: 6px;">
                <p style="margin: 0 0 ${extraData.fecha_fin ? '10px' : '0'}; color: #334155; font-size: 15px;">
                  📋 <strong>Actividad:</strong> ${extraData.actividad}
                </p>`;
            
            if (extraData.fecha_fin) {
              detallesAdicionales += `
                <p style="margin: 0 0 10px; color: #334155; font-size: 15px;">
                  📅 <strong>Compromiso:</strong> ${extraData.fecha_fin}
                </p>`;
            }
            
            if (extraData.prioridadLimpia) {
              detallesAdicionales += `
                <p style="margin: 0; color: #334155; font-size: 15px;">
                  🚦 <strong>Prioridad:</strong> ${extraData.prioridadLimpia}
                </p>`;
            }

            detallesAdicionales += `</div>`;
          }

          // Inyectamos los detalles adicionales debajo del mensaje principal
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <div style="background-color: ${headerColor}; padding: 20px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0;">TaskFlow Pro</h2>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <h3 style="color: #0f172a; margin-top: 0;">¡Hola, ${extraData.userName || user.nombre}!</h3>
                <p style="color: #475569; font-size: 16px; line-height: 1.5;">${message}</p>
                
                ${detallesAdicionales}

                <div style="text-align: center; margin-top: 35px; margin-bottom: 20px;">
                  <a href="https://taskprojit.atlanticqi.com" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Abrir TaskFlow Pro</a>
                </div>
              </div>
            </div>
          `;

          transporter.sendMail({
            from: `"TaskFlow Pro" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `📢 Notificación de Tarea`,
            html: htmlContent
          })
          .then(() => console.log(`   ✅ ¡ÉXITO! Correo enviado a ${user.email}`))
          .catch(err => console.error(`   ❌ ERROR AL ENVIAR CORREO:`, err.message));
        }
      }
      return notif;
    } catch (error) {
      console.error("Error en NotificationService:", error);
    }
  }
};

module.exports = notificationService;
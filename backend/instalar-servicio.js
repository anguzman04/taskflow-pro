var Service = require('node-windows').Service;
var svc = new Service({
  name:'TaskFlow Backend API',
  description: 'Servidor Node.js para TaskFlow Pro.',
  script: 'D:\Aplicacion\taskflow-pro\backend\routes\api.js' // <--- PON TU RUTA REAL AQUÍ
});
svc.on('install',function(){
  svc.start();
  console.log("¡Servicio instalado y corriendo!");
});
svc.install();
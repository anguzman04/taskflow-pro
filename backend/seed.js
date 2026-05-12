require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHashed = await bcrypt.hash('Admin123*', 10);
  
  // 1. Crear Área inicial (Sistemas)
  const area = await prisma.area.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Sistemas y Tecnología',
      descripcion: 'Departamento de IT'
    }
  });

  // 2. Crear Usuario Administrador con todos los permisos detectados en tu esquema
/*   const admin = await prisma.user.upsert({
    where: { email: 'admin@taskflow.com' },
    update: {},
    create: {
      nombre: 'Admin',
      apellido: 'TaskFlow',
      email: 'admin@taskflow.com',
      password: passwordHashed,
      is_admin: true,
      cargo: 'Software Engineer',
      area_id: area.id, // Corregido de areaId a area_id
      can_create_tasks: true,
      can_edit_tasks: true,
      can_delete_tasks: true,
      acceso_supervision: true
    }
  }); */
  
  // Crear o Actualizar Usuario Administrador
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskflow.com' },
    update: { 
      password: passwordHashed // <--- AHORA SÍ SE ACTUALIZARÁ
    },
    create: {
      nombre: 'Admin',
      apellido: 'TaskFlow',
      email: 'admin@taskflow.com',
      password: passwordHashed,
      is_admin: true,
      cargo: 'Software Engineer',
      area_id: area.id,
      can_create_tasks: true,
      can_edit_tasks: true,
      can_delete_tasks: true,
      acceso_supervision: true
    }
  });

  console.log('✅ BASE DE DATOS INICIALIZADA');
  console.log('👤 Usuario:', admin.email);
  console.log('🔑 Contraseña: Admin123*');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
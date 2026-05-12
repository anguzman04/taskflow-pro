-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "jefe_directo" TEXT,
    "area_id" INTEGER,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "can_create_tasks" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_tasks" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_tasks" BOOLEAN NOT NULL DEFAULT false,
    "acceso_supervision" BOOLEAN NOT NULL DEFAULT false,
    "areas_autorizadas" TEXT,
    "perm_users_view" BOOLEAN NOT NULL DEFAULT false,
    "perm_users_create" BOOLEAN NOT NULL DEFAULT false,
    "perm_users_edit" BOOLEAN NOT NULL DEFAULT false,
    "perm_users_delete" BOOLEAN NOT NULL DEFAULT false,
    "perm_areas_view" BOOLEAN NOT NULL DEFAULT false,
    "perm_areas_create" BOOLEAN NOT NULL DEFAULT false,
    "perm_areas_edit" BOOLEAN NOT NULL DEFAULT false,
    "perm_areas_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "jefe_id" INTEGER,
    "parent_area_id" INTEGER,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "actividad" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "fecha_registro" TEXT NOT NULL,
    "fecha_inicio" TEXT NOT NULL,
    "fecha_fin" TEXT NOT NULL,
    "fecha_ejecucion" TEXT,
    "prioridad" TEXT NOT NULL,
    "prerequisito" TEXT,
    "observacion" TEXT,
    "cliente" TEXT,
    "porcentaje_avance" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "created_by_id" INTEGER NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Area_jefe_id_key" ON "Area"("jefe_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_jefe_id_fkey" FOREIGN KEY ("jefe_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_parent_area_id_fkey" FOREIGN KEY ("parent_area_id") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

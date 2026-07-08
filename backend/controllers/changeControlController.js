const { PrismaClient } = require('@prisma/client');
const { generateChangeControlBuffer } = require('../services/changeControlTemplate');
const prisma = new PrismaClient();

// Verifica que el usuario tenga acceso al módulo (admin o permiso explícito).
const checkAccess = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, status: 401, error: 'Usuario no encontrado' };
  if (user.is_admin || user.perm_change_control) return { allowed: true, user };
  return { allowed: false, status: 403, error: 'No autorizado' };
};

// Campos de texto simples que acepta el formulario.
const SCALAR_FIELDS = [
  'nombre_cambio', 'fecha_hora_inicio', 'objetivo', 'fecha_hora_final',
  'solicitado_por', 'tipo_cambio', 'organizacion', 'version', 'descripcion',
  'por_que', 'impacto', 'activos', 'principios_seguridad', 'trata_datos',
  'bd_afectadas', 'resultado_previsto', 'tiempo_estimado', 'riesgos',
  'factores_adicionales', 'costos', 'resultados',
  'rev_realizado_por', 'rev_cargo', 'rev_aprobador', 'estado',
];
// Secciones repetibles (se guardan como JSON tal cual).
const JSON_FIELDS = ['partes', 'personal', 'implementadores', 'soporte', 'antes', 'durante', 'rollback'];

// Extrae del body solo los campos permitidos.
const buildData = (body) => {
  const data = {};
  SCALAR_FIELDS.forEach((f) => { if (f in body) data[f] = body[f] ?? null; });
  JSON_FIELDS.forEach((f) => { if (f in body) data[f] = body[f] ?? null; });
  return data;
};

// Nombre de archivo seguro para la descarga.
const buildFilename = (record) => {
  const base = (record.nombre_cambio || 'control-de-cambios')
    .replace(/[\\/:*?"<>|]/g, '')  // caracteres inválidos en nombres de archivo
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `IT-F-50-V1 Control de cambios - ${base}.xlsx`;
};

const changeControlController = {
  // Lista liviana (sin los JSON pesados) para la tabla del módulo.
  getAll: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const items = await prisma.changeControl.findMany({
        select: {
          id: true, nombre_cambio: true, tipo_cambio: true, version: true,
          estado: true, solicitado_por: true, created_by_nombre: true,
          created_at: true, updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
      });
      res.json(items);
    } catch (error) {
      console.error('Error al listar controles de cambio:', error);
      res.status(500).json({ error: 'Error al listar los controles de cambio' });
    }
  },

  getById: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const item = await prisma.changeControl.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!item) return res.status(404).json({ error: 'Control de cambios no encontrado' });
      res.json(item);
    } catch (error) {
      console.error('Error al obtener control de cambio:', error);
      res.status(500).json({ error: 'Error al obtener el control de cambio' });
    }
  },

  create: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const data = buildData(req.body);
      if (!data.nombre_cambio?.trim()) return res.status(400).json({ error: 'El nombre del cambio es obligatorio' });
      const nombreCreador = [access.user.nombre, access.user.apellido].filter(Boolean).join(' ').trim();
      const item = await prisma.changeControl.create({
        data: { ...data, created_by_id: access.user.id, created_by_nombre: nombreCreador || null },
      });
      res.status(201).json(item);
    } catch (error) {
      console.error('Error al crear control de cambio:', error);
      res.status(500).json({ error: 'Error al crear el control de cambio' });
    }
  },

  update: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { id } = req.params;
      const data = buildData(req.body);
      if ('nombre_cambio' in data && !data.nombre_cambio?.trim())
        return res.status(400).json({ error: 'El nombre del cambio es obligatorio' });
      const item = await prisma.changeControl.update({ where: { id: parseInt(id) }, data });
      res.json(item);
    } catch (error) {
      if (error.code === 'P2025') return res.status(404).json({ error: 'Control de cambios no encontrado' });
      console.error('Error al actualizar control de cambio:', error);
      res.status(500).json({ error: 'Error al actualizar el control de cambio' });
    }
  },

  delete: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      await prisma.changeControl.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: 'Control de cambios eliminado' });
    } catch (error) {
      if (error.code === 'P2025') return res.status(404).json({ error: 'Control de cambios no encontrado' });
      console.error('Error al eliminar control de cambio:', error);
      res.status(500).json({ error: 'Error al eliminar el control de cambio' });
    }
  },

  // Genera y transmite el .xlsx diligenciado, idéntico a la plantilla.
  download: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const record = await prisma.changeControl.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!record) return res.status(404).json({ error: 'Control de cambios no encontrado' });

      const buffer = await generateChangeControlBuffer(record);
      const filename = buildFilename(record);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="control-de-cambios-${record.id}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al generar el Excel de control de cambio:', error);
      res.status(500).json({ error: 'Error al generar el archivo Excel' });
    }
  },
};

module.exports = changeControlController;

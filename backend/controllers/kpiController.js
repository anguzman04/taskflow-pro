const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Acceso al módulo: admin o permiso explícito.
const checkAccess = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, status: 401, error: 'Usuario no encontrado' };
  if (user.is_admin || user.perm_kpi) return { allowed: true, user };
  return { allowed: false, status: 403, error: 'No autorizado' };
};

// Rango [inicio, fin) del mes 'YYYY-MM'. fin es exclusivo (primer instante del mes siguiente).
const monthRange = (month) => {
  const [y, m] = String(month || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  const daysInMonth = new Date(y, m, 0).getDate();
  return { start, end, daysInMonth, totalMinutes: daysInMonth * 1440 };
};

const round1 = (n) => Math.round(n * 10) / 10;

const kpiController = {
  // ---------- Catálogo de aplicaciones ----------
  listApps: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const apps = await prisma.kpiApp.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
      res.json(apps);
    } catch (e) { console.error('Error listApps:', e); res.status(500).json({ error: 'Error al listar aplicaciones' }); }
  },

  createApp: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { nombre } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
      const app = await prisma.kpiApp.create({ data: { nombre: nombre.trim() } });
      res.status(201).json(app);
    } catch (e) { console.error('Error createApp:', e); res.status(500).json({ error: 'Error al crear la aplicación' }); }
  },

  updateApp: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { nombre, activo } = req.body;
      const data = {};
      if (nombre !== undefined) { if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' }); data.nombre = nombre.trim(); }
      if (activo !== undefined) data.activo = !!activo;
      const app = await prisma.kpiApp.update({ where: { id: parseInt(req.params.id) }, data });
      res.json(app);
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Aplicación no encontrada' });
      console.error('Error updateApp:', e); res.status(500).json({ error: 'Error al actualizar la aplicación' });
    }
  },

  // Borrado lógico para no perder el histórico de incidentes/despliegues.
  deleteApp: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      await prisma.kpiApp.update({ where: { id: parseInt(req.params.id) }, data: { activo: false } });
      res.json({ message: 'Aplicación desactivada' });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Aplicación no encontrada' });
      console.error('Error deleteApp:', e); res.status(500).json({ error: 'Error al eliminar la aplicación' });
    }
  },

  // ---------- Catálogo de sedes ----------
  listSedes: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const sedes = await prisma.kpiSede.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
      res.json(sedes);
    } catch (e) { console.error('Error listSedes:', e); res.status(500).json({ error: 'Error al listar sedes' }); }
  },

  createSede: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { nombre } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
      const sede = await prisma.kpiSede.create({ data: { nombre: nombre.trim() } });
      res.status(201).json(sede);
    } catch (e) { console.error('Error createSede:', e); res.status(500).json({ error: 'Error al crear la sede' }); }
  },

  updateSede: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { nombre, activo } = req.body;
      const data = {};
      if (nombre !== undefined) { if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' }); data.nombre = nombre.trim(); }
      if (activo !== undefined) data.activo = !!activo;
      const sede = await prisma.kpiSede.update({ where: { id: parseInt(req.params.id) }, data });
      res.json(sede);
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Sede no encontrada' });
      console.error('Error updateSede:', e); res.status(500).json({ error: 'Error al actualizar la sede' });
    }
  },

  deleteSede: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      await prisma.kpiSede.update({ where: { id: parseInt(req.params.id) }, data: { activo: false } });
      res.json({ message: 'Sede desactivada' });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Sede no encontrada' });
      console.error('Error deleteSede:', e); res.status(500).json({ error: 'Error al eliminar la sede' });
    }
  },

  // ---------- Incidentes de indisponibilidad (SAPP-01) ----------
  listIncidentes: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const where = {};
      const range = req.query.month ? monthRange(req.query.month) : null;
      if (range) where.AND = [{ inicio: { lt: range.end } }, { fin: { gt: range.start } }]; // solapan el mes
      const items = await prisma.kpiIncidente.findMany({
        where, orderBy: { inicio: 'desc' }, include: { app: { select: { nombre: true } }, sede: { select: { nombre: true } } }
      });
      res.json(items.map(i => ({ ...i, app_nombre: i.app?.nombre, sede_nombre: i.sede?.nombre || null, app: undefined, sede: undefined })));
    } catch (e) { console.error('Error listIncidentes:', e); res.status(500).json({ error: 'Error al listar incidentes' }); }
  },

  createIncidente: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { app_id, sede_id, inicio, fin, causa, resolucion } = req.body;
      if (!app_id || !inicio || !fin) return res.status(400).json({ error: 'Aplicación, inicio y fin son obligatorios' });
      if (new Date(fin) <= new Date(inicio)) return res.status(400).json({ error: 'El fin debe ser posterior al inicio' });
      const item = await prisma.kpiIncidente.create({
        data: {
          app_id: parseInt(app_id),
          sede_id: sede_id ? parseInt(sede_id) : null,
          inicio: new Date(inicio), fin: new Date(fin),
          causa: causa?.trim() || null, resolucion: resolucion?.trim() || null,
          created_by_id: access.user.id,
        }
      });
      res.status(201).json(item);
    } catch (e) { console.error('Error createIncidente:', e); res.status(500).json({ error: 'Error al crear el incidente' }); }
  },

  updateIncidente: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { app_id, sede_id, inicio, fin, causa, resolucion } = req.body;
      if (inicio && fin && new Date(fin) <= new Date(inicio)) return res.status(400).json({ error: 'El fin debe ser posterior al inicio' });
      const data = {};
      if (app_id !== undefined) data.app_id = parseInt(app_id);
      if (sede_id !== undefined) data.sede_id = sede_id ? parseInt(sede_id) : null;
      if (inicio !== undefined) data.inicio = new Date(inicio);
      if (fin !== undefined) data.fin = new Date(fin);
      if (causa !== undefined) data.causa = causa?.trim() || null;
      if (resolucion !== undefined) data.resolucion = resolucion?.trim() || null;
      const item = await prisma.kpiIncidente.update({ where: { id: parseInt(req.params.id) }, data });
      res.json(item);
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Incidente no encontrado' });
      console.error('Error updateIncidente:', e); res.status(500).json({ error: 'Error al actualizar el incidente' });
    }
  },

  deleteIncidente: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      await prisma.kpiIncidente.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: 'Incidente eliminado' });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Incidente no encontrado' });
      console.error('Error deleteIncidente:', e); res.status(500).json({ error: 'Error al eliminar el incidente' });
    }
  },

  // ---------- Despliegues / releases (SAPP-02) ----------
  listDespliegues: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const where = {};
      const range = req.query.month ? monthRange(req.query.month) : null;
      if (range) where.fecha = { gte: range.start, lt: range.end };
      const items = await prisma.kpiDespliegue.findMany({
        where, orderBy: { fecha: 'desc' }, include: { app: { select: { nombre: true } } }
      });
      res.json(items.map(d => ({ ...d, app_nombre: d.app?.nombre, app: undefined })));
    } catch (e) { console.error('Error listDespliegues:', e); res.status(500).json({ error: 'Error al listar despliegues' }); }
  },

  createDespliegue: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { app_id, fecha, resultado, descripcion } = req.body;
      if (!app_id || !fecha) return res.status(400).json({ error: 'Aplicación y fecha son obligatorias' });
      const res_ok = resultado === 'Fallido' ? 'Fallido' : 'Exitoso';
      const item = await prisma.kpiDespliegue.create({
        data: { app_id: parseInt(app_id), fecha: new Date(fecha), resultado: res_ok, descripcion: descripcion?.trim() || null, created_by_id: access.user.id }
      });
      res.status(201).json(item);
    } catch (e) { console.error('Error createDespliegue:', e); res.status(500).json({ error: 'Error al crear el despliegue' }); }
  },

  updateDespliegue: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const { app_id, fecha, resultado, descripcion } = req.body;
      const data = {};
      if (app_id !== undefined) data.app_id = parseInt(app_id);
      if (fecha !== undefined) data.fecha = new Date(fecha);
      if (resultado !== undefined) data.resultado = resultado === 'Fallido' ? 'Fallido' : 'Exitoso';
      if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
      const item = await prisma.kpiDespliegue.update({ where: { id: parseInt(req.params.id) }, data });
      res.json(item);
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Despliegue no encontrado' });
      console.error('Error updateDespliegue:', e); res.status(500).json({ error: 'Error al actualizar el despliegue' });
    }
  },

  deleteDespliegue: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      await prisma.kpiDespliegue.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ message: 'Despliegue eliminado' });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ error: 'Despliegue no encontrado' });
      console.error('Error deleteDespliegue:', e); res.status(500).json({ error: 'Error al eliminar el despliegue' });
    }
  },

  // ---------- Cálculo de métricas del mes (global + por aplicación) ----------
  metrics: async (req, res) => {
    try {
      const access = await checkAccess(req.userId);
      if (!access.allowed) return res.status(access.status).json({ error: access.error });
      const range = monthRange(req.query.month);
      if (!range) return res.status(400).json({ error: 'Mes inválido (formato YYYY-MM)' });

      const apps = await prisma.kpiApp.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
      const [incidentes, despliegues] = await Promise.all([
        prisma.kpiIncidente.findMany({ where: { AND: [{ inicio: { lt: range.end } }, { fin: { gt: range.start } }] } }),
        prisma.kpiDespliegue.findMany({ where: { fecha: { gte: range.start, lt: range.end } } }),
      ]);

      // Minutos de inactividad de un incidente DENTRO del mes (recorta a los límites del mes).
      const downtimeMin = (inc) => {
        const s = Math.max(new Date(inc.inicio).getTime(), range.start.getTime());
        const e = Math.min(new Date(inc.fin).getTime(), range.end.getTime());
        return e > s ? (e - s) / 60000 : 0;
      };

      const porApp = apps.map(app => {
        const incApp = incidentes.filter(i => i.app_id === app.id);
        const downMin = incApp.reduce((acc, i) => acc + downtimeMin(i), 0);
        const disponibilidad = range.totalMinutes > 0
          ? Math.max(0, Math.min(100, ((range.totalMinutes - downMin) / range.totalMinutes) * 100)) : 0;

        const depApp = despliegues.filter(d => d.app_id === app.id);
        const ejecutados = depApp.length;
        const exitosos = depApp.filter(d => d.resultado === 'Exitoso').length;
        const tasa = ejecutados > 0 ? (exitosos / ejecutados) * 100 : null;

        return {
          app_id: app.id, app_nombre: app.nombre,
          sapp01: { totalMin: range.totalMinutes, downtimeMin: round1(downMin), incidentes: incApp.length, disponibilidad: round1(disponibilidad) },
          sapp02: { ejecutados, exitosos, tasa: tasa === null ? null : round1(tasa) },
        };
      });

      // Global (ponderado): suma de tiempos totales e inactividad de todas las apps activas.
      const nApps = apps.length;
      const totalMinGlobal = range.totalMinutes * nApps;
      const downGlobal = porApp.reduce((a, x) => a + x.sapp01.downtimeMin, 0);
      const dispGlobal = totalMinGlobal > 0 ? Math.max(0, Math.min(100, ((totalMinGlobal - downGlobal) / totalMinGlobal) * 100)) : null;
      const ejecGlobal = porApp.reduce((a, x) => a + x.sapp02.ejecutados, 0);
      const exitGlobal = porApp.reduce((a, x) => a + x.sapp02.exitosos, 0);
      const tasaGlobal = ejecGlobal > 0 ? (exitGlobal / ejecGlobal) * 100 : null;

      res.json({
        month: req.query.month,
        daysInMonth: range.daysInMonth,
        totalMinutes: range.totalMinutes,
        global: {
          sapp01: { totalMin: totalMinGlobal, downtimeMin: round1(downGlobal), disponibilidad: dispGlobal === null ? null : round1(dispGlobal) },
          sapp02: { ejecutados: ejecGlobal, exitosos: exitGlobal, tasa: tasaGlobal === null ? null : round1(tasaGlobal) },
        },
        porApp,
      });
    } catch (e) { console.error('Error metrics KPI:', e); res.status(500).json({ error: 'Error al calcular las métricas' }); }
  },
};

module.exports = kpiController;

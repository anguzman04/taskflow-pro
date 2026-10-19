import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, X, Server, AlertTriangle, Rocket, TrendingUp, Settings2, CheckCircle2, XCircle, MapPin, Edit2, Save, Check,
} from 'lucide-react';

// --- Cliente HTTP: rutas relativas /api (window.fetch está parcheado en Dashboard
// para inyectar el token y el Content-Type). Funciona igual en dev y en producción. ---
const jget = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); };
const jsend = async (url: string, method: string, body?: any) => {
  const r = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(await r.text());
  return r.json().catch(() => ({}));
};

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const inp = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors';
const lbl = 'block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1';

// Color del % de disponibilidad / tasa
const pctColor = (v: number | null, good: number, warn: number) =>
  v === null ? 'text-slate-400' : v >= good ? 'text-emerald-600' : v >= warn ? 'text-amber-500' : 'text-red-600';

export default function KpiView({ currentUser }: any) {
  const [tab, setTab] = useState<'tablero' | 'registro'>('tablero');
  const [month, setMonth] = useState<string>(currentMonth());
  const [apps, setApps] = useState<any[]>([]);
  const [incidentes, setIncidentes] = useState<any[]>([]);
  const [despliegues, setDespliegues] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [sedes, setSedes] = useState<any[]>([]);
  const [showSedes, setShowSedes] = useState(false);
  const [nuevaSede, setNuevaSede] = useState('');

  const [nuevaApp, setNuevaApp] = useState('');
  const [inc, setInc] = useState({ app_id: '', sede_id: '', inicio: '', fin: '', causa: '', origen_causa: '', resolucion: '' });
  const [dep, setDep] = useState({ app_id: '', fecha: '', resultado: 'Exitoso', descripcion: '' });
  const [editIncId, setEditIncId] = useState<number | null>(null);
  const [editDepId, setEditDepId] = useState<number | null>(null);
  const [editApp, setEditApp] = useState<{ id: number; nombre: string } | null>(null);
  const [editSede, setEditSede] = useState<{ id: number; nombre: string } | null>(null);

  const fetchApps = async () => { try { setApps(await jget('/api/kpi/apps')); } catch (e) { console.error(e); } };
  const fetchSedes = async () => { try { setSedes(await jget('/api/kpi/sedes')); } catch (e) { console.error(e); } };
  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const [inc, dep, met] = await Promise.all([
        jget(`/api/kpi/incidentes?month=${month}`),
        jget(`/api/kpi/despliegues?month=${month}`),
        jget(`/api/kpi/metrics?month=${month}`),
      ]);
      setIncidentes(inc); setDespliegues(dep); setMetrics(met);
    } catch (e) { console.error('Error KPI:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchApps(); fetchSedes(); }, []);
  useEffect(() => { fetchMonthData(); /* eslint-disable-next-line */ }, [month]);

  // --- Catálogo de apps ---
  const addApp = async () => {
    if (!nuevaApp.trim()) return;
    try { await jsend('/api/kpi/apps', 'POST', { nombre: nuevaApp.trim() }); setNuevaApp(''); await fetchApps(); await fetchMonthData(); }
    catch (e) { console.error(e); alert('No se pudo agregar la aplicación.'); }
  };
  const delApp = async (id: number) => {
    if (!window.confirm('¿Desactivar esta aplicación? Su histórico se conserva.')) return;
    try { await jsend(`/api/kpi/apps/${id}`, 'DELETE'); await fetchApps(); await fetchMonthData(); } catch (e) { console.error(e); }
  };
  const saveEditApp = async () => {
    if (!editApp || !editApp.nombre.trim()) return;
    try { await jsend(`/api/kpi/apps/${editApp.id}`, 'PUT', { nombre: editApp.nombre.trim() }); setEditApp(null); await fetchApps(); await fetchMonthData(); }
    catch (e) { console.error(e); alert('No se pudo renombrar la aplicación.'); }
  };

  // --- Catálogo de sedes ---
  const addSede = async () => {
    if (!nuevaSede.trim()) return;
    try { await jsend('/api/kpi/sedes', 'POST', { nombre: nuevaSede.trim() }); setNuevaSede(''); await fetchSedes(); }
    catch (e) { console.error(e); alert('No se pudo agregar la sede.'); }
  };
  const delSede = async (id: number) => {
    if (!window.confirm('¿Desactivar esta sede? Su histórico se conserva.')) return;
    try { await jsend(`/api/kpi/sedes/${id}`, 'DELETE'); await fetchSedes(); } catch (e) { console.error(e); }
  };
  const saveEditSede = async () => {
    if (!editSede || !editSede.nombre.trim()) return;
    try { await jsend(`/api/kpi/sedes/${editSede.id}`, 'PUT', { nombre: editSede.nombre.trim() }); setEditSede(null); await fetchSedes(); await fetchMonthData(); }
    catch (e) { console.error(e); alert('No se pudo renombrar la sede.'); }
  };

  // --- Incidentes ---
  const cancelInc = () => { setEditIncId(null); setInc({ app_id: '', sede_id: '', inicio: '', fin: '', causa: '', origen_causa: '', resolucion: '' }); };
  const saveIncidente = async () => {
    if (!inc.app_id || !inc.inicio || !inc.fin) { alert('Aplicación, inicio y fin son obligatorios.'); return; }
    if (new Date(inc.fin) <= new Date(inc.inicio)) { alert('El fin debe ser posterior al inicio.'); return; }
    try {
      if (editIncId) await jsend(`/api/kpi/incidentes/${editIncId}`, 'PUT', inc);
      else await jsend('/api/kpi/incidentes', 'POST', inc);
      cancelInc(); await fetchMonthData();
    } catch (e) { console.error(e); alert('No se pudo guardar el incidente.'); }
  };
  const startEditInc = (i: any) => {
    setEditIncId(i.id);
    setInc({ app_id: String(i.app_id || ''), sede_id: i.sede_id ? String(i.sede_id) : '', inicio: toLocalInput(i.inicio), fin: toLocalInput(i.fin), causa: i.causa || '', origen_causa: i.origen_causa || '', resolucion: i.resolucion || '' });
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
  };
  const delIncidente = async (id: number) => {
    if (!window.confirm('¿Eliminar este incidente?')) return;
    try { await jsend(`/api/kpi/incidentes/${id}`, 'DELETE'); await fetchMonthData(); } catch (e) { console.error(e); }
  };

  // --- Despliegues ---
  const cancelDep = () => { setEditDepId(null); setDep({ app_id: '', fecha: '', resultado: 'Exitoso', descripcion: '' }); };
  const saveDespliegue = async () => {
    if (!dep.app_id || !dep.fecha) { alert('Aplicación y fecha son obligatorias.'); return; }
    try {
      if (editDepId) await jsend(`/api/kpi/despliegues/${editDepId}`, 'PUT', dep);
      else await jsend('/api/kpi/despliegues', 'POST', dep);
      cancelDep(); await fetchMonthData();
    } catch (e) { console.error(e); alert('No se pudo guardar el despliegue.'); }
  };
  const startEditDep = (d: any) => {
    setEditDepId(d.id);
    setDep({ app_id: String(d.app_id || ''), fecha: toLocalInput(d.fecha), resultado: d.resultado || 'Exitoso', descripcion: d.descripcion || '' });
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
  };
  const delDespliegue = async (id: number) => {
    if (!window.confirm('¿Eliminar este despliegue?')) return;
    try { await jsend(`/api/kpi/despliegues/${id}`, 'DELETE'); await fetchMonthData(); } catch (e) { console.error(e); }
  };

  const fmtDateTime = (s: string) => s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  // ISO -> valor para <input type="datetime-local"> en hora local (YYYY-MM-DDTHH:mm)
  const toLocalInput = (s: string) => { if (!s) return ''; const d = new Date(s); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const appName = (id: number) => apps.find(a => a.id === id)?.nombre || `App #${id}`;

  const g = metrics?.global;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Barra superior: pestañas + mes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['tablero', 'registro'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${tab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'tablero' ? 'Tablero' : 'Registro'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-400 uppercase">Mes</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400" />
        </div>
      </div>

      {/* ================= TABLERO ================= */}
      {tab === 'tablero' && (
        <div className="space-y-6">
          {/* Tarjetas globales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1"><Server size={16} className="text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wide">SAPP-01 · Disponibilidad (Global)</span></div>
              <div className={`text-5xl font-black ${pctColor(g?.sapp01?.disponibilidad ?? null, 99, 95)}`}>{g?.sapp01?.disponibilidad ?? '—'}<span className="text-2xl">%</span></div>
              <p className="text-xs text-slate-400 mt-2">Inactividad: <strong className="text-slate-600">{g?.sapp01?.downtimeMin ?? 0} min</strong> · Ventana 24×7 ({metrics?.daysInMonth ?? '—'} días)</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1"><Rocket size={16} className="text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wide">SAPP-02 · Éxito de Despliegue (Global)</span></div>
              <div className={`text-5xl font-black ${pctColor(g?.sapp02?.tasa ?? null, 90, 75)}`}>{g?.sapp02?.tasa ?? '—'}<span className="text-2xl">%</span></div>
              <p className="text-xs text-slate-400 mt-2">Exitosos: <strong className="text-slate-600">{g?.sapp02?.exitosos ?? 0}</strong> de <strong className="text-slate-600">{g?.sapp02?.ejecutados ?? 0}</strong> despliegues</p>
            </div>
          </div>

          {/* Desglose por aplicación */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"><TrendingUp size={16} className="text-slate-400" /><span className="text-sm font-bold text-slate-900">Desglose por aplicación</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Aplicación</th>
                    <th className="px-4 py-3 text-center">Disponibilidad</th>
                    <th className="px-4 py-3 text-center">Caídas</th>
                    <th className="px-4 py-3 text-center">Inactividad (min)</th>
                    <th className="px-4 py-3 text-center">Despliegues</th>
                    <th className="px-4 py-3 text-center">Tasa éxito</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Cargando...</td></tr>
                  ) : !metrics?.porApp?.length ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No hay aplicaciones registradas. Ve a "Registro" para agregarlas.</td></tr>
                  ) : metrics.porApp.map((a: any) => (
                    <tr key={a.app_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-800">{a.app_nombre}</td>
                      <td className={`px-4 py-3 text-center font-bold ${pctColor(a.sapp01.disponibilidad, 99, 95)}`}>{a.sapp01.disponibilidad}%</td>
                      <td className="px-4 py-3 text-center text-slate-600">{a.sapp01.incidentes}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{a.sapp01.downtimeMin}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{a.sapp02.exitosos}/{a.sapp02.ejecutados}</td>
                      <td className={`px-4 py-3 text-center font-bold ${pctColor(a.sapp02.tasa, 90, 75)}`}>{a.sapp02.tasa === null ? '—' : a.sapp02.tasa + '%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5">
              <p><strong>SAPP-01:</strong> ((Tiempo total − Tiempo inactividad) / Tiempo total) × 100 — Tiempo total = 24×7 del mes.</p>
              <p><strong>SAPP-02:</strong> Releases exitosos / Releases ejecutados × 100.</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= REGISTRO ================= */}
      {tab === 'registro' && (
        <div className="space-y-6">
          {/* Catálogos */}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowSedes(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
              <MapPin size={16} /> Sedes ({sedes.length})
            </button>
            <button onClick={() => setShowApps(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
              <Settings2 size={16} /> Aplicaciones ({apps.length})
            </button>
          </div>

          {/* Registrar incidente de indisponibilidad */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide flex items-center gap-2"><AlertTriangle size={16} /> Incidentes de indisponibilidad (SAPP-01)</div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={lbl}>Aplicación</label>
                  <select className={inp} value={inc.app_id} onChange={e => setInc({ ...inc, app_id: e.target.value })}>
                    <option value="">Selecciona…</option>{apps.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Sede</label>
                  <select className={inp} value={inc.sede_id} onChange={e => setInc({ ...inc, sede_id: e.target.value })}>
                    <option value="">Sin sede / Selecciona…</option>{sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Inicio</label><input type="datetime-local" className={inp} value={inc.inicio} onChange={e => setInc({ ...inc, inicio: e.target.value })} /></div>
                <div><label className={lbl}>Fin</label><input type="datetime-local" className={inp} value={inc.fin} onChange={e => setInc({ ...inc, fin: e.target.value })} /></div>
                <div><label className={lbl}>Causa</label><input className={inp} placeholder="Opcional" value={inc.causa} onChange={e => setInc({ ...inc, causa: e.target.value })} /></div>
                <div><label className={lbl}>Origen de la causa</label>
                  <select className={inp} value={inc.origen_causa} onChange={e => setInc({ ...inc, origen_causa: e.target.value })}>
                    <option value="">Selecciona…</option>
                    <option value="Interna">Interna</option>
                    <option value="Cliente">Cliente</option>
                  </select>
                </div>
                <div className="md:col-span-2"><label className={lbl}>Resolución</label><input className={inp} placeholder="Opcional — cómo se resolvió" value={inc.resolucion} onChange={e => setInc({ ...inc, resolucion: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {editIncId && <span className="text-xs text-amber-600 font-bold mr-auto">✎ Editando incidente #{editIncId}</span>}
                {editIncId && <button onClick={cancelInc} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50">Cancelar</button>}
                <button onClick={saveIncidente} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5">{editIncId ? <><Save size={16} /> Guardar cambios</> : <><Plus size={16} /> Agregar incidente</>}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100"><th className="py-2">App</th><th className="py-2">Sede</th><th className="py-2">Inicio</th><th className="py-2">Fin</th><th className="py-2">Causa</th><th className="py-2">Origen</th><th className="py-2">Resolución</th><th></th></tr></thead>
                  <tbody>
                    {incidentes.length === 0 ? <tr><td colSpan={8} className="py-6 text-center text-slate-400">Sin incidentes en {month}.</td></tr> :
                      incidentes.map(i => (
                        <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="py-2 font-semibold text-slate-700">{i.app_nombre || appName(i.app_id)}</td>
                          <td className="py-2 text-slate-600">{i.sede_nombre || '—'}</td>
                          <td className="py-2 text-slate-600">{fmtDateTime(i.inicio)}</td>
                          <td className="py-2 text-slate-600">{fmtDateTime(i.fin)}</td>
                          <td className="py-2 text-slate-500">{i.causa || '—'}</td>
                          <td className="py-2">{i.origen_causa
                            ? <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${i.origen_causa === 'Cliente' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{i.origen_causa}</span>
                            : <span className="text-slate-400">—</span>}</td>
                          <td className="py-2 text-slate-500">{i.resolucion || '—'}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEditInc(i)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md" title="Editar"><Edit2 size={15} /></button>
                              <button onClick={() => delIncidente(i.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" title="Eliminar"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Registrar despliegue */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide flex items-center gap-2"><Rocket size={16} /> Despliegues / releases (SAPP-02)</div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><label className={lbl}>Aplicación</label>
                  <select className={inp} value={dep.app_id} onChange={e => setDep({ ...dep, app_id: e.target.value })}>
                    <option value="">Selecciona…</option>{apps.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Fecha y hora</label><input type="datetime-local" className={inp} value={dep.fecha} onChange={e => setDep({ ...dep, fecha: e.target.value })} /></div>
                <div><label className={lbl}>Resultado</label>
                  <select className={inp} value={dep.resultado} onChange={e => setDep({ ...dep, resultado: e.target.value })}>
                    <option value="Exitoso">Exitoso</option><option value="Fallido">Fallido</option>
                  </select>
                </div>
                <div><label className={lbl}>Descripción</label><input className={inp} placeholder="Opcional (versión, etc.)" value={dep.descripcion} onChange={e => setDep({ ...dep, descripcion: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {editDepId && <span className="text-xs text-amber-600 font-bold mr-auto">✎ Editando despliegue #{editDepId}</span>}
                {editDepId && <button onClick={cancelDep} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50">Cancelar</button>}
                <button onClick={saveDespliegue} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5">{editDepId ? <><Save size={16} /> Guardar cambios</> : <><Plus size={16} /> Agregar</>}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100"><th className="py-2">App</th><th className="py-2">Fecha</th><th className="py-2">Resultado</th><th className="py-2">Descripción</th><th></th></tr></thead>
                  <tbody>
                    {despliegues.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sin despliegues en {month}.</td></tr> :
                      despliegues.map(d => (
                        <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="py-2 font-semibold text-slate-700">{d.app_nombre || appName(d.app_id)}</td>
                          <td className="py-2 text-slate-600">{fmtDateTime(d.fecha)}</td>
                          <td className="py-2">{d.resultado === 'Exitoso'
                            ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={14} /> Exitoso</span>
                            : <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><XCircle size={14} /> Fallido</span>}</td>
                          <td className="py-2 text-slate-500">{d.descripcion || '—'}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEditDep(d)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md" title="Editar"><Edit2 size={15} /></button>
                              <button onClick={() => delDespliegue(d.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" title="Eliminar"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal catálogo de aplicaciones */}
      {showApps && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowApps(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Server size={18} /> Aplicaciones críticas</h3>
              <button onClick={() => setShowApps(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex gap-2">
                <input className={inp} placeholder="Nombre (ej. ELC, MIS)" value={nuevaApp} onChange={e => setNuevaApp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addApp(); }} />
                <button onClick={addApp} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 whitespace-nowrap">Agregar</button>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1">
                {apps.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Aún no hay aplicaciones.</p> :
                  apps.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50">
                      {editApp?.id === a.id ? (
                        <>
                          <input autoFocus className={inp} value={editApp.nombre} onChange={e => setEditApp({ id: a.id, nombre: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveEditApp(); if (e.key === 'Escape') setEditApp(null); }} />
                          <button onClick={saveEditApp} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md shrink-0" title="Guardar"><Check size={16} /></button>
                          <button onClick={() => setEditApp(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md shrink-0" title="Cancelar"><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-slate-800">{a.nombre}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setEditApp({ id: a.id, nombre: a.nombre })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md" title="Editar nombre"><Edit2 size={14} /></button>
                            <button onClick={() => delApp(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" title="Desactivar"><Trash2 size={14} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal catálogo de sedes */}
      {showSedes && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSedes(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={18} /> Sedes</h3>
              <button onClick={() => setShowSedes(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex gap-2">
                <input className={inp} placeholder="Nombre de la sede" value={nuevaSede} onChange={e => setNuevaSede(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSede(); }} />
                <button onClick={addSede} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 whitespace-nowrap">Agregar</button>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1">
                {sedes.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Aún no hay sedes.</p> :
                  sedes.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50">
                      {editSede?.id === s.id ? (
                        <>
                          <input autoFocus className={inp} value={editSede.nombre} onChange={e => setEditSede({ id: s.id, nombre: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveEditSede(); if (e.key === 'Escape') setEditSede(null); }} />
                          <button onClick={saveEditSede} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md shrink-0" title="Guardar"><Check size={16} /></button>
                          <button onClick={() => setEditSede(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md shrink-0" title="Cancelar"><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-slate-800">{s.nombre}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setEditSede({ id: s.id, nombre: s.nombre })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md" title="Editar nombre"><Edit2 size={14} /></button>
                            <button onClick={() => delSede(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" title="Desactivar"><Trash2 size={14} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

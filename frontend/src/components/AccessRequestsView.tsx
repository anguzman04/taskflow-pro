import React, { useState, useEffect } from 'react';
import { Check, X, Inbox, RefreshCw } from 'lucide-react';

// window.fetch está parcheado en Dashboard (token + Content-Type). Rutas relativas /api.
const jget = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); };
const jsend = async (url: string, method: string) => {
  const r = await fetch(url, { method });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
};

export default function AccessRequestsView({ onResolved }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { setItems(await jget(`/api/access-requests${verTodas ? '' : '?estado=pendiente'}`)); }
    catch (e) { console.error('Error al listar solicitudes', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [verTodas]);

  const approve = async (id: number) => {
    try { const d = await jsend(`/api/access-requests/${id}/approve`, 'POST'); alert(d.message || 'Solicitud aprobada.'); await fetchList(); onResolved && onResolved(); }
    catch (e: any) { alert('No se pudo aprobar: ' + e.message); }
  };
  const reject = async (id: number) => {
    if (!window.confirm('¿Rechazar esta solicitud de acceso?')) return;
    try { await jsend(`/api/access-requests/${id}/reject`, 'POST'); await fetchList(); onResolved && onResolved(); }
    catch (e: any) { alert('No se pudo rechazar: ' + e.message); }
  };

  const fmt = (s: string) => s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const estadoChip = (e: string) => e === 'pendiente' ? 'bg-amber-100 text-amber-700' : e === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Aprueba o rechaza las solicitudes de acceso. Al aprobar se crea el usuario <strong>sin permisos</strong>; asígnalos luego en Gestión de Usuarios.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setVerTodas(v => !v)} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
            {verTodas ? 'Ver solo pendientes' : 'Ver todas'}
          </button>
          <button onClick={fetchList} title="Refrescar" className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Justificación</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <Inbox size={28} className="mx-auto mb-2 opacity-50" />
                  {verTodas ? 'No hay solicitudes.' : 'No hay solicitudes pendientes. 🎉'}
                </td></tr>
              ) : items.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{x.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{x.email}</td>
                  <td className="px-4 py-3 text-slate-600">{x.cargo || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{x.area || '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${x.origen === 'sso' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{x.origen === 'sso' ? 'Microsoft' : 'Manual'}</span></td>
                  <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate" title={x.justificacion || ''}>{x.justificacion || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmt(x.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {x.estado === 'pendiente' ? (
                        <>
                          <button onClick={() => approve(x.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"><Check size={14} /> Aprobar</button>
                          <button onClick={() => reject(x.id)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-all"><X size={14} /> Rechazar</button>
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${estadoChip(x.estado)}`}>{x.estado}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

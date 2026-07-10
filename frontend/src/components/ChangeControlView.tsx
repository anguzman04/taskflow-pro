import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import {
  Plus, Trash2, Download, Edit2, X, Save, ArrowLeft, Users, Search,
} from 'lucide-react';

// Opciones de los desplegables (equivalen a las listas de la plantilla / Hoja1)
const TIPO_CAMBIO = ['Normal', 'De emergencia', 'Estándar'];
const PRINCIPIOS = ['Confidencialidad', 'Disponibilidad', 'Integridad'];
const SI_NO = ['Sí', 'No'];

// Capacidades fijas de la plantilla (no se pueden exceder para mantener el Excel idéntico)
const CAP = { partes: 4, implementadores: 5, soporte: 5, antes: 5, durante: 6, rollback: 5 };
const PERSONAL_LABELS = ['Tecnología', 'Estructura', 'Otro'];

// --- Cliente HTTP: rutas relativas /api (window.fetch está parcheado en Dashboard
// para inyectar el token y el Content-Type). Así funciona igual en dev y en producción. ---
const jget = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); };
const jsend = async (url: string, method: string, body: any) => {
  const r = await fetch(url, { method, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json().catch(() => ({}));
};

// --- Conversión de fechas entre el formato de la plantilla (dd/mm/aaaa) y los
// inputs nativos (ISO aaaa-mm-dd). Las horas usan HH:mm en ambos lados. ---
const isoToDmy = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return (d && m && y) ? `${d}/${m}/${y}` : ''; };
const dmyToIso = (dmy: string) => { const m = String(dmy || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const dtLocalToDisplay = (v: string) => { if (!v) return ''; const [date, time] = v.split('T'); const [y, m, d] = date.split('-'); const dmy = `${d}/${m}/${y}`; return time ? `${dmy} - ${time}` : dmy; };
const displayToDtLocal = (s: string) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}:\d{2}))?/); if (!m) return ''; const dt = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return m[4] ? `${dt}T${m[4]}` : dt; };

const emptyActivity = () => ({ descripcion: '', responsable: '', fecha: '', horaInicio: '', horaFin: '' });
const emptyPerson = () => ({ nombre: '', rol: '', telefono: '', email: '' });

const emptyForm = () => ({
  nombre_cambio: '', fecha_hora_inicio: '', objetivo: '', fecha_hora_final: '',
  solicitado_por: '', tipo_cambio: '', organizacion: 'Atlantic Quantum Innovations SAS', version: '',
  descripcion: '', por_que: '', impacto: '', activos: '', principios_seguridad: '', trata_datos: '', bd_afectadas: '',
  resultado_previsto: '', tiempo_estimado: '', riesgos: '', factores_adicionales: '', costos: '',
  resultados: '', rev_realizado_por: '', rev_cargo: '', rev_aprobador: '',
  partes: [{ beneficios: '', efectos: '' }],
  personal: PERSONAL_LABELS.map((tipo) => ({ tipo, beneficios: '', efectos: '' })),
  implementadores: [emptyPerson()],
  soporte: [emptyPerson()],
  antes: [emptyActivity()],
  durante: [emptyActivity()],
  rollback: [emptyActivity()],
  estado: 'Borrador',
});

// --- Estilos reutilizables ---
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';
const inp = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors';

const Field = ({ label, children }: any) => (
  <div><label className={lbl}>{label}</label>{children}</div>
);

// Definido a nivel de módulo (NO dentro del componente): si estuviera dentro,
// se recrearía en cada render y React remontaría sus inputs, botando el foco
// en cada tecla.
const Section = ({ title, children }: any) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">{title}</div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

export default function ChangeControlView({ currentUser }: any) {
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [persons, setPersons] = useState<any[]>([]);
  const [showAgenda, setShowAgenda] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { setList(await jget('/api/change-controls')); }
    catch (e) { console.error('Error al listar controles de cambio', e); }
    finally { setLoading(false); }
  };
  const fetchPersons = async () => {
    try { setPersons(await jget('/api/persons')); }
    catch (e) { console.error('Error al cargar la agenda', e); }
  };

  useEffect(() => { fetchList(); fetchPersons(); }, []);

  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setRow = (section: string, i: number, k: string, v: any) =>
    setForm((f: any) => { const arr = [...f[section]]; arr[i] = { ...arr[i], [k]: v }; return { ...f, [section]: arr }; });
  const addRow = (section: string, factory: () => any) =>
    setForm((f: any) => (f[section].length >= (CAP as any)[section] ? f : { ...f, [section]: [...f[section], factory()] }));
  const removeRow = (section: string, i: number) =>
    setForm((f: any) => ({ ...f, [section]: f[section].filter((_: any, idx: number) => idx !== i) }));

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setMode('form'); };
  const openEdit = async (id: number) => {
    try {
      const d = await jget(`/api/change-controls/${id}`);
      const base = emptyForm();
      const merged: any = { ...base, ...d };
      ['partes', 'implementadores', 'soporte', 'antes', 'durante', 'rollback'].forEach((s) => {
        if (!Array.isArray(merged[s]) || merged[s].length === 0) merged[s] = base[s as keyof typeof base];
      });
      if (!Array.isArray(merged.personal) || merged.personal.length !== 3) merged.personal = base.personal;
      setForm(merged); setEditingId(id); setMode('form');
    } catch (e) { console.error('Error al abrir el control de cambio', e); alert('No se pudo abrir el registro.'); }
  };

  const handleSave = async () => {
    if (!form.nombre_cambio?.trim()) { alert('El nombre del cambio es obligatorio.'); return; }
    setSaving(true);
    try {
      if (editingId) await jsend(`/api/change-controls/${editingId}`, 'PUT', form);
      else await jsend('/api/change-controls', 'POST', form);
      await fetchList();
      setMode('list');
    } catch (e) { console.error('Error al guardar', e); alert('No se pudo guardar el control de cambios.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Eliminar el control de cambios "${nombre}"?`)) return;
    try { await jsend(`/api/change-controls/${id}`, 'DELETE', {}); fetchList(); }
    catch (e) { console.error('Error al eliminar', e); alert('No se pudo eliminar.'); }
  };

  const handleDownload = async (item: any) => {
    try {
      const res = await fetch(`/api/change-controls/${item.id}/download`);
      if (!res.ok) throw new Error(await res.text());
      const safe = (item.nombre_cambio || 'control-de-cambios').replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
      saveAs(await res.blob(), `IT-F-50-V1 Control de cambios - ${safe}.xlsx`);
    } catch (e) { console.error('Error al descargar', e); alert('No se pudo generar el Excel.'); }
  };

  // Autocompleta una fila de persona desde la agenda
  const pickPerson = (section: string, i: number, personId: string) => {
    const p = persons.find((x) => String(x.id) === personId);
    if (!p) return;
    setForm((f: any) => {
      const arr = [...f[section]];
      arr[i] = { nombre: p.nombre || '', rol: p.rol || '', telefono: p.telefono || '', email: p.email || '' };
      return { ...f, [section]: arr };
    });
  };

  const filtered = list.filter((x) =>
    !search.trim() || (x.nombre_cambio || '').toLowerCase().includes(search.toLowerCase()));

  // ============ VISTA LISTA ============
  if (mode === 'list') {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre del cambio..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAgenda(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
              <Users size={16} /> Agenda de personas
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm">
              <Plus size={16} /> Nuevo control de cambios
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Nombre del cambio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ver.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creado por</th>
                  <th className="px-4 py-3">Actualizado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {list.length === 0 ? 'Aún no hay controles de cambio. Crea el primero.' : 'Sin coincidencias con la búsqueda.'}
                  </td></tr>
                ) : filtered.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">{x.nombre_cambio}</td>
                    <td className="px-4 py-3 text-slate-600">{x.tipo_cambio || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{x.version || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">{x.estado || 'Borrador'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{x.created_by_nombre || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{x.updated_at ? new Date(x.updated_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleDownload(x)} title="Descargar Excel" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Download size={16} /></button>
                        <button onClick={() => openEdit(x.id)} title="Editar" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(x.id, x.nombre_cambio)} title="Eliminar" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAgenda && <AgendaModal persons={persons} onClose={() => setShowAgenda(false)} onChanged={fetchPersons} />}
      </div>
    );
  }

  // ============ VISTA FORMULARIO ============
  const personSelect = (section: string, i: number) => (
    <select onChange={(e) => { pickPerson(section, i, e.target.value); e.target.value = ''; }} defaultValue=""
      className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 outline-none">
      <option value="">＋ Desde agenda…</option>
      {persons.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.rol ? ` — ${p.rol}` : ''}</option>)}
    </select>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-slate-50/80 backdrop-blur z-10 py-2">
        <button onClick={() => setMode('list')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={16} /> Volver a la lista
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">{editingId ? `Editando #${editingId}` : 'Nuevo registro'}</span>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60">
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Encabezado / caso del cambio */}
      <Section title="Caso del cambio">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre del cambio *"><input className={inp} value={form.nombre_cambio} onChange={(e) => setF('nombre_cambio', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha y hora inicio"><input type="datetime-local" className={inp} value={displayToDtLocal(form.fecha_hora_inicio)} onChange={(e) => setF('fecha_hora_inicio', dtLocalToDisplay(e.target.value))} /></Field>
            <Field label="Fecha y hora final"><input type="datetime-local" className={inp} value={displayToDtLocal(form.fecha_hora_final)} onChange={(e) => setF('fecha_hora_final', dtLocalToDisplay(e.target.value))} /></Field>
          </div>
          <Field label="Objetivo"><input className={inp} value={form.objetivo} onChange={(e) => setF('objetivo', e.target.value)} /></Field>
          <Field label="Cambio solicitado por"><input className={inp} value={form.solicitado_por} onChange={(e) => setF('solicitado_por', e.target.value)} /></Field>
          <Field label="Tipo de cambio">
            <select className={inp} value={form.tipo_cambio} onChange={(e) => setF('tipo_cambio', e.target.value)}>
              <option value="">—</option>{TIPO_CAMBIO.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organización"><input className={inp} value={form.organizacion} onChange={(e) => setF('organizacion', e.target.value)} /></Field>
            <Field label="Versión No."><input className={inp} value={form.version} onChange={(e) => setF('version', e.target.value)} /></Field>
          </div>
        </div>
        <Field label="Descripción del cambio solicitado"><textarea rows={2} className={inp} value={form.descripcion} onChange={(e) => setF('descripcion', e.target.value)} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="¿Por qué se requiere el cambio?"><textarea rows={2} className={inp} value={form.por_que} onChange={(e) => setF('por_que', e.target.value)} /></Field>
          <Field label="Impacto"><textarea rows={2} className={inp} value={form.impacto} onChange={(e) => setF('impacto', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Activos de información asociados"><input className={inp} value={form.activos} onChange={(e) => setF('activos', e.target.value)} /></Field>
          <Field label="Principios de seguridad afectados">
            <select className={inp} value={form.principios_seguridad} onChange={(e) => setF('principios_seguridad', e.target.value)}>
              <option value="">—</option>{PRINCIPIOS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="¿Aplica tratamiento de datos personales?">
            <select className={inp} value={form.trata_datos} onChange={(e) => setF('trata_datos', e.target.value)}>
              <option value="">—</option>{SI_NO.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Bases de datos personales afectadas"><input className={inp} value={form.bd_afectadas} onChange={(e) => setF('bd_afectadas', e.target.value)} /></Field>
          <Field label="Resultado previsto"><input className={inp} value={form.resultado_previsto} onChange={(e) => setF('resultado_previsto', e.target.value)} /></Field>
          <Field label="Tiempo estimado del cambio"><input className={inp} value={form.tiempo_estimado} onChange={(e) => setF('tiempo_estimado', e.target.value)} placeholder="02h 00m" /></Field>
        </div>
        <Field label="Riesgos asociados al cambio"><textarea rows={2} className={inp} value={form.riesgos} onChange={(e) => setF('riesgos', e.target.value)} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Factores adicionales"><input className={inp} value={form.factores_adicionales} onChange={(e) => setF('factores_adicionales', e.target.value)} /></Field>
          <Field label="Costos estimados"><input className={inp} value={form.costos} onChange={(e) => setF('costos', e.target.value)} /></Field>
        </div>
      </Section>

      {/* Impacto partes interesadas */}
      <Section title="Impacto de las partes interesadas">
        {form.partes.map((p: any, i: number) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end border-b border-slate-100 pb-3 last:border-0">
            <div className="text-xs font-bold text-slate-500 md:pb-2">Parte {i + 1}</div>
            <Field label="Beneficios potenciales"><input className={inp} value={p.beneficios || ''} onChange={(e) => setRow('partes', i, 'beneficios', e.target.value)} /></Field>
            <Field label="Posibles efectos adversos"><input className={inp} value={p.efectos || ''} onChange={(e) => setRow('partes', i, 'efectos', e.target.value)} /></Field>
            <button onClick={() => removeRow('partes', i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg md:mb-1"><Trash2 size={16} /></button>
          </div>
        ))}
        {form.partes.length < CAP.partes && (
          <button onClick={() => addRow('partes', () => ({ beneficios: '', efectos: '' }))} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={14} /> Agregar parte interesada ({form.partes.length}/{CAP.partes})</button>
        )}
      </Section>

      {/* Impacto en el personal y las operaciones (3 filas fijas) */}
      <Section title="Impacto en el personal y las operaciones">
        {form.personal.map((p: any, i: number) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr] gap-3 items-end">
            <div className="text-xs font-bold text-slate-500 md:pb-2">{PERSONAL_LABELS[i]}</div>
            <Field label="Beneficios potenciales"><input className={inp} value={p.beneficios || ''} onChange={(e) => setRow('personal', i, 'beneficios', e.target.value)} /></Field>
            <Field label="Posibles efectos adversos"><input className={inp} value={p.efectos || ''} onChange={(e) => setRow('personal', i, 'efectos', e.target.value)} /></Field>
          </div>
        ))}
      </Section>

      {/* Implementadores y soporte */}
      <PeopleSection title="Implementadores del cambio" section="implementadores" form={form} setRow={setRow} addRow={addRow} removeRow={removeRow} cap={CAP.implementadores} personSelect={personSelect} emptyPerson={emptyPerson} />
      <PeopleSection title="Personal de soporte (soporte técnico)" section="soporte" form={form} setRow={setRow} addRow={addRow} removeRow={removeRow} cap={CAP.soporte} personSelect={personSelect} emptyPerson={emptyPerson} />

      {/* Cronogramas */}
      <ActivitySection title="Actividades antes del cambio" section="antes" form={form} setRow={setRow} addRow={addRow} removeRow={removeRow} cap={CAP.antes} persons={persons} />
      <ActivitySection title="Actividades durante la ventana del cambio" section="durante" form={form} setRow={setRow} addRow={addRow} removeRow={removeRow} cap={CAP.durante} persons={persons} />
      <ActivitySection title="Plan de contingencia (Rollback)" section="rollback" form={form} setRow={setRow} addRow={addRow} removeRow={removeRow} cap={CAP.rollback} persons={persons} />

      {/* Resultados */}
      <Section title="Resultados al ejecutar el cambio">
        <textarea rows={4} className={inp} value={form.resultados} onChange={(e) => setF('resultados', e.target.value)} placeholder="Describe los resultados obtenidos..." />
      </Section>

      {/* Control de revisión */}
      <Section title="Control de revisión">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Realizado por"><input className={inp} value={form.rev_realizado_por} onChange={(e) => setF('rev_realizado_por', e.target.value)} /></Field>
          <Field label="Cargo"><input className={inp} value={form.rev_cargo} onChange={(e) => setF('rev_cargo', e.target.value)} /></Field>
          <Field label="Aprobador"><input className={inp} value={form.rev_aprobador} onChange={(e) => setF('rev_aprobador', e.target.value)} /></Field>
        </div>
      </Section>

      <div className="flex justify-end pb-10">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60">
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar control de cambios'}
        </button>
      </div>

      {showAgenda && <AgendaModal persons={persons} onClose={() => setShowAgenda(false)} onChanged={fetchPersons} />}
    </div>
  );
}

// --- Sección de personas (implementadores / soporte) ---
function PeopleSection({ title, section, form, setRow, addRow, removeRow, cap, personSelect, emptyPerson }: any) {
  const rows = form[section];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">{title}</div>
      <div className="p-5 space-y-3">
        {rows.map((p: any, i: number) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1.4fr_1.2fr_1fr_1.6fr_auto_auto] gap-2 items-center">
            <input className={inp} placeholder="Nombre" value={p.nombre || ''} onChange={(e) => setRow(section, i, 'nombre', e.target.value)} />
            <input className={inp} placeholder="Rol" value={p.rol || ''} onChange={(e) => setRow(section, i, 'rol', e.target.value)} />
            <input className={inp} placeholder="Teléfono" value={p.telefono || ''} onChange={(e) => setRow(section, i, 'telefono', e.target.value)} />
            <input className={inp} placeholder="Email" value={p.email || ''} onChange={(e) => setRow(section, i, 'email', e.target.value)} />
            {personSelect(section, i)}
            <button onClick={() => removeRow(section, i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
          </div>
        ))}
        {rows.length < cap && (
          <button onClick={() => addRow(section, emptyPerson)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={14} /> Agregar ({rows.length}/{cap})</button>
        )}
      </div>
    </div>
  );
}

// --- Sección de actividades (cronogramas) ---
function ActivitySection({ title, section, form, setRow, addRow, removeRow, cap, persons }: any) {
  const rows = form[section];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">{title}</div>
      <div className="p-5 space-y-3">
        <datalist id="cc-personas">{persons.map((p: any) => <option key={p.id} value={p.nombre} />)}</datalist>
        {rows.map((a: any, i: number) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[28px_2fr_1.2fr_1.1fr_0.9fr_0.9fr_auto] gap-2 items-center">
            <div className="text-xs font-bold text-slate-400 text-center">{i + 1}</div>
            <input className={inp} placeholder="Descripción de la actividad" value={a.descripcion || ''} onChange={(e) => setRow(section, i, 'descripcion', e.target.value)} />
            <input className={inp} list="cc-personas" placeholder="Responsable" value={a.responsable || ''} onChange={(e) => setRow(section, i, 'responsable', e.target.value)} />
            <input type="date" className={inp} title="Fecha" value={dmyToIso(a.fecha)} onChange={(e) => setRow(section, i, 'fecha', isoToDmy(e.target.value))} />
            <input type="time" className={inp} title="Hora de inicio" value={a.horaInicio || ''} onChange={(e) => setRow(section, i, 'horaInicio', e.target.value)} />
            <input type="time" className={inp} title="Hora de fin" value={a.horaFin || ''} onChange={(e) => setRow(section, i, 'horaFin', e.target.value)} />
            <button onClick={() => removeRow(section, i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
          </div>
        ))}
        {rows.length < cap && (
          <button onClick={() => addRow(section, () => ({ descripcion: '', responsable: '', fecha: '', horaInicio: '', horaFin: '' }))} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={14} /> Agregar actividad ({rows.length}/{cap})</button>
        )}
      </div>
    </div>
  );
}

// --- Modal de agenda de personas ---
function AgendaModal({ persons, onClose, onChanged }: any) {
  const [nuevo, setNuevo] = useState(emptyPerson());
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!nuevo.nombre?.trim()) { alert('El nombre es obligatorio.'); return; }
    setBusy(true);
    try {
      if (editId) await jsend(`/api/persons/${editId}`, 'PUT', nuevo);
      else await jsend('/api/persons', 'POST', nuevo);
      setNuevo(emptyPerson()); setEditId(null); await onChanged();
    } catch (e) { console.error(e); alert('No se pudo guardar la persona.'); }
    finally { setBusy(false); }
  };
  const edit = (p: any) => { setEditId(p.id); setNuevo({ nombre: p.nombre || '', rol: p.rol || '', telefono: p.telefono || '', email: p.email || '' }); };
  const del = async (id: number) => {
    if (!window.confirm('¿Quitar esta persona de la agenda?')) return;
    try { await jsend(`/api/persons/${id}`, 'DELETE', {}); await onChanged(); } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} /> Agenda de personas</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className={inp} placeholder="Nombre *" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            <input className={inp} placeholder="Rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })} />
            <input className={inp} placeholder="Teléfono" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
            <input className={inp} placeholder="Email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-60">{editId ? 'Actualizar' : 'Agregar persona'}</button>
            {editId && <button onClick={() => { setEditId(null); setNuevo(emptyPerson()); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200">Cancelar</button>}
          </div>
          <div className="border-t border-slate-100 pt-3 space-y-1">
            {persons.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">La agenda está vacía.</p> :
              persons.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.nombre}{p.rol ? <span className="font-normal text-slate-500"> — {p.rol}</span> : ''}</p>
                    <p className="text-xs text-slate-400 truncate">{[p.telefono, p.email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => edit(p)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md"><Edit2 size={14} /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

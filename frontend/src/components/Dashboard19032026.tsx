import React, { useState, useEffect } from 'react';
import { Task, Priority, Status, Area, User } from './types';
import { 
  Plus, Search, Filter, Edit2, Trash2, ChevronDown, CheckCircle2,
  Clock, AlertCircle, Calendar, User as UserIcon, Building2,
  FileText, Users, LayoutDashboard, Settings, X, Shield,
  LogOut, Bell, Eye, MessageSquare, Paperclip, History,
  Download, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- INTERCEPTOR MAGICO V3 ---
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.includes('/api/me')) {
    return new Response(localStorage.getItem('user'), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    const isFormData = config.body instanceof FormData; 
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }) 
    };
    resource = `http://localhost:3000${resource}`; 
  }
  return originalFetch(resource, config);
};

// --- COLORES Y DISEÑO ---
const getPriorityColor = (p: string) => {
  const str = String(p || '').toUpperCase();
  if (str.includes('MUY ALTA')) return 'bg-red-100 text-red-700 border-red-200';
  if (str.includes('ALTA')) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (str.includes('MEDIA')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (str.includes('MUY BAJA')) return 'bg-slate-50 text-slate-500 border-slate-100';
  if (str.includes('BAJA')) return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
};

const getPriorityLabel = (p: string) => {
  const str = String(p || '');
  if (str.toUpperCase().includes('MUY ALTA')) return 'Muy Alta';
  if (str.toUpperCase().includes('ALTA')) return 'Alta';
  if (str.toUpperCase().includes('MEDIA')) return 'Media';
  if (str.toUpperCase().includes('MUY BAJA')) return 'Muy Baja';
  if (str.toUpperCase().includes('BAJA')) return 'Baja';
  return str.includes('|') ? str.split('|')[1] : str;
};

const getStatusColor = (s: string) => {
  const str = String(s || '').toUpperCase();
  if (str.includes('PENDIENTE')) return 'bg-slate-100 text-slate-600';
  if (str.includes('PROGRESO')) return 'bg-blue-100 text-blue-600';
  if (str.includes('REVISIÓN') || str.includes('REVISION')) return 'bg-amber-100 text-amber-700';
  if (str.includes('COMPLETADO')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
};

// --- COLORES ESPECÍFICOS PARA LA GRÁFICA DE BARRAS ---
const getChartColor = (p: string) => {
  const str = String(p || '').toUpperCase();
  if (str.includes('MUY ALTA')) return '#ef4444'; // Rojo
  if (str.includes('ALTA')) return '#f97316'; // Naranja
  if (str.includes('MEDIA')) return '#3b82f6'; // Azul
  return '#94a3b8'; // Gris para Baja y Muy Baja
};

// --- LOGICA DE SEMÁFORO DE PORCENTAJES ---
const getProgressBarColor = (percent: number) => {
  if (percent < 35) return 'bg-red-500';
  if (percent < 75) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const getProgressTextColor = (percent: number) => {
  if (percent < 35) return 'text-red-600';
  if (percent < 75) return 'text-amber-600';
  return 'text-emerald-600';
};

type View = 'tasks' | 'users' | 'areas' | 'control';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [taskTab, setTaskTab] = useState<'personal' | 'team'>('personal');
  const [currentUser, setCurrentUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(() => !!localStorage.getItem('token'));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formJefe, setFormJefe] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedAreas, setSelectedAreas] = useState<number[]>([]);
  const [accesoSupervision, setAccesoSupervision] = useState(false);
  const [controlAreaId, setControlAreaId] = useState<number | null>(null);
  const [controlTasks, setControlTasks] = useState<Task[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'comments' | 'attachments' | 'history'>('comments');

  const canViewUsers = currentUser?.is_admin || currentUser?.perm_users_view;
  const canViewAreas = currentUser?.is_admin || currentUser?.perm_areas_view;
  const canCreateInCurrentView = () => {
    if (currentView === 'tasks') return currentUser?.can_create_tasks;
    if (currentView === 'users') return currentUser?.is_admin || currentUser?.perm_users_create;
    if (currentView === 'areas') return currentUser?.is_admin || currentUser?.perm_areas_create;
    return false;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.actividad.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || task.estado === statusFilter;
    
    if (currentView === 'tasks' && currentUser) {
      const normalizeText = (text: string) => 
        text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';

      const miNombre = normalizeText(`${currentUser.nombre} ${currentUser.apellido}`);
      const responsableTarea = normalizeText(task.responsable);

      const isMyTask = miNombre === responsableTarea;

      if (taskTab === 'personal') return matchesSearch && matchesStatus && isMyTask;
      
      if (taskTab === 'team') {
        if (isMyTask) return false; 
        if (currentUser.is_admin) return matchesSearch && matchesStatus;

        const responsableObj = allUsers.find(u => normalizeText(`${u.nombre} ${u.apellido}`) === responsableTarea);

        if (responsableObj && responsableObj.area_id) {
          const areaDelResponsable = areas.find(a => a.id === responsableObj.area_id);
          const soyJefeDirecto = areaDelResponsable?.jefe_id === currentUser.id;
          const soyJefePadre = areaDelResponsable?.parent_area_id 
            ? areas.find(a => a.id === areaDelResponsable.parent_area_id)?.jefe_id === currentUser.id 
            : false;

          if (soyJefeDirecto || soyJefePadre) return matchesSearch && matchesStatus;
        }
        return false;
      }
    }
    return matchesSearch && matchesStatus;
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setNotifications(data);
        else setNotifications([]);
      } else {
        setNotifications([]);
      }
    } catch (err) { console.error("Error fetching notifications:", err); setNotifications([]); }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const checkSession = async () => {
      if (isLoggedIn) {
        await fetchAreas();
        await fetchUsers();
        await fetchNotifications();
        intervalId = setInterval(() => { fetchNotifications(); }, 15000);
      } else setIsLoggedIn(false);
      setLoading(false);
    };
    checkSession();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) fetchTasks();
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (editingItem && currentView === 'users') {
      const area = areas.find(a => a.id === editingItem.area_id);
      let bossName = 'Pendiente de asignar';
      if (area) {
        if (area.jefe_id === editingItem.id) {
          const parentArea = areas.find(a => a.id === area.parent_area_id);
          bossName = parentArea?.jefe_nombre || 'DIRECCION';
        } else bossName = area.jefe_nombre || 'Pendiente de asignar';
      }
      setFormJefe(bossName);
      setAccesoSupervision(!!editingItem.acceso_supervision);
      setSelectedAreas(editingItem.areas_autorizadas ? editingItem.areas_autorizadas.split(',').map(Number) : []);
    } else {
      setFormJefe('');
      setAccesoSupervision(false);
      setSelectedAreas([]);
    }
  }, [editingItem, currentView, areas]);

  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/areas');
      if (res.status === 401) return setIsLoggedIn(false);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAreas(data);
        const rootArea = data.find((a: Area) => !a.parent_area_id);
        if (rootArea && rootArea.id) setExpandedAreas(new Set([rootArea.id]));
      }
    } catch (err) { console.error("Error fetching areas:", err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) return setIsLoggedIn(false);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllUsers(data);
        if (data.length > 0 && !currentUser) setCurrentUser(data[0]);
      }
    } catch (err) { console.error("Error fetching users:", err); }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'PUT' });
      fetchNotifications();
    } catch (err) { console.error("Error marking notifications as read:", err); }
  };

  const handleNotificationClick = async (notif: any) => {
    const targetTaskId = Number(notif.task_id || notif.taskId);
    if (targetTaskId) {
      let taskToOpen = tasks.find(t => t.id == targetTaskId) || controlTasks.find(t => t.id == targetTaskId);
      if (!taskToOpen) {
        try {
          const res = await fetch(`/api/tasks?userId=${currentUser?.id}`);
          const freshTasks = await res.json();
          if (Array.isArray(freshTasks)) {
            setTasks(freshTasks);
            taskToOpen = freshTasks.find((t: Task) => t.id == targetTaskId);
          }
        } catch (err) { console.error("Error descargando tareas:", err); }
      }
      if (taskToOpen) {
        setSelectedTask(taskToOpen);
        setDetailsTab('comments'); 
        setIsDetailsModalOpen(true);
        fetchTaskDetails(taskToOpen.id!);
        setShowNotifications(false); 
      } else alert(`La tarea #${targetTaskId} no se encontró en tu vista actual.`);
    }
  };

  const fetchTaskDetails = async (taskId: number) => {
    try {
      const [logsRes, attachmentsRes, commentsRes] = await Promise.all([
        fetch(`/api/audit-logs/${taskId}`), fetch(`/api/attachments/${taskId}`), fetch(`/api/comments/${taskId}`)
      ]);
      if (logsRes.ok) setAuditLogs(await logsRes.json());
      if (attachmentsRes.ok) setAttachments(await attachmentsRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
    } catch (err) { console.error("Error fetching task details:", err); }
  };
  
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/comments`, {
        method: 'POST', body: JSON.stringify({ task_id: selectedTask.id, content: newComment })
      });
      if (res.ok) { setNewComment(''); fetchTaskDetails(selectedTask.id!); }
    } catch (err) { console.error("Error posting comment", err); }
    finally { setIsSubmittingComment(false); }
  };

  // --- FUNCIÓN RESTAURADA PARA SUBIR EVIDENCIAS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.[0]) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      const res = await fetch(`/api/attachments/${selectedTask.id}`, { method: 'POST', body: formData });
      if (res.ok) fetchTaskDetails(selectedTask.id!);
    } catch (err) { console.error("Error uploading file:", err); } 
    finally { setIsUploading(false); }
  };

  const fetchTasks = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/tasks?userId=${currentUser.id}`);
      if (res.status === 401) return setIsLoggedIn(false);
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch (err) { console.error("Error fetching tasks:", err); }
  };

  const fetchControlTasks = async () => {
    if (!currentUser || !currentUser.acceso_supervision) return;
    try {
      const url = `/api/control/tasks?userId=${currentUser.id}${controlAreaId ? `&areaId=${controlAreaId}` : ''}`;
      const res = await fetch(url);
      if (res.status === 401) return setIsLoggedIn(false);
      const data = await res.json();
      if (Array.isArray(data)) setControlTasks(data);
    } catch (err) { console.error("Error fetching control tasks:", err); }
  };

  useEffect(() => {
    if (currentView === 'control') fetchControlTasks();
  }, [currentView, controlAreaId, currentUser]);

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
  };

  const calculateElapsedDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    today.setHours(0, 0, 0, 0); startDate.setHours(0, 0, 0, 0); endDate.setHours(0, 0, 0, 0);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    if (today < startDate) return 0;
    const targetDate = today > endDate ? endDate : today;
    const diffTime = targetDate.getTime() - startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const UniversalMetrics = ({ tasksData }: { tasksData: Task[] }) => {
    const pending = tasksData.filter(t => t.estado === 'Pendiente').length;
    const inProgress = tasksData.filter(t => t.estado === 'En Progreso').length;
    const inReview = tasksData.filter(t => t.estado === 'En Revisión').length;
    const completed = tasksData.filter(t => t.estado === 'Completado').length;
    
    const avgProgressRaw = tasksData.length > 0 ? (tasksData.reduce((acc, t) => acc + t.porcentaje_avance, 0) / tasksData.length) : 0;
    const avgProgress = avgProgressRaw.toFixed(1);

    const pieData = [
      { name: 'Pendiente', value: pending, color: '#94a3b8' },
      { name: 'En Progreso', value: inProgress, color: '#3b82f6' },
      { name: 'En Revisión', value: inReview, color: '#f59e0b' },
      { name: 'Completado', value: completed, color: '#10b981' }
    ].filter(d => d.value > 0);

    const priorityStats = ['0|Muy Alta', '1|Alta', '2|Media', '3|Baja', '4|Muy Baja'].map(p => {
      const t = tasksData.filter(task => task.prioridad === p);
      const avg = t.length > 0 ? t.reduce((acc, curr) => acc + curr.porcentaje_avance, 0) / t.length : 0;
      return {
        name: getPriorityLabel(p),
        Avance: Math.round(avg),
        count: t.length, 
        fill: getChartColor(p) 
      };
    }).filter(stat => stat.count > 0); 

    return (
      <div className="mb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><LayoutDashboard size={14} /></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progreso Global</span>
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-black ${getProgressTextColor(avgProgressRaw)}`}>{avgProgress}%</span>
              <span className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase">Promedio</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg"><Clock size={14} /></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendientes</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{pending}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Eye size={14} /></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Revisión</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{inReview}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={14} /></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completadas</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{completed}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon size={16} className="text-slate-400"/>
              <span className="text-sm font-bold text-slate-900">Distribución por Estado</span>
            </div>
            <div className="h-64 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieData} innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              ) : <span className="text-slate-400 text-sm">No hay datos</span>}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} className="text-slate-400"/>
              <span className="text-sm font-bold text-slate-900">Avance Promedio según Prioridad</span>
            </div>
            <div className="h-64">
              {priorityStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="Avance" radius={[4, 4, 0, 0]} maxBarSize={40}>{priorityStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center"><span className="text-slate-400 text-sm">No hay tareas para graficar</span></div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const formData = new FormData(e.currentTarget);
      const taskData = {
        actividad: formData.get('actividad'), responsable: formData.get('responsable'), fecha_registro: formData.get('fecha_registro'),
        fecha_inicio: formData.get('fecha_inicio'), fecha_fin: formData.get('fecha_fin'), prioridad: formData.get('prioridad'),
        prerequisito: formData.get('prerequisito'), observacion: formData.get('observacion'), porcentaje_avance: parseFloat(formData.get('porcentaje_avance') as string) || 0,
        estado: formData.get('estado'), created_by_id: currentUser.id
      };
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/tasks/${editingItem.id}` : '/api/tasks';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
      if (res.status === 401) return setIsLoggedIn(false);
      if (res.ok) { setIsModalOpen(false); fetchTasks(); }
    } catch (err) { console.error("Error submitting task:", err); }
  };

  const handleExportExcel = async () => {
    const tasksToExport = currentView === 'tasks' ? filteredTasks : controlTasks;
    if (tasksToExport.length === 0) return alert("No hay tareas para exportar.");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Tareas');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 }, { header: 'Actividad', key: 'actividad', width: 45 },
      { header: 'Responsable', key: 'responsable', width: 25 }, { header: 'Área', key: 'area', width: 25 },
      { header: 'Estado', key: 'estado', width: 15 }, { header: '% Avance', key: 'avance', width: 15 },
      { header: 'Prioridad', key: 'prioridad', width: 15 }, { header: 'Fecha Registro', key: 'fechaRegistro', width: 18 },
      { header: 'Fecha Inicio', key: 'fechaInicio', width: 18 }, { header: 'Fecha Fin', key: 'fechaFin', width: 18 },
      { header: 'Observaciones', key: 'observaciones', width: 60 }
    ];
    tasksToExport.forEach(task => {
      const respUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === task.responsable);
      const areaName = areas.find(a => a.id === respUser?.area_id)?.nombre || 'Sin Área';
      worksheet.addRow({
        id: task.id, actividad: task.actividad, responsable: task.responsable, area: areaName,
        estado: task.estado, avance: `${task.porcentaje_avance}%`, prioridad: getPriorityLabel(task.prioridad),
        fechaRegistro: task.fecha_registro, fechaInicio: task.fecha_inicio, fechaFin: task.fecha_fin, observaciones: task.observacion || 'Sin observaciones'
      });
    });
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_TaskFlow_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = async (id: number, type: View) => {
    if (!confirm(`¿Estás seguro de eliminar?`)) return;
    try {
      const res = await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
      if (res.ok) { if (type === 'tasks') fetchTasks(); if (type === 'users') fetchUsers(); if (type === 'areas') fetchAreas(); }
    } catch (err) { alert("Error al eliminar."); }
  };

  const handleAreaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const areaData = {
        nombre: formData.get('nombre'), descripcion: formData.get('descripcion'),
        jefe_id: formData.get('jefe_id') ? parseInt(formData.get('jefe_id') as string) : null,
        parent_area_id: formData.get('parent_area_id') ? parseInt(formData.get('parent_area_id') as string) : null,
      };
      const res = await fetch(editingItem ? `/api/areas/${editingItem.id}` : '/api/areas', {
        method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(areaData)
      });
      if (res.ok) { setIsModalOpen(false); fetchAreas(); fetchUsers(); }
    } catch (err) {}
  };

  const handleUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const userData = {
        nombre: formData.get('nombre'), apellido: formData.get('apellido'), cargo: formData.get('cargo'),
        jefe_directo: formJefe, area_id: formData.get('area_id') ? parseInt(formData.get('area_id') as string) : null,
        email: formData.get('email'), password: formData.get('password') || undefined,
        is_admin: formData.get('is_admin') === 'on' ? 1 : 0, can_create_tasks: formData.get('can_create_tasks') === 'on' ? 1 : 0,
        can_edit_tasks: formData.get('can_edit_tasks') === 'on' ? 1 : 0, can_delete_tasks: formData.get('can_delete_tasks') === 'on' ? 1 : 0,
        acceso_supervision: accesoSupervision ? 1 : 0, areas_autorizadas: selectedAreas.join(','),
        perm_users_view: formData.get('perm_users_view') === 'on' ? 1 : 0, perm_users_create: formData.get('perm_users_create') === 'on' ? 1 : 0,
        perm_users_edit: formData.get('perm_users_edit') === 'on' ? 1 : 0, perm_users_delete: formData.get('perm_users_delete') === 'on' ? 1 : 0,
        perm_areas_view: formData.get('perm_areas_view') === 'on' ? 1 : 0, perm_areas_create: formData.get('perm_areas_create') === 'on' ? 1 : 0,
        perm_areas_edit: formData.get('perm_areas_edit') === 'on' ? 1 : 0, perm_areas_delete: formData.get('perm_areas_delete') === 'on' ? 1 : 0,
      };
      const res = await fetch(editingItem ? `/api/users/${editingItem.id}` : '/api/users', {
        method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData)
      });
      if (res.ok) { setIsModalOpen(false); fetchUsers(); }
    } catch (err) {}
  };

  const toggleArea = (id: number) => {
    setExpandedAreas(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const renderAreaTree = (parentId: number | null = null, level: number = 0): React.ReactNode => {
    const children = areas.filter(a => (parentId === null ? !a.parent_area_id : a.parent_area_id === parentId));
    return children.map((area, index) => {
      const isExpanded = expandedAreas.has(area.id!);
      const hasChildren = areas.some(a => a.parent_area_id === area.id);
      return (
        <React.Fragment key={area.id}>
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 ml-${level * 8}`}>
             <h3 className="font-bold text-slate-900 flex justify-between">
                <span onClick={() => hasChildren && toggleArea(area.id!)} className="cursor-pointer">{area.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingItem(area); setIsModalOpen(true); }}><Edit2 size={14}/></button>
                  <button onClick={() => handleDelete(area.id!, 'areas')}><Trash2 size={14}/></button>
                </div>
             </h3>
             <p className="text-xs text-slate-500">{area.descripcion}</p>
          </div>
          {isExpanded && renderAreaTree(area.id!, level + 1)}
        </React.Fragment>
      );
    });
  };

  if (isLoggedIn === null) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-medium text-slate-500">Cargando...</div>;

  const currentViewTasks = currentView === 'tasks' ? filteredTasks : controlTasks;
  const headerAvgProgressRaw = currentViewTasks.length > 0 ? (currentViewTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / currentViewTasks.length) : 0;
  const headerAvgProgress = headerAvgProgressRaw.toFixed(1);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen z-20">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><LayoutDashboard size={18} /></div>
            TaskFlow Pro
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setCurrentView('tasks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'tasks' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={18} /> Panel de Actividades</button>
          {canViewUsers && <button onClick={() => setCurrentView('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'users' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={18} /> Gestión de Usuarios</button>}
          {canViewAreas && <button onClick={() => setCurrentView('areas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'areas' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 size={18} /> Gestión de Áreas</button>}
          {(currentUser?.acceso_supervision || currentUser?.is_admin) && <button onClick={() => setCurrentView('control')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'control' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={18} /> Control de Gestión</button>}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {currentUser && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm uppercase">{(currentUser.nombre?.charAt(0) || '')}{(currentUser.apellido?.charAt(0) || '')}</div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser.nombre} {currentUser.apellido}</p>
                <p className="text-[10px] font-medium text-slate-500 truncate">{(currentUser as any).cargo || currentUser.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all"><LogOut size={18} /> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen">
        <header className="bg-white border-b border-slate-200 px-8 pt-8 pb-0 sticky top-0 z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center">
                <div>
                  {currentView === 'tasks' ? (
                    <>
                      <div className="flex items-center gap-4 mb-1">
                        <button onClick={() => setTaskTab('personal')} className={`text-2xl font-bold transition-all ${taskTab === 'personal' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}>Mis Tareas</button>
                        <button onClick={() => setTaskTab('team')} className={`text-2xl font-bold transition-all ${taskTab === 'team' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}>Equipo</button>
                      </div>
                      <p className="text-slate-500 text-sm">Gestiona y supervisa las actividades</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 capitalize">{currentView === 'users' ? 'Gestión de Usuarios' : currentView === 'areas' ? 'Gestión de Áreas' : 'Control de Gestión'}</h2>
                      <p className="text-slate-500 text-sm">Administración y supervisión del sistema</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {(currentView === 'tasks' || currentView === 'control') && (
                    <div className="hidden lg:flex bg-slate-50 rounded-xl px-4 py-2 border border-slate-200 items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progreso Real</div>
                        <div className={`text-sm font-bold ${getProgressTextColor(headerAvgProgressRaw)}`}>
                          {headerAvgProgress}%
                        </div>
                      </div>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressBarColor(headerAvgProgressRaw)}`} style={{ width: `${headerAvgProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 relative transition-all active:scale-95">
                      <Bell size={20} />
                      {notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />}
                    </button>
                    <AnimatePresence>
                      {showNotifications && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="font-bold text-slate-900 text-sm">Notificaciones</h4>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{notifications.filter(n => !n.read).length} Nuevas</span>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm italic">No hay notificaciones</div> : (
                              notifications.map(n => (
                                <div key={n.id} onClick={() => handleNotificationClick(n)} className={`cursor-pointer p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
                                  <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                                  <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.created_at).toLocaleString()}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {(currentView === 'tasks' || currentView === 'control') && (
                    <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                      <Download size={18} /> Exportar Excel
                    </button>
                  )}

                  {canCreateInCurrentView() && (
                    <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
                      <Plus size={18} /> {currentView === 'tasks' ? 'Nueva Tarea' : currentView === 'users' ? 'Nuevo Usuario' : 'Nueva Área'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {currentView === 'tasks' && (
            <>
              <UniversalMetrics tasksData={filteredTasks} />

              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Buscar actividad..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="All">Todos los Estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Completado">Completado</option>
                </select>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actividad</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registro</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inicio / Fin</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Días</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prioridad</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avance</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsable</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className={`hover:bg-slate-50 transition-colors group ${task.estado === 'Completado' ? 'bg-emerald-50/10' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{task.actividad}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{task.fecha_registro}</td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-700 font-bold">{task.fecha_inicio}</div>
                          <div className="text-[10px] text-slate-400">{task.fecha_fin}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-lg">
                            {calculateElapsedDays(task.fecha_inicio, task.fecha_fin)} d
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getPriorityColor(task.prioridad)}`}>
                            {getPriorityLabel(task.prioridad)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getProgressBarColor(task.porcentaje_avance)}`} style={{ width: `${task.porcentaje_avance}%` }} />
                            </div>
                            <span className={`text-[10px] font-bold ${getProgressTextColor(task.porcentaje_avance)}`}>{task.porcentaje_avance}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(task.estado)}`}>
                            {task.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            <span className="text-[10px] font-bold text-slate-700 uppercase">
                              {task.responsable}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            {/* --- SOLO EL BOTON DE DETALLES Y EL DE EDITAR EN LA TABLA --- */}
                            <button onClick={() => { setSelectedTask(task); setDetailsTab('comments'); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} className="text-slate-400 hover:text-indigo-600 transition-colors">
                              <Eye size={16} />
                            </button>
                            {currentUser?.can_edit_tasks && (
                              <button onClick={() => { setEditingItem(task); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-600 transition-colors">
                                <Edit2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {currentView === 'control' && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filtro Maestro por Área</h3>
                    <p className="text-sm text-slate-500">Selecciona un área para visualizar todas sus actividades</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Filter className="text-slate-400" size={20} />
                    <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[240px]" value={controlAreaId || ''} onChange={(e) => setControlAreaId(e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">Todas las Áreas Autorizadas</option>
                      {areas.filter(a => currentUser?.areas_autorizadas?.split(',').includes(a.id!.toString())).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <UniversalMetrics tasksData={controlTasks} />

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actividad</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsable</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inicio / Fin</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prioridad</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avance</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {controlTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{task.actividad}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                              {task.responsable.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-700">{task.responsable}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase">
                            {(() => {
                              const respUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === task.responsable);
                              const area = areas.find(a => a.id === respUser?.area_id);
                              return area ? area.nombre : 'Sin Área';
                            })()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-700 font-bold">{task.fecha_inicio}</div>
                          <div className="text-[10px] text-slate-400">{task.fecha_fin}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getPriorityColor(task.prioridad)}`}>
                            {getPriorityLabel(task.prioridad)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(task.estado)}`}>
                            {task.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getProgressBarColor(task.porcentaje_avance)}`} style={{ width: `${task.porcentaje_avance}%` }} />
                            </div>
                            <span className={`text-[10px] font-bold ${getProgressTextColor(task.porcentaje_avance)}`}>{task.porcentaje_avance}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                             {/* --- SOLO EL BOTON DE DETALLES EN LA TABLA --- */}
                            <button onClick={() => { setSelectedTask(task); setDetailsTab('comments'); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Detalles">
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {currentView === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allUsers.map(user => (
                <div key={user.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group relative">
                   <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user.is_admin ? 'bg-red-100 text-red-600 shadow-sm shadow-red-100' : 'bg-slate-100 text-slate-400'}`}>
                      {user.is_admin ? <Shield size={24} /> : <UserIcon size={24} />}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(currentUser?.is_admin || currentUser?.perm_users_edit) && (
                        <button onClick={() => { setEditingItem(user); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      )}
                      {(currentUser?.is_admin || currentUser?.perm_users_delete) && (
                        <button onClick={() => handleDelete(user.id!, 'users')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{user.nombre} {user.apellido}</h3>
                    {user.is_admin ? <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Admin</span> : null}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{user.cargo} • {(user as any).area_nombre || 'Sin Área'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">{editingItem ? 'Editar' : 'Nuevo'} {currentView === 'tasks' ? 'Tarea' : currentView === 'users' ? 'Usuario' : 'Área'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>

              <form onSubmit={currentView === 'tasks' ? handleTaskSubmit : currentView === 'users' ? handleUserSubmit : handleAreaSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {currentView === 'tasks' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Actividad</label>
                        <input name="actividad" required defaultValue={editingItem?.actividad} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Registro</label>
                        <input name="fecha_registro" type="date" readOnly defaultValue={editingItem?.fecha_registro || new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-not-allowed text-slate-500" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Responsable</label>
                        <select name="responsable" required defaultValue={editingItem?.responsable} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                          <option value="">Seleccionar Responsable</option>
                          {allUsers.map(u => <option key={u.id} value={`${u.nombre} ${u.apellido}`}>{u.nombre} {u.apellido}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">% Avance</label>
                        <input name="porcentaje_avance" type="number" min="0" max="100" required defaultValue={editingItem?.porcentaje_avance || 0} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Inicio</label>
                        <input name="fecha_inicio" type="date" required defaultValue={editingItem?.fecha_inicio} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Fin</label>
                        <input name="fecha_fin" type="date" required defaultValue={editingItem?.fecha_fin} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Prioridad</label>
                        <select name="prioridad" defaultValue={editingItem?.prioridad || '2|Media'} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                          <option value="0|Muy Alta">Muy Alta</option>
                          <option value="1|Alta">Alta</option>
                          <option value="2|Media">Media</option>
                          <option value="3|Baja">Baja</option>
                          <option value="4|Muy Baja">Muy Baja</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label>
                        <select name="estado" defaultValue={editingItem?.estado || 'Pendiente'} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Progreso">En Progreso</option>
                          <option value="En Revisión">En Revisión</option>
                          <option value="Completado">Completado</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Observaciones</label>
                      <textarea name="observacion" rows={4} defaultValue={editingItem?.observacion} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none" />
                    </div>
                  </>
                )}
                <div className="pt-6 flex gap-3">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                    {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancelar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsModalOpen && selectedTask && (
           <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                     <div>
                       <div className="flex items-center gap-3 mb-1">
                         <h3 className="text-xl font-black text-slate-900">{selectedTask.actividad}</h3>
                         <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${getStatusColor(selectedTask.estado)}`}>
                           {selectedTask.estado}
                         </span>
                       </div>
                     </div>
                     <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                   </div>
                   
                   {/* --- LAS DOS PESTAÑAS (TABS) EN EL MODAL --- */}
                   <div className="flex border-b border-slate-100 px-6 bg-white shrink-0">
                      <button onClick={() => setDetailsTab('comments')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'comments' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                        <div className="flex items-center gap-2"><MessageSquare size={16} /> Comentarios</div>
                      </button>
                      <button onClick={() => setDetailsTab('attachments')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'attachments' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                        <div className="flex items-center gap-2"><Paperclip size={16} /> Evidencias</div>
                      </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6">
                      {/* PESTAÑA: COMENTARIOS */}
                      {detailsTab === 'comments' && (
                        <div className="flex flex-col h-[50vh]">
                          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                             {comments.map(c => (
                               <div key={c.id} className={`flex gap-3 ${c.user_id === currentUser?.id ? 'flex-row-reverse' : ''}`}>
                                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase">{c.user?.nombre?.charAt(0) || 'U'}{c.user?.apellido?.charAt(0) || ''}</div>
                                  <div className={`p-3 rounded-2xl max-w-[80%] shadow-sm ${c.user_id === currentUser?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}><p className="text-sm">{c.content}</p></div>
                               </div>
                             ))}
                          </div>
                          <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                             <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escribe un comentario..." className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400" required />
                             <button type="submit" disabled={isSubmittingComment} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">Enviar</button>
                          </form>
                        </div>
                      )}

                      {/* PESTAÑA: EVIDENCIAS */}
                      {detailsTab === 'attachments' && (
                         <div className="flex flex-col h-[50vh]">
                            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                               {attachments.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                     <Paperclip size={32} className="mb-2 opacity-50" />
                                     <span className="text-sm font-medium">No hay evidencias adjuntas</span>
                                  </div>
                               ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                     {attachments.map(att => (
                                        <div key={att.id} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors group">
                                           <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"><FileText size={20} /></div>
                                           <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-slate-700 truncate" title={att.filename}>{att.filename || 'Archivo adjunto'}</p>
                                              <p className="text-[10px] text-slate-400 font-medium">{new Date(att.uploaded_at).toLocaleString()}</p>
                                           </div>
                                           <a href={`http://localhost:3000${att.filepath}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 rounded-lg shadow-sm transition-all shrink-0 opacity-0 group-hover:opacity-100" title="Descargar Evidencia">
                                              <Download size={16}/>
                                           </a>
                                        </div>
                                     ))}
                                  </div>
                               )}
                            </div>
                            
                            {/* ÁREA DE SUBIDA DE ARCHIVOS */}
                            <form className="mt-auto pt-4 border-t border-slate-100">
                               <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-600 transition-all text-slate-500">
                                  {isUploading ? (
                                    <span className="text-sm font-bold animate-pulse">Subiendo archivo...</span>
                                  ) : (
                                    <>
                                       <Upload size={18} />
                                       <span className="text-sm font-bold">Subir nueva evidencia</span>
                                       <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                    </>
                                  )}
                               </label>
                            </form>
                         </div>
                      )}

                   </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
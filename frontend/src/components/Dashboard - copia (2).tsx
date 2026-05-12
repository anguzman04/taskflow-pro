import React, { useState, useEffect } from 'react';
import { Task, Priority, Status, Area, User } from './types';
import { 
  Plus, Search, Filter, Edit2, Trash2, ChevronDown, CheckCircle2,
  Clock, AlertCircle, Calendar, User as UserIcon, Building2,
  FileText, Users, LayoutDashboard, Settings, X, Shield,
  LogOut, Bell, Eye, MessageSquare, Paperclip, History,
  Download, Upload, BarChart2, PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// --- NUEVOS IMPORTS PARA LOS GRÁFICOS ---
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

// --- INTERCEPTOR MAGICO V3 ---
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;

  if (typeof resource === 'string' && resource.includes('/api/me')) {
    return new Response(localStorage.getItem('user'), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
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
// --------------------------------------------------------------------

const PRIORITY_LABELS: Record<Priority, string> = {
  '0|Muy Alta': 'Muy Alta',
  '1|Alta': 'Alta',
  '2|Media': 'Media',
  '3|Baja': 'Baja',
  '4|Muy Baja': 'Muy Baja'
};

const PRIORITY_COLORS: Record<Priority, string> = {
  '0|Muy Alta': 'bg-red-100 text-red-700 border-red-200',
  '1|Alta': 'bg-orange-100 text-orange-700 border-orange-200',
  '2|Media': 'bg-blue-100 text-blue-700 border-blue-200',
  '3|Baja': 'bg-slate-100 text-slate-700 border-slate-200',
  '4|Muy Baja': 'bg-slate-50 text-slate-500 border-slate-100'
};

const STATUS_COLORS: Record<Status, string> = {
  'Pendiente': 'bg-slate-100 text-slate-600',
  'En Progreso': 'bg-blue-100 text-blue-600',
  'En Revisión': 'bg-amber-100 text-amber-700',
  'Completado': 'bg-emerald-100 text-emerald-700'
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

  const isManager = currentUser?.is_admin || areas.some(a => a.jefe_id === currentUser?.id);

  const getAreaName = (areaId: number | null | undefined) => {
    if (!areaId) return 'Sin Área';
    return areas.find(a => a.id === areaId)?.nombre || 'Sin Área';
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

      if (taskTab === 'personal') {
        return matchesSearch && matchesStatus && isMyTask;
      }
      
      if (taskTab === 'team') {
        if (isMyTask) return false; 

        if (currentUser.is_admin) {
          return matchesSearch && matchesStatus;
        }

        const responsableObj = allUsers.find(u => 
          normalizeText(`${u.nombre} ${u.apellido}`) === responsableTarea
        );

        if (responsableObj && responsableObj.area_id) {
          const areaDelResponsable = areas.find(a => a.id === responsableObj.area_id);
          const soyJefeDirecto = areaDelResponsable?.jefe_id === currentUser.id;
          const soyJefePadre = areaDelResponsable?.parent_area_id 
            ? areas.find(a => a.id === areaDelResponsable.parent_area_id)?.jefe_id === currentUser.id 
            : false;

          if (soyJefeDirecto || soyJefePadre) {
            return matchesSearch && matchesStatus;
          }
        }
        
        return false;
      }
    }
    
    return matchesSearch && matchesStatus;
  });

  // --- SECCIÓN DE MÉTRICAS Y GRÁFICOS REDISEÑADA ---
  const MetricsDashboard = () => {
    const visibleTasks = currentView === 'tasks' ? filteredTasks : controlTasks;
    const pending = visibleTasks.filter(t => t.estado === 'Pendiente').length;
    const inProgress = visibleTasks.filter(t => t.estado === 'En Progreso').length;
    const inReview = visibleTasks.filter(t => t.estado === 'En Revisión').length;
    const completed = visibleTasks.filter(t => t.estado === 'Completado').length;
    
    const avgProgress = visibleTasks.length > 0 
      ? (visibleTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / visibleTasks.length).toFixed(1)
      : 0;

    // Datos para el gráfico de Anillo (Estados)
    const pieData = [
      { name: 'Pendiente', value: pending, color: '#94a3b8' }, // slate-400
      { name: 'En Progreso', value: inProgress, color: '#3b82f6' }, // blue-500
      { name: 'En Revisión', value: inReview, color: '#f59e0b' }, // amber-500
      { name: 'Completado', value: completed, color: '#10b981' } // emerald-500
    ].filter(d => d.value > 0);

    // Datos para el gráfico de Barras (Avance promedio por Prioridad)
    const priorities = ['0|Muy Alta', '1|Alta', '2|Media', '3|Baja', '4|Muy Baja'] as Priority[];
    const barData = priorities.map(p => {
      const tasksInPriority = visibleTasks.filter(t => t.prioridad === p);
      const avg = tasksInPriority.length > 0 
        ? Math.round(tasksInPriority.reduce((acc, t) => acc + t.porcentaje_avance, 0) / tasksInPriority.length)
        : 0;
      return {
        name: PRIORITY_LABELS[p],
        Avance: avg,
        Cantidad: tasksInPriority.length
      };
    }).filter(d => d.Cantidad > 0);

    return (
      <div className="space-y-6 mb-8">
        {/* Indicadores Numéricos Clásicos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><LayoutDashboard size={18} /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progreso Global</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900">{avgProgress}%</span>
              <span className="text-[10px] text-slate-400 mb-1.5 font-bold uppercase">Promedio</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><Clock size={18} /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendientes</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{pending}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Eye size={18} /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">En Revisión</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{inReview}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={18} /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completadas</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{completed}</span>
          </div>
        </div>

        {/* Sección de Gráficos Visuales */}
        {visibleTasks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Gráfico de Dona: Distribución de Estados */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <PieChartIcon size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Distribución por Estado</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Barras: Avance por Prioridad */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Avance Promedio según Prioridad</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="Avance" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </div>
    );
  };
  // --------------------------------------------------------

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
        } else {
          setNotifications([]);
        }
      } else {
        setNotifications([]);
      }
    } catch (err) { 
      console.error("Error fetching notifications:", err); 
      setNotifications([]); 
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkSession = async () => {
      if (isLoggedIn) {
        await fetchAreas();
        await fetchUsers();
        await fetchNotifications();
        
        intervalId = setInterval(() => {
          fetchNotifications();
        }, 15000);

      } else {
        setIsLoggedIn(false);
      }
      setLoading(false);
    };
    
    checkSession();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      if (currentView === 'users' && !canViewUsers) {
        setCurrentView('tasks');
        alert('Acceso Denegado: No tienes permisos para gestionar usuarios.');
      }
      if (currentView === 'areas' && !canViewAreas) {
        setCurrentView('tasks');
        alert('Acceso Denegado: No tienes permisos para gestionar áreas.');
      }
    }
  }, [currentView, isLoggedIn, canViewUsers, canViewAreas]);

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
          bossName = parentArea?.nombre ? `Jefe: ${areas.find(a => a.id === parentArea.jefe_id)?.nombre || 'DIRECCIÓN'}` : 'DIRECCIÓN';
        } else {
          const jf = allUsers.find(u => u.id === area.jefe_id);
          bossName = jf ? `${jf.nombre} ${jf.apellido}` : 'Pendiente de asignar';
        }
      }
      setFormJefe(bossName);
      setAccesoSupervision(!!editingItem.acceso_supervision);
      setSelectedAreas(editingItem.areas_autorizadas ? editingItem.areas_autorizadas.split(',').map(Number) : []);
    } else {
      setFormJefe('');
      setAccesoSupervision(false);
      setSelectedAreas([]);
    }
  }, [editingItem, currentView, areas, allUsers]);

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

  const fetchTaskDetails = async (taskId: number) => {
    try {
      const [logsRes, attachmentsRes, commentsRes] = await Promise.all([
        fetch(`/api/audit-logs/${taskId}`),
        fetch(`/api/attachments/${taskId}`),
        fetch(`/api/comments/${taskId}`)
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
        method: 'POST',
        body: JSON.stringify({ task_id: selectedTask.id, content: newComment })
      });
      if (res.ok) {
        setNewComment('');
        fetchTaskDetails(selectedTask.id!); 
      }
    } catch (err) { console.error("Error posting comment", err); }
    finally { setIsSubmittingComment(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.[0]) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await fetch(`/api/attachments/${selectedTask.id}`, {
        method: 'POST',
        body: formData
      });
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

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
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

  const calculateElapsedDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    if (today < startDate) return 0;
    
    const targetDate = today > endDate ? endDate : today;
    const diffTime = targetDate.getTime() - startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const formData = new FormData(e.currentTarget);
      const taskData = {
        actividad: formData.get('actividad'),
        responsable: formData.get('responsable'),
        fecha_registro: formData.get('fecha_registro'),
        fecha_inicio: formData.get('fecha_inicio'),
        fecha_fin: formData.get('fecha_fin'),
        prioridad: formData.get('prioridad'),
        prerequisito: formData.get('prerequisito'),
        observacion: formData.get('observacion'),
        porcentaje_avance: parseFloat(formData.get('porcentaje_avance') as string) || 0,
        estado: formData.get('estado'),
        created_by_id: currentUser.id
      };

      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/tasks/${editingItem.id}` : '/api/tasks';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      
      if (res.status === 401) return setIsLoggedIn(false);
      if (res.ok) {
        setIsModalOpen(false);
        fetchTasks();
      }
    } catch (err) { console.error("Error submitting task:", err); }
  };

  const handleAreaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const jefeIdRaw = formData.get('jefe_id') as string;
      const parentAreaIdRaw = formData.get('parent_area_id') as string;
      const areaData = {
        nombre: formData.get('nombre'),
        descripcion: formData.get('descripcion'),
        jefe_id: jefeIdRaw ? parseInt(jefeIdRaw) : null,
        parent_area_id: parentAreaIdRaw ? parseInt(parentAreaIdRaw) : null,
      };

      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/areas/${editingItem.id}` : '/api/areas';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaData),
      });
      
      if (res.status === 401) return setIsLoggedIn(false);
      if (res.ok) {
        setIsModalOpen(false);
        fetchAreas();
        fetchUsers(); 
      } else {
        const errorData = await res.json();
        alert(`Error al guardar área: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (err) { alert("Error de red al intentar guardar el área."); }
  };

  const handleUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const areaIdRaw = formData.get('area_id') as string;
      const userData = {
        nombre: formData.get('nombre'),
        apellido: formData.get('apellido'),
        cargo: formData.get('cargo'),
        jefe_directo: formJefe, 
        area_id: areaIdRaw ? parseInt(areaIdRaw) : null,
        email: formData.get('email'),
        password: formData.get('password') || undefined,
        is_admin: formData.get('is_admin') === 'on' ? 1 : 0,
        can_create_tasks: formData.get('can_create_tasks') === 'on' ? 1 : 0,
        can_edit_tasks: formData.get('can_edit_tasks') === 'on' ? 1 : 0,
        can_delete_tasks: formData.get('can_delete_tasks') === 'on' ? 1 : 0,
        acceso_supervision: accesoSupervision ? 1 : 0,
        areas_autorizadas: selectedAreas.join(','),
        perm_users_view: formData.get('perm_users_view') === 'on' ? 1 : 0,
        perm_users_create: formData.get('perm_users_create') === 'on' ? 1 : 0,
        perm_users_edit: formData.get('perm_users_edit') === 'on' ? 1 : 0,
        perm_users_delete: formData.get('perm_users_delete') === 'on' ? 1 : 0,
        perm_areas_view: formData.get('perm_areas_view') === 'on' ? 1 : 0,
        perm_areas_create: formData.get('perm_areas_create') === 'on' ? 1 : 0,
        perm_areas_edit: formData.get('perm_areas_edit') === 'on' ? 1 : 0,
        perm_areas_delete: formData.get('perm_areas_delete') === 'on' ? 1 : 0,
      };

      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/users/${editingItem.id}` : '/api/users';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (res.status === 401) return setIsLoggedIn(false);

      if (res.ok) {
        setIsModalOpen(false);
        await fetchUsers();
        
        if (currentUser && editingItem && currentUser.id === editingItem.id) {
          const updatedUser = { 
            ...currentUser, 
            ...userData,
            is_admin: !!userData.is_admin,
            can_create_tasks: !!userData.can_create_tasks,
            can_edit_tasks: !!userData.can_edit_tasks,
            can_delete_tasks: !!userData.can_delete_tasks,
            perm_users_view: !!userData.perm_users_view,
            perm_users_create: !!userData.perm_users_create,
            perm_users_edit: !!userData.perm_users_edit,
            perm_users_delete: !!userData.perm_users_delete,
            perm_areas_view: !!userData.perm_areas_view,
            perm_areas_create: !!userData.perm_areas_create,
            perm_areas_edit: !!userData.perm_areas_edit,
            perm_areas_delete: !!userData.perm_areas_delete,
          };
          setCurrentUser(updatedUser);
        }
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'No se pudo guardar el usuario'}`);
      }
    } catch (err) { alert("Ocurrió un error inesperado al guardar el usuario."); }
  };

  const handleDelete = async (id: number, type: View) => {
    if (!confirm(`¿Estás seguro de eliminar este ${type === 'tasks' ? 'registro' : type}?`)) return;
    try {
      const res = await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
      if (res.status === 401) return setIsLoggedIn(false);
      if (res.ok) {
        if (type === 'tasks') fetchTasks();
        if (type === 'users') fetchUsers();
        if (type === 'areas') fetchAreas();
      } else {
        const data = await res.json();
        alert(`Error al eliminar: ${data.error || 'Desconocido'}`);
      }
    } catch (err) { alert("Error de red al intentar eliminar."); }
  };

  const toggleArea = (id: number) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderAreaTree = (parentId: number | null = null, level: number = 0): React.ReactNode => {
    const children = areas.filter(a => (parentId === null ? !a.parent_area_id : a.parent_area_id === parentId));
    
    return children.map((area, index) => {
      const isExpanded = expandedAreas.has(area.id!);
      const hasChildren = areas.some(a => a.parent_area_id === area.id);
      const isLast = index === children.length - 1;
      
      const jefeArea = allUsers.find(u => u.id === area.jefe_id);
      const nombreJefe = jefeArea ? `${jefeArea.nombre} ${jefeArea.apellido}` : 'No asignado';

      return (
        <React.Fragment key={area.id}>
          <div 
            className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative ${level > 0 ? 'p-4' : 'p-6'} ${hasChildren ? 'cursor-pointer' : ''}`}
            style={{ marginLeft: `${level * 40}px`, marginBottom: '16px' }}
            onClick={() => hasChildren && toggleArea(area.id!)}
          >
            {level > 0 && (
              <>
                <div className="absolute -left-6 top-1/2 w-6 h-px bg-slate-200" />
                <div className={`absolute -left-6 w-px bg-slate-200 ${isLast ? 'top-0 h-1/2' : 'top-0 -bottom-4'}`} />
              </>
            )}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${level === 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'} rounded-lg flex items-center justify-center shrink-0`}>
                  <Building2 size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 truncate">{area.nombre}</h3>
                    {hasChildren && (
                      <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }} className="text-slate-400">
                        <ChevronDown size={16} />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{area.descripcion}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {(currentUser?.is_admin || currentUser?.perm_areas_edit) && (
                  <button onClick={() => { setEditingItem(area); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                )}
                {(currentUser?.is_admin || currentUser?.perm_areas_delete) && (
                  <button onClick={() => handleDelete(area.id!, 'areas')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Jefe de Área</span>
                <span className="text-blue-600">{nombreJefe}</span>
              </div>
              {area.parent_area_id && (
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mt-1">
                  <span>Área Padre</span>
                  <span className="text-slate-500">{areas.find(a => a.id === area.parent_area_id)?.nombre}</span>
                </div>
              )}
            </div>
          </div>
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                {renderAreaTree(area.id!, level + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </React.Fragment>
      );
    });
  };

  if (isLoggedIn === null) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-medium text-slate-500">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen z-20">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <LayoutDashboard size={18} />
            </div>
            TaskFlow Pro
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setCurrentView('tasks')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'tasks' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText size={18} />
            Panel de Actividades
          </button>
          {canViewUsers && (
            <button 
              onClick={() => setCurrentView('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'users' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Users size={18} />
              Gestión de Usuarios
            </button>
          )}
          {canViewAreas && (
            <button 
              onClick={() => setCurrentView('areas')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'areas' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Building2 size={18} />
              Gestión de Áreas
            </button>
          )}

          {(currentUser?.acceso_supervision || currentUser?.is_admin) && (
            <button 
              onClick={() => setCurrentView('control')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === 'control' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileText size={18} />
              Control de Gestión
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {currentUser && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm uppercase">
                {(currentUser.nombre?.charAt(0) || '')}{(currentUser.apellido?.charAt(0) || '')}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {currentUser.nombre} {currentUser.apellido}
                </p>
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  {(currentUser as any).cargo || currentUser.email}
                </p>
              </div>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-95"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
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
                        <button 
                          onClick={() => setTaskTab('personal')}
                          className={`text-2xl font-bold transition-all ${taskTab === 'personal' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Mis Tareas
                        </button>
                        <button 
                          onClick={() => setTaskTab('team')}
                          className={`text-2xl font-bold transition-all ${taskTab === 'team' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Equipo
                        </button>
                      </div>
                      <p className="text-slate-500 text-sm">Gestiona y supervisa las actividades</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 capitalize">
                        {currentView === 'users' ? 'Gestión de Usuarios' : currentView === 'areas' ? 'Gestión de Áreas' : 'Control de Gestión'}
                      </h2>
                      <p className="text-slate-500 text-sm">Administración y supervisión del sistema</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {(currentView === 'tasks' || currentView === 'control') && (
                    <div className="hidden lg:flex bg-slate-50 rounded-xl px-4 py-2 border border-slate-200 items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progreso Real</div>
                        <div className="text-sm font-bold text-blue-600">
                          {currentView === 'tasks' ? 
                            (filteredTasks.length > 0 ? (filteredTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / filteredTasks.length).toFixed(1) : 0) : 
                            (controlTasks.length > 0 ? (controlTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / controlTasks.length).toFixed(1) : 0)
                          }%
                        </div>
                      </div>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full" style={{ width: `${currentView === 'tasks' ? (filteredTasks.length > 0 ? (filteredTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / filteredTasks.length) : 0) : (controlTasks.length > 0 ? (controlTasks.reduce((acc, t) => acc + t.porcentaje_avance, 0) / controlTasks.length) : 0)}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <button 
                      onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 relative transition-all active:scale-95"
                    >
                      <Bell size={20} />
                      {notifications.some(n => !n.read) && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
                      )}
                    </button>
                    <AnimatePresence>
                      {showNotifications && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                        >
                          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="font-bold text-slate-900 text-sm">Notificaciones</h4>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {notifications.filter(n => !n.read).length} Nuevas
                            </span>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-sm italic">No hay notificaciones</div>
                            ) : (
                              notifications.map(n => (
                                <div key={n.id} className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
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

                  {canCreateInCurrentView() && (
                    <button 
                      onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                      className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                      <Plus size={18} />
                      {currentView === 'tasks' ? 'Nueva Tarea' : currentView === 'users' ? 'Nuevo Usuario' : 'Nueva Área'}
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
              {isManager && <MetricsDashboard />}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar actividad..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">Todos los Estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Completado">Completado</option>
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Actividad</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Registro</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Inicio / Fin</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Días</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Prioridad</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Avance</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Responsable</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className={`hover:bg-slate-50/50 transition-colors group ${task.estado === 'Completado' ? 'bg-emerald-50/20' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900">{task.actividad}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{task.observacion}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{task.fecha_registro}</td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600 font-medium">{task.fecha_inicio}</div>
                          <div className="text-xs text-slate-400">{task.fecha_fin}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                            {calculateElapsedDays(task.fecha_inicio, task.fecha_fin)} d
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${PRIORITY_COLORS[task.prioridad]}`}>
                            {PRIORITY_LABELS[task.prioridad]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full" style={{ width: `${task.porcentaje_avance}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{task.porcentaje_avance}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[task.estado]}`}>
                            {task.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                              {task.responsable}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                            <button 
                              onClick={() => { setSelectedTask(task); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} 
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Ver Detalles"
                            >
                              <Eye size={14} />
                            </button>
                            {currentUser?.can_edit_tasks && (
                              <button onClick={() => { setEditingItem(task); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Edit2 size={14} />
                              </button>
                            )}
                            {currentUser?.can_delete_tasks && (
                              <button onClick={() => handleDelete(task.id!, 'tasks')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={14} />
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
              {/* === GRÁFICOS TAMBIÉN EN LA PESTAÑA DE CONTROL (Opcional) === */}
              <MetricsDashboard />
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filtro Maestro por Área</h3>
                    <p className="text-sm text-slate-500">Selecciona un área para visualizar todas sus actividades</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Filter className="text-slate-400" size={20} />
                    <select 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[240px]"
                      value={controlAreaId || ''}
                      onChange={(e) => setControlAreaId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">Todas las Áreas Autorizadas</option>
                      {areas
                        .filter(a => currentUser?.areas_autorizadas?.split(',').includes(a.id!.toString()))
                        .map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)
                      }
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Actividad</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Responsable</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Área</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Avance</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {controlTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900">{task.actividad}</div>
                          <div className="text-[10px] text-slate-400">{task.fecha_fin}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {task.responsable.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-slate-700">{task.responsable}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">
                            {(() => {
                              const respUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === task.responsable);
                              const area = areas.find(a => a.id === respUser?.area_id);
                              return area ? area.nombre : 'Sin Área';
                            })()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[task.estado]}`}>
                            {task.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full" style={{ width: `${task.porcentaje_avance}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{task.porcentaje_avance}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                            <button 
                              onClick={() => { setSelectedTask(task); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} 
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Ver Detalles y Comentar"
                            >
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
                        <button onClick={() => { setEditingItem(user); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {(currentUser?.is_admin || currentUser?.perm_users_delete) && (
                        <button onClick={() => handleDelete(user.id!, 'users')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{user.nombre} {user.apellido}</h3>
                    {user.is_admin ? (
                      <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Admin</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{user.cargo} • {getAreaName((user as any).area_id)}</p>
                  
                  <div className="space-y-2 border-t border-slate-50 pt-4">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Email</span>
                      <span className="text-slate-600">{user.email}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Jefe</span>
                      <span className="text-slate-600 text-right">{user.jefe_directo || 'DIRECCIÓN'}</span>
                    </div>
                    
                    <div className="pt-2">
                      <div className="text-[8px] font-bold text-slate-300 uppercase mb-2 tracking-widest">Permisos de Módulo</div>
                      <div className="flex flex-wrap gap-1">
                        {user.perm_users_view ? <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">Usuarios</span> : null}
                        {user.perm_areas_view ? <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">Áreas</span> : null}
                        {user.acceso_supervision ? <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-bold">Supervisión</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 border-t border-slate-50 pt-3">
                      <div className={`w-2 h-2 rounded-full ${user.can_create_tasks ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-bold text-slate-500">Crear</span>
                      <div className={`w-2 h-2 rounded-full ${user.can_edit_tasks ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-bold text-slate-500">Editar</span>
                      <div className={`w-2 h-2 rounded-full ${user.can_delete_tasks ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-bold text-slate-500">Eliminar</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentView === 'areas' && (
            <div className="flex flex-col">
              {renderAreaTree()}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingItem ? 'Editar' : 'Nuevo'} {currentView === 'tasks' ? 'Tarea' : currentView === 'users' ? 'Usuario' : 'Área'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form 
                onSubmit={currentView === 'tasks' ? handleTaskSubmit : currentView === 'users' ? handleUserSubmit : handleAreaSubmit}
                className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
              >
                {currentView === 'tasks' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Actividad</label>
                        <input name="actividad" required defaultValue={editingItem?.actividad} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Registro</label>
                        <input 
                          name="fecha_registro" 
                          type="date" 
                          readOnly 
                          defaultValue={editingItem?.fecha_registro || new Date().toISOString().split('T')[0]} 
                          className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-not-allowed text-slate-500" 
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Responsable</label>
                        <select 
                          name="responsable" 
                          required 
                          defaultValue={editingItem?.responsable} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                        >
                          <option value="">Seleccionar Responsable</option>
                          {allUsers.map(u => (
                            <option key={u.id} value={`${u.nombre} ${u.apellido}`}>
                              {u.nombre} {u.apellido}
                            </option>
                          ))}
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
                      <textarea 
                        name="observacion" 
                        rows={4}
                        defaultValue={editingItem?.observacion} 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none" 
                      />
                    </div>
                  </>
                )}

                {currentView === 'areas' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Área</label>
                      <input name="nombre" required defaultValue={editingItem?.nombre} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción</label>
                      <textarea name="descripcion" rows={3} defaultValue={editingItem?.descripcion} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Jefe de Área</label>
                      <select name="jefe_id" defaultValue={editingItem?.jefe_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                        <option value="">Sin Jefe Asignado</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Área Padre</label>
                      <select name="parent_area_id" defaultValue={editingItem?.parent_area_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                        <option value="">Sin Área Padre (Raíz)</option>
                        {areas.filter(a => a.id !== editingItem?.id).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {currentView === 'users' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre</label>
                        <input name="nombre" required defaultValue={editingItem?.nombre} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Apellido</label>
                        <input name="apellido" required defaultValue={editingItem?.apellido} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                      <input name="email" type="email" required defaultValue={editingItem?.email} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Contraseña {editingItem ? '(Dejar en blanco para no cambiar)' : '(Requerido)'}</label>
                      <input name="password" type="password" required={!editingItem} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Cargo</label>
                        <input name="cargo" required defaultValue={editingItem?.cargo} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Área</label>
                        <select 
                          name="area_id" 
                          defaultValue={editingItem?.area_id || ''} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                          onChange={(e) => {
                            const areaId = parseInt(e.target.value);
                            const area = areas.find(a => a.id === areaId);
                            
                            let bossName = 'Pendiente de asignar';
                            if (area) {
                              if (area.jefe_id === editingItem?.id) {
                                const parentArea = areas.find(a => a.id === area.parent_area_id);
                                bossName = parentArea?.nombre ? `Jefe: ${areas.find(a => a.id === parentArea.jefe_id)?.nombre || 'DIRECCIÓN'}` : 'DIRECCIÓN';
                              } else {
                                const jf = allUsers.find(u => u.id === area.jefe_id);
                                bossName = jf ? `${jf.nombre} ${jf.apellido}` : 'Pendiente de asignar';
                              }
                            }
                            setFormJefe(bossName);
                          }}
                        >
                          <option value="">Sin Área (Opcional)</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Jefe directo (Heredado del Área)</label>
                      <input 
                        name="jefe_directo" 
                        value={formJefe || (editingItem ? (editingItem.jefe_directo || 'DIRECCIÓN') : 'Pendiente de asignar')} 
                        readOnly 
                        className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none cursor-not-allowed ${!formJefe && !editingItem?.jefe_directo ? 'bg-orange-50 text-orange-600 italic' : 'bg-slate-100 text-slate-500'}`} 
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-50">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-4">Permisos del Usuario</label>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors">
                          <span className="text-sm font-bold text-red-700">Administrador (Acceso Total)</span>
                          <input type="checkbox" name="is_admin" defaultChecked={editingItem?.is_admin} className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500" />
                        </label>

                        <div className="grid grid-cols-1 gap-4 pt-2">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-3">Módulo: Usuarios</label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_users_view" defaultChecked={editingItem?.perm_users_view} /> Ver</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_users_create" defaultChecked={editingItem?.perm_users_create} /> Crear</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_users_edit" defaultChecked={editingItem?.perm_users_edit} /> Editar</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_users_delete" defaultChecked={editingItem?.perm_users_delete} /> Eliminar</label>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-3">Módulo: Áreas</label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_areas_view" defaultChecked={editingItem?.perm_areas_view} /> Ver</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_areas_create" defaultChecked={editingItem?.perm_areas_create} /> Crear</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_areas_edit" defaultChecked={editingItem?.perm_areas_edit} /> Editar</label>
                              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="perm_areas_delete" defaultChecked={editingItem?.perm_areas_delete} /> Eliminar</label>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Permisos de Tareas</label>
                          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <span className="text-sm font-medium text-slate-700">Permitir crear tareas</span>
                            <input type="checkbox" name="can_create_tasks" defaultChecked={editingItem?.can_create_tasks} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          </label>
                          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <span className="text-sm font-medium text-slate-700">Permitir editar tareas</span>
                            <input type="checkbox" name="can_edit_tasks" defaultChecked={editingItem?.can_edit_tasks} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          </label>
                          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <span className="text-sm font-medium text-slate-700">Permitir eliminar tareas</span>
                            <input type="checkbox" name="can_delete_tasks" defaultChecked={editingItem?.can_delete_tasks} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          </label>
                        </div>

                        <div className="pt-2">
                          <label className="flex items-center justify-between p-3 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                            <span className="text-sm font-bold text-blue-700">Acceso Supervisión de Dirección</span>
                            <input 
                              type="checkbox" 
                              name="acceso_supervision" 
                              checked={accesoSupervision}
                              onChange={(e) => setAccesoSupervision(e.target.checked)}
                              className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500" 
                            />
                          </label>
                          
                          {accesoSupervision && (
                            <div className="mt-3 p-4 bg-white border border-blue-100 rounded-xl space-y-2">
                              <label className="text-[10px] font-bold text-blue-400 uppercase">Áreas Autorizadas</label>
                              <div className="grid grid-cols-2 gap-2">
                                {areas.map(area => (
                                  <label key={area.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                    <input 
                                      type="checkbox"
                                      checked={selectedAreas.includes(area.id!)}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedAreas([...selectedAreas, area.id!]);
                                        else setSelectedAreas(selectedAreas.filter(id => id !== area.id));
                                      }}
                                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-slate-600">{area.nombre}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-6 flex gap-3">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                    {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsModalOpen && selectedTask && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black text-slate-900">{selectedTask.actividad}</h3>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[selectedTask.estado]}`}>
                      {selectedTask.estado}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <UserIcon size={14} /> {selectedTask.responsable} • <Calendar size={14} /> {selectedTask.fecha_fin}
                  </p>
                </div>
                <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex border-b border-slate-100 px-6 bg-white">
                <button 
                  onClick={() => setDetailsTab('comments')}
                  className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'comments' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
                >
                  <div className="flex items-center gap-2"><MessageSquare size={16} /> Comentarios</div>
                </button>
                <button 
                  onClick={() => setDetailsTab('attachments')}
                  className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'attachments' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
                >
                  <div className="flex items-center gap-2"><Paperclip size={16} /> Evidencias</div>
                </button>
                <button 
                  onClick={() => setDetailsTab('history')}
                  className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'history' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
                >
                  <div className="flex items-center gap-2"><History size={16} /> Historial</div>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                
                {detailsTab === 'comments' && (
                  <div className="flex flex-col h-[50vh]">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {comments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic text-sm">No hay comentarios aún. ¡Inicia la conversación!</div>
                      ) : (
                        comments.map(c => (
                          <div key={c.id} className={`flex gap-3 ${c.user_id === currentUser?.id ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                              {c.user?.nombre?.charAt(0) || 'U'}{c.user?.apellido?.charAt(0) || ''}
                            </div>
                            <div className={`p-3 rounded-2xl max-w-[80%] shadow-sm ${c.user_id === currentUser?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                              <p className="text-sm">{c.content}</p>
                              <span className={`text-[9px] mt-1 block font-medium ${c.user_id === currentUser?.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                {new Date(c.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario o actualización..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm focus:bg-white transition-colors"
                        required
                      />
                      <button type="submit" disabled={isSubmittingComment} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm shadow-blue-200">
                        Enviar
                      </button>
                    </form>
                  </div>
                )}

                {detailsTab === 'attachments' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">Archivos Adjuntos</h4>
                      <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
                        <Upload size={14} /> Subir Archivo
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                    </div>

                    {isUploading && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-blue-600">Subiendo archivo...</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {attachments.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-sm">
                          No hay evidencias cargadas para esta tarea
                        </div>
                      ) : (
                        attachments.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 group-hover:text-blue-500 transition-colors">
                                <FileText size={18} />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-700">{file.filename}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{new Date(file.uploaded_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <a 
                              href={file.filepath} 
                              download={file.filename}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {detailsTab === 'history' && (
                  <div className="space-y-4">
                    {auditLogs.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-sm italic">No hay historial disponible</div>
                    ) : (
                      auditLogs.map(log => (
                        <div key={log.id} className="flex gap-4 relative pb-6 last:pb-0">
                          <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-100 last:hidden" />
                          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center z-10 shrink-0">
                            <Clock size={14} className="text-slate-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-black text-slate-900">{log.user_name}</span>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{log.action}</span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">{log.details}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block font-medium">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
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
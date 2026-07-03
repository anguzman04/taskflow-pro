import React, { useState, useEffect } from 'react';
import { Task, Priority, Status, Area, User } from './types';
import { 
  Plus, Search, Filter, Edit2, Trash2, ChevronDown, CheckCircle2,
  Clock, AlertCircle, Calendar, User as UserIcon, Building2,
  FileText, Users, LayoutDashboard, Settings, X, Shield,
  LogOut, Bell, Eye, MessageSquare, Paperclip, History,
  Download, Upload, FolderKanban, CheckSquare, Square, ListChecks,
  PieChart as PieChartIconLucide, TrendingUp, Activity, FilterX, Lock, Columns,
  PlayCircle, Reply, Tag, GripVertical, Trophy, Medal, Menu, ChevronLeft, ChevronRight,
  Link2, ExternalLink, NotebookPen, GanttChartSquare
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import MultiSelect from './MultiSelect';

// Opciones de prioridad reutilizadas por los filtros multi-selección.
const PRIORITY_OPTIONS = [
  { value: '0|Muy Alta', label: 'Muy Alta' },
  { value: '1|Alta', label: 'Alta' },
  { value: '2|Media', label: 'Media' },
  { value: '3|Baja', label: 'Baja' },
  { value: '4|Muy Baja', label: 'Muy Baja' },
];

export interface Project {
  id?: number;
  nombre: string;
  descripcion?: string;
  estado: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  lider_id?: number; 
  prioritario?: boolean; 
}

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource !== 'string') return originalFetch(resource, config);
  if (resource.includes('/api/me')) {
    const localUser = localStorage.getItem('user');
    return new Response(localUser !== 'undefined' ? localUser : null, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (resource.startsWith('/api')) {
    config = config || {};
    const isFormData = config.body instanceof FormData; 
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }) 
    };
  }
  return originalFetch(resource, config);
};

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
  if (str.includes('PLANEADO')) return 'bg-slate-100 text-slate-600';
  if (str.includes('EN CURSO')) return 'bg-blue-100 text-blue-600';
  if (str.includes('EN ESPERA')) return 'bg-amber-100 text-amber-700';
  if (str.includes('COMPLETADO') || str.includes('FINALIZADO')) return 'bg-emerald-100 text-emerald-700';
  if (str.includes('CANCELADO')) return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
};

const getChartColor = (p: string) => {
  const str = String(p || '').toUpperCase();
  if (str.includes('MUY ALTA')) return '#ef4444';
  if (str.includes('ALTA')) return '#f97316';
  if (str.includes('MEDIA')) return '#3b82f6';
  return '#94a3b8';
};

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

/* const getDaysOverdue = (endDateStr: string, status: string) => {
  try {
    if (!endDateStr || typeof endDateStr !== 'string' || status === 'Completado' || status === 'Finalizado' || status === 'Cancelado') return 0; 
    const parts = endDateStr.split('-');
    if (parts.length !== 3) return 0;
    const [year, month, day] = parts.map(Number);
    const end = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today > end) {
      const diffTime = today.getTime() - end.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  } catch (e) { return 0; }
}; */

const getDaysOverdue = (endDateStr: string, status: string) => {
  try {
    if (!endDateStr || typeof endDateStr !== 'string' || status === 'Completado' || status === 'Finalizado' || status === 'Cancelado') return 0;
    
    // 🚀 CORRECCIÓN: Decapitar la Zona Horaria antes de hacer el split
    const fechaLimpia = endDateStr.split('T')[0]; 
    const parts = fechaLimpia.split('-');
    
    if (parts.length !== 3) return 0;
    const [year, month, day] = parts.map(Number);
    const end = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today > end) {
      const diffTime = today.getTime() - end.getTime();
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  } catch (e) { return 0; }
};



const ChartsSection = ({ data }: { data: any[] }) => {
  const pieData = [
    { name: 'Planeado', value: data.filter(t => t.estado === 'Planeado').length, color: '#94a3b8' },
    { name: 'En curso', value: data.filter(t => t.estado === 'En curso').length, color: '#3b82f6' },
    { name: 'En espera', value: data.filter(t => t.estado === 'En espera').length, color: '#f59e0b' },
    { name: 'Completado', value: data.filter(t => t.estado === 'Completado').length, color: '#10b981' }
  ].filter(d => d.value > 0);

  const priorityStats = ['0|Muy Alta', '1|Alta', '2|Media', '3|Baja', '4|Muy Baja'].map(p => {
    const targetLabel = getPriorityLabel(p); 
    const t = data.filter(task => getPriorityLabel(task.prioridad) === targetLabel);
    const avg = t.length > 0 ? t.reduce((acc, curr) => acc + (Number(curr.porcentaje_avance) || 0), 0) / t.length : 0;
    return { name: targetLabel, Avance: Math.round(avg), count: t.length, fill: getChartColor(p) };
  }).filter(stat => stat.count > 0); 

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon size={16} className="text-slate-400"/>
          <span className="text-sm font-bold text-slate-900">Distribución por Estado</span>
        </div>
        <div className="h-64 flex items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <span className="text-slate-400 text-sm">No hay datos para graficar</span>}
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
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="Avance" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {priorityStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center"><span className="text-slate-400 text-sm">No hay datos para graficar</span></div>}
        </div>
      </div>
    </div>
  );
};

type View = 'tasks' | 'users' | 'areas' | 'control' | 'projects' | 'reports' | 'gantt';
type DetailsTab = 'comments' | 'attachments' | 'subtasks';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('taskflow_sidebar_collapsed') === '1');
  const toggleSidebarCollapsed = () => setIsSidebarCollapsed(prev => {
    const next = !prev;
    localStorage.setItem('taskflow_sidebar_collapsed', next ? '1' : '0');
    return next;
  });
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [taskTab, setTaskTab] = useState<'personal' | 'team'>('personal');
  const [taskDisplayMode, setTaskDisplayMode] = useState<'list' | 'kanban'>('list');
  const [showImportMenu, setShowImportMenu] = useState(false);
  
  const [showColumnManager, setShowColumnManager] = useState(false);
  const defaultTableCols = [
    { id: 'orden', label: 'Orden', visible: true },
    { id: 'actividad', label: 'Actividad', visible: true },
    { id: 'proyecto', label: 'Proyecto', visible: true },
    { id: 'compromiso', label: 'Compromiso', visible: true },
    { id: 'avance', label: 'Avance', visible: true },
    { id: 'estado', label: 'Estado', visible: true },
    { id: 'responsable', label: 'Responsable(s)', visible: true },
    { id: 'acciones', label: 'Acciones', visible: true }
  ];
  const [tableCols, setTableCols] = useState(() => {
    try {
      const saved = localStorage.getItem('taskFlow_columns');
      return saved ? JSON.parse(saved) : defaultTableCols;
    } catch (e) { return defaultTableCols; }
  });

  useEffect(() => {
    localStorage.setItem('taskFlow_columns', JSON.stringify(tableCols));
  }, [tableCols]);

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...tableCols];
    if (direction === 'up' && index > 0) {
      [newCols[index - 1], newCols[index]] = [newCols[index], newCols[index - 1]];
    } else if (direction === 'down' && index < newCols.length - 1) {
      [newCols[index + 1], newCols[index]] = [newCols[index], newCols[index + 1]];
    }
    setTableCols(newCols);
  };

  const toggleColumn = (id: string) => {
    setTableCols(tableCols.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined' || stored === 'null') return null;
      return JSON.parse(stored);
    } catch (e) { return null; }
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(() => !!localStorage.getItem('token'));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalReadOnly, setIsModalReadOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formJefe, setFormJefe] = useState('');

  const [preselectedProjectId, setPreselectedProjectId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedAreas, setSelectedAreas] = useState<number[]>([]);
  const [accesoSupervision, setAccesoSupervision] = useState(false);
  const [controlAreaId, setControlAreaId] = useState<number | null>(null);
  //const [controlTasks, setControlTasks] = useState<any[]>([]);
  
  const [controlResponsableFilter, setControlResponsableFilter] = useState<string[]>([]);
  const [controlTasks, setControlTasks] = useState<any[]>([]);
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string[]>([]);
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  const [controlPriorityFilter, setControlPriorityFilter] = useState<string[]>([]);
  const [controlDateFrom, setControlDateFrom] = useState('');
  const [controlDateTo, setControlDateTo] = useState('');
  
  
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedTaskSubtasks, setExpandedTaskSubtasks] = useState<Set<number>>(new Set());
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [projectLiderFilter, setProjectLiderFilter] = useState<string[]>([]);
  const [projectPrioritarioFilter, setProjectPrioritarioFilter] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
 
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedSubtaskIdForComment, setSelectedSubtaskIdForComment] = useState<string>('');



  // ?? A?ADE ESTOS DOS:
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('comments');
  
  // ?? A?ADE ESTA L  NEA
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTaskFromProject, setEditingTaskFromProject] = useState(false);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDate, setNewSubtaskDate] = useState('');
  const [subtaskItems, setSubtaskItems] = useState<any[]>([]);
  const [editingSubtaskDateId, setEditingSubtaskDateId] = useState<number | null>(null);
  const [editingSubtaskTitleId, setEditingSubtaskTitleId] = useState<number | null>(null);
  const subtaskItemsRef = React.useRef<any[]>([]);
  const reorderPending = React.useRef(false);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState(''); 
  const [isImporting, setIsImporting] = useState(false);

  const [reportAreaFilter, setReportAreaFilter] = useState<string[]>([]);
  const [reportProjectFilter, setReportProjectFilter] = useState<string[]>([]);
  const [reportDateFrom, setReportDateFrom] = useState<string>('');
  const [reportDateTo, setReportDateTo] = useState<string>('');

  const canViewUsers = currentUser?.is_admin || currentUser?.perm_users_view;
  const canViewAreas = currentUser?.is_admin || currentUser?.perm_areas_view;
  const canViewProjects = currentUser?.is_admin || currentUser?.perm_projects_view;
  const canViewReports = currentUser?.is_admin || currentUser?.perm_reports_view;
  const canViewGantt = currentUser?.is_admin || (currentUser as any)?.perm_gantt_view;

  // Estado local de la vista Cronograma / Gantt
  const [ganttScale, setGanttScale] = useState<'week' | 'month' | 'quarter'>('month');
  const [ganttCollapsed, setGanttCollapsed] = useState<Record<string, boolean>>({});
  const [ganttMode, setGanttMode] = useState<'bars' | 'calendar'>('bars');
  const [calMetric, setCalMetric] = useState<'active' | 'due' | 'start' | 'total'>('active');
  const [calMonth, setCalMonth] = useState<{ y: number; m: number }>(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const logoutUser = () => {
      alert("Tu sesión ha expirado por inactividad. Por seguridad, debes iniciar sesi  n nuevamente.");
      handleLogout();
    };
    const resetTimer = () => { clearTimeout(timeoutId); timeoutId = setTimeout(logoutUser, 1800000); };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const activityHandler = () => { resetTimer(); };
    if (isLoggedIn) { events.forEach(e => window.addEventListener(e, activityHandler)); resetTimer(); }
    return () => { clearTimeout(timeoutId); events.forEach(e => window.removeEventListener(e, activityHandler)); };
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedTask?.subtasks) {
      const sorted = [...selectedTask.subtasks].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      setSubtaskItems(sorted);
      subtaskItemsRef.current = sorted;
    } else {
      setSubtaskItems([]);
    }
  }, [selectedTask?.id, selectedTask?.subtasks]);

  useEffect(() => { subtaskItemsRef.current = subtaskItems; }, [subtaskItems]);

  const canViewSubtasks = (taskResponsable: string) => {
    if (!currentUser) return false;
    if (currentUser.is_admin || currentUser.perm_subtasks_view) return true;
    const normalizeText = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';
    const miNombre = normalizeText(`${currentUser.nombre || ''} ${currentUser.apellido || ''}`);
    return normalizeText(taskResponsable || '').includes(miNombre);
  };

  const canCreateSubtasks = () => currentUser?.is_admin || currentUser?.perm_subtasks_create;
  const canDeleteSubtasks = () => currentUser?.is_admin || currentUser?.perm_subtasks_delete;

  const canToggleSubtasks = (taskResponsable: string) => {
    if (!currentUser) return false;
    if (currentUser.is_admin || currentUser.perm_subtasks_edit) return true;
    const normalizeText = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';
    const miNombre = normalizeText(`${currentUser.nombre || ''} ${currentUser.apellido || ''}`);
    return normalizeText(taskResponsable || '').includes(miNombre);
  };

  const canEditSubtaskContent = (taskResponsable: string, taskCreatorId?: number) => {
    if (!currentUser) return false;
    if (currentUser.is_admin || currentUser.perm_subtasks_edit_title) return true;
    if (taskCreatorId && currentUser.id === taskCreatorId) return true;
    const normalizeText = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';
    const miNombre = normalizeText(`${currentUser.nombre || ''} ${currentUser.apellido || ''}`);
    return normalizeText(taskResponsable || '').includes(miNombre);
  };

  const canCreateInCurrentView = () => {
    if (currentView === 'tasks') return currentUser?.can_create_tasks;
    if (currentView === 'users') return currentUser?.is_admin || currentUser?.perm_users_create;
    if (currentView === 'areas') return currentUser?.is_admin || currentUser?.perm_areas_create;
    if (currentView === 'projects') return currentUser?.is_admin || currentUser?.perm_projects_create; 
    return false;
  };

  const filteredTasks = tasks.filter(task => {
    if (!task) return false;
    const act = task.actividad || '';
    const matchesSearch = act.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = false;
    if (statusFilter === 'All') {
      matchesStatus = true;
    } else if (statusFilter === 'Atrasadas') {
      matchesStatus = getDaysOverdue(task.fecha_fin, task.estado) > 0;
    } else {
      matchesStatus = task.estado === statusFilter;
    }
    
    const matchesPriority = taskPriorityFilter.length === 0 || taskPriorityFilter.includes(task.prioridad);
    const taskFecha = task.fecha_registro ? task.fecha_registro.split('T')[0] : '';
    const matchesDate = (!taskDateFrom || taskFecha >= taskDateFrom) && (!taskDateTo || taskFecha <= taskDateTo);

    if (currentView === 'tasks' && currentUser) {
      const normalizeText = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';
      const miNombre = normalizeText(`${currentUser.nombre || ''} ${currentUser.apellido || ''}`);
      const responsableTareaStr = normalizeText(task.responsable || '');
      const isMyTask = responsableTareaStr.includes(miNombre);

      if (taskTab === 'personal') return matchesSearch && matchesStatus && matchesPriority && matchesDate && isMyTask;

      if (taskTab === 'team') {
        if (currentUser.is_admin) return matchesSearch && matchesStatus && matchesPriority && matchesDate;
        let soyJefe = false;
        const responsablesArray = responsableTareaStr.split(',').map(r => r.trim());

        for (const respName of responsablesArray) {
           const responsableObj = allUsers.find(u => normalizeText(`${u.nombre || ''} ${u.apellido || ''}`) === respName);
           if (responsableObj && responsableObj.area_id && areas.length > 0) {
             const areaDelResponsable = areas.find(a => a.id === responsableObj.area_id);
             const soyJefeDirecto = areaDelResponsable?.jefe_id === currentUser.id;
             const soyJefePadre = areaDelResponsable?.parent_area_id ? areas.find(a => a.id === areaDelResponsable.parent_area_id)?.jefe_id === currentUser.id : false;
             if(soyJefeDirecto || soyJefePadre) { soyJefe = true; break; }
           }
        }
        if (soyJefe || isMyTask) return matchesSearch && matchesStatus && matchesPriority && matchesDate;
        return false;
      }
    }
    return matchesSearch && matchesStatus && matchesPriority && matchesDate;
  }).sort((a, b) => {
      const ordA = a.orden_ejecucion; const ordB = b.orden_ejecucion;
      if (ordA != null && ordB != null) return ordA - ordB;
      if (ordA != null) return -1;
      if (ordB != null) return 1;
      const calA = parseInt(a.calificacion) || 0; const calB = parseInt(b.calificacion) || 0;
      if (calB !== calA) return calB - calA;
      return (b.id || 0) - (a.id || 0);
  });

/*   const filteredControlTasks = controlTasks.filter(task => {
    if (!task) return false;
    const act = task.actividad || '';
    const matchesSearch = act.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = false;
    if (statusFilter === 'All') matchesStatus = true;
    else if (statusFilter === 'Atrasadas') matchesStatus = getDaysOverdue(task.fecha_fin, task.estado) > 0;
    else matchesStatus = task.estado === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
      const ordA = a.orden_ejecucion; const ordB = b.orden_ejecucion;
      if (ordA != null && ordB != null) return ordA - ordB;
      if (ordA != null) return -1;
      if (ordB != null) return 1;
      const calA = parseInt(a.calificacion) || 0; const calB = parseInt(b.calificacion) || 0;
      if (calB !== calA) return calB - calA;
      return (b.id || 0) - (a.id || 0);
  }); */
  
const filteredControlTasks = controlTasks.filter(task => {
    if (!task) return false;

    // 1. Filtro de Búsqueda (Texto)
    const act = task.actividad || '';
    const matchesSearch = act.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filtro de Estado (¡CORREGIDO PARA ATRASADAS!)
    let matchesStatus = false;
    if (statusFilter === 'All') {
      matchesStatus = true;
    } else if (statusFilter === 'Atrasadas') {
      if (!task.fecha_fin) {
        matchesStatus = false;
      } else {
        // Limpiamos la fecha aislando solo el "YYYY-MM-DD"
        const fechaLimpia = task.fecha_fin.split('T')[0]; 
        const fechaFinDate = new Date(`${fechaLimpia}T00:00:00`);
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        matchesStatus = (task.estado !== 'Completado' && task.estado !== 'Cancelado') && (fechaFinDate < hoy);
      }
    } else {
      matchesStatus = task.estado === statusFilter;
    }

    // 3. Filtro por Área (FORZADO EN FRONTEND)
    let matchesArea = true;
    if (controlAreaId) {
      let belongsToArea = false;
      if (task.area_origen_id === controlAreaId) belongsToArea = true;
      if (!belongsToArea && task.responsable) {
        const responsablesArray = String(task.responsable).split(',').map(r => r.trim());
        for (const respName of responsablesArray) {
          const normalize = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
          const respUser = allUsers.find(u => normalize(`${u.nombre || ''} ${u.apellido || ''}`) === normalize(respName));
          if (respUser && respUser.area_id === controlAreaId) {
            belongsToArea = true; break;
          }
        }
      }
      matchesArea = belongsToArea;
    }

    // 4. Filtro por Responsable (multi-selección: coincide si comparte alguno)
    let matchesResponsable = true;
    if (controlResponsableFilter.length > 0) {
      const responsablesArray = task.responsable ? String(task.responsable).split(',').map(r => r.trim()) : [];
      matchesResponsable = controlResponsableFilter.some(f => responsablesArray.includes(f));
    }

    // 5. Filtro por Prioridad (multi-selección)
    const matchesControlPriority = controlPriorityFilter.length === 0 || controlPriorityFilter.includes(task.prioridad);

    // 6. Filtro por Fecha de registro
    const ctrlFecha = task.fecha_registro ? task.fecha_registro.split('T')[0] : '';
    const matchesControlDate = (!controlDateFrom || ctrlFecha >= controlDateFrom) && (!controlDateTo || ctrlFecha <= controlDateTo);

    return matchesSearch && matchesStatus && matchesArea && matchesResponsable && matchesControlPriority && matchesControlDate;
  }).sort((a, b) => {
      const ordA = a.orden_ejecucion; const ordB = b.orden_ejecucion;
      if (ordA != null && ordB != null) return ordA - ordB;
      if (ordA != null) return -1;
      if (ordB != null) return 1;
      const calA = parseInt(a.calificacion) || 0; const calB = parseInt(b.calificacion) || 0;
      if (calB !== calA) return calB - calA;
      return (b.id || 0) - (a.id || 0);
  });

 /* const filteredReportTasks = tasks.filter(task => {
    let matchArea = true; let matchProject = true; let matchDate = true;
    if (reportAreaFilter !== 'All') matchArea = task.area_origen_id?.toString() === reportAreaFilter;
    if (reportProjectFilter !== 'All') matchProject = task.proyecto_id?.toString() === reportProjectFilter;
    if (reportDateFrom && task.fecha_registro) matchDate = task.fecha_registro >= reportDateFrom;
    if (reportDateTo && task.fecha_registro && matchDate) matchDate = task.fecha_registro <= reportDateTo;
    return matchArea && matchProject && matchDate;
  });*/

const filteredReportTasks = tasks.filter(task => {
  let matchArea = true; let matchProject = true; let matchDate = true;
  if (reportAreaFilter.length > 0) matchArea = reportAreaFilter.includes(task.area_origen_id?.toString());
  if (reportProjectFilter.length > 0) matchProject = reportProjectFilter.includes(task.proyecto_id?.toString());

  // 🚀 CORRECCIÓN: Limpiar la fecha de registro antes de comparar
  if (reportDateFrom || reportDateTo) {
    const fechaRegLimpia = task.fecha_registro ? task.fecha_registro.split('T')[0] : '';
    if (reportDateFrom && fechaRegLimpia) matchDate = fechaRegLimpia >= reportDateFrom;
    if (reportDateTo && fechaRegLimpia && matchDate) matchDate = fechaRegLimpia <= reportDateTo;
  }
  
  return matchArea && matchProject && matchDate;
});





  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/areas');
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      const validData = Array.isArray(data) ? data : (data?.data || data?.areas || []);
      setAreas(validData);
      const rootArea = validData.find((a: Area) => !a.parent_area_id);
      if (rootArea && rootArea.id) setExpandedAreas(new Set([rootArea.id]));
    } catch (err) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      const validData = Array.isArray(data) ? data : (data?.data || data?.users || []);
      setAllUsers(validData);
      if (validData.length > 0 && !currentUser) setCurrentUser(validData[0]);
    } catch (err) {}
  };

  const fetchTasks = async () => {
    if (!currentUser || !currentUser.id) return;
    try {
      const res = await fetch(`/api/tasks?userId=${currentUser.id}`);
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      const validData = Array.isArray(data) ? data : (data?.data || data?.tasks || []);
      setTasks(validData);
      if (selectedTask) {
        const updatedSelected = validData.find((t: any) => t.id === selectedTask.id);
        if (updatedSelected) setSelectedTask(updatedSelected);
      }
      if (editingItem && currentView === 'tasks') {
        const updatedEditing = validData.find((t: any) => t.id === editingItem.id);
        if (updatedEditing) setEditingItem(updatedEditing);
      }
    } catch (err) {}
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : (data?.data || []));
      }
    } catch (err) {}
  };

  const fetchControlTasks = async () => {
    if (!currentUser || (!currentUser.acceso_supervision && !currentUser.is_admin)) return; 
    
    let fetchedTasks: any[] = [];
    
    try {
      const userId = parseInt(String(currentUser.id));
      const areaQuery = controlAreaId ? `&areaId=${controlAreaId}` : '';
      const url = `/api/control/tasks?userId=${userId}${areaQuery}`;
      const res = await fetch(url);
      
      if (res.status === 401) { handleLogout(); return; }
      
      if (res.ok) {
          const data = await res.json();
          fetchedTasks = Array.isArray(data) ? data : (data?.data || data?.tasks || []);
      }
    } catch (err) {
       console.warn("La ruta de control en el backend falló, activando motor de respaldo local...");
    }

    let areasAutorizadas: number[] = [];
    if (currentUser.is_admin) {
      areasAutorizadas = areas.map(a => a.id!);
    } else if (currentUser.acceso_supervision) {
      areasAutorizadas = currentUser.areas_autorizadas ? String(currentUser.areas_autorizadas).split(',').map(Number) : [];
    }

    const normalizeText = (text: string) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toUpperCase() : '';

    const localControlTasks = tasks.filter(task => {
      if (currentUser.is_admin && !controlAreaId) return true;

      let isValidForControl = false;
      
      if (task.area_origen_id) {
         if (controlAreaId && task.area_origen_id === controlAreaId && areasAutorizadas.includes(task.area_origen_id)) {
           isValidForControl = true;
         } else if (!controlAreaId && areasAutorizadas.includes(task.area_origen_id)) {
           isValidForControl = true;
         }
      }

      if (!isValidForControl) {
          const responsablesArray = task.responsable ? String(task.responsable).split(',').map(r => r.trim()) : [];
          for (const respName of responsablesArray) {
             const responsableUser = allUsers.find(u => normalizeText(`${u.nombre || ''} ${u.apellido || ''}`) === normalizeText(respName));
             const taskAreaId = responsableUser ? responsableUser.area_id : null;
             
             if (taskAreaId) {
               if (controlAreaId && taskAreaId === controlAreaId && areasAutorizadas.includes(taskAreaId)) {
                 isValidForControl = true; break;
               } else if (!controlAreaId && areasAutorizadas.includes(taskAreaId)) {
                 isValidForControl = true; break;
               }
             }
          }
      }
      return isValidForControl;
    });
    
/*     const combinedTasks = [...fetchedTasks];
    localControlTasks.forEach(localTask => {
       if (!combinedTasks.find(t => t.id === localTask.id)) {
           combinedTasks.push(localTask);
       }
    });

    setControlTasks(combinedTasks); */
	
	// 🚀 CORRECCIÓN: Priorizar las tareas de memoria (localControlTasks) que están 
    // 100% frescas si el usuario acaba de hacer un cambio rápido.
    const combinedMap = new Map();
    
    // 1. Cargamos las tareas del backend de control
    fetchedTasks.forEach(t => combinedMap.set(t.id, t));
    
    // 2. Sobrescribimos/Agregamos las locales (Esto fuerza la sincronización perfecta)
    localControlTasks.forEach(t => combinedMap.set(t.id, t));
    
    setControlTasks(Array.from(combinedMap.values()));
	
	
	
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : (data?.data || []));
      } else setNotifications([]);
    } catch (err) {}
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const checkSession = async () => {
      if (isLoggedIn) {
        await fetchAreas(); await fetchUsers(); await fetchProjects(); await fetchNotifications(); await fetchNotes();
        intervalId = setInterval(() => { fetchNotifications(); }, 15000);
      } else handleLogout(); 
      setLoading(false);
    };
    checkSession();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && currentUser) fetchTasks();
  }, [isLoggedIn, currentUser]);
  
  useEffect(() => {
    setUserSearchTerm(''); 
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
      setSelectedAreas(editingItem.areas_autorizadas ? String(editingItem.areas_autorizadas).split(',').map(Number) : []);
    } else {
      setFormJefe(''); setAccesoSupervision(false); setSelectedAreas([]);
    }

    if (editingItem && (currentView === 'tasks' || editingTaskFromProject)) {
        if(editingItem.responsable) {
            const validUserNames = allUsers.map(u => `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase());
            const currentResps = String(editingItem.responsable).split(',').map((r:string) => r.trim());

            const cleanResps = currentResps.filter(r => validUserNames.includes(r.toLowerCase()));
            setSelectedResponsibles(cleanResps);
        }
        else setSelectedResponsibles([]);
    } else setSelectedResponsibles([]);
  }, [editingItem, currentView, areas, allUsers, editingTaskFromProject]);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) { const data = await res.json(); setNotes(Array.isArray(data) ? data : []); }
    } catch (err) {}
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await fetch('/api/notes', { method: 'POST', body: JSON.stringify({ content: newNoteContent.trim() }) });
      if (res.ok) { setNewNoteContent(''); fetchNotes(); }
      else alert((await res.json()).error || 'No se pudo crear la nota.');
    } catch (err) { alert('Error de conexión al crear la nota.'); } finally { setIsSavingNote(false); }
  };

  const handleUpdateNote = async () => {
    if (!editingNoteId || !editingNoteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/notes/${editingNoteId}`, { method: 'PUT', body: JSON.stringify({ content: editingNoteContent.trim() }) });
      if (res.ok) { setEditingNoteId(null); setEditingNoteContent(''); fetchNotes(); }
      else alert((await res.json()).error || 'No se pudo actualizar la nota.');
    } catch (err) { alert('Error de conexión al actualizar la nota.'); } finally { setIsSavingNote(false); }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) fetchNotes(); else alert('No se pudo eliminar la nota.');
    } catch (err) { alert('Error de conexión al eliminar la nota.'); }
  };

  const markNotificationsRead = async () => {
    try { await fetch('/api/notifications/read', { method: 'PUT' }); fetchNotifications(); } catch (err) {}
  };

  const handleNotificationClick = async (notif: any) => {
    const targetTaskId = Number(notif.task_id || notif.taskId);
    if (targetTaskId) {
      let taskToOpen = tasks.find(t => t.id == targetTaskId) || controlTasks.find(t => t.id == targetTaskId);
      if (!taskToOpen) {
        try {
          const res = await fetch(`/api/tasks?userId=${currentUser?.id}`);
          if (res.status === 401) { handleLogout(); return; }
          const data = await res.json();
          const freshTasks = Array.isArray(data) ? data : (data?.data || []);
          setTasks(freshTasks);
          taskToOpen = freshTasks.find((t: any) => t.id == targetTaskId);
        } catch (err) {}
      }
      if (taskToOpen) {
        setSelectedTask(taskToOpen); setDetailsTab('comments'); setIsDetailsModalOpen(true);
        fetchTaskDetails(taskToOpen.id!); setShowNotifications(false); 
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
    } catch (err) {}
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: newSubtaskTitle, fecha_compromiso: newSubtaskDate || null })
      });
      if (res.ok) { setNewSubtaskTitle(''); setNewSubtaskDate(''); fetchTasks(); }
    } catch(e) {}
  };

  const handleUpdateSubtaskDate = async (subtaskId: number, fecha: string) => {
    setEditingSubtaskDateId(null);
    try {
      await fetch(`/api/tasks/subtasks/${subtaskId}/fecha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_compromiso: fecha || null })
      });
      fetchTasks();
    } catch(e) {}
  };

  const handleUpdateSubtaskTitle = async (subtaskId: number, titulo: string) => {
    if (!titulo.trim()) { setEditingSubtaskTitleId(null); return; }
    setEditingSubtaskTitleId(null);
    try {
      await fetch(`/api/tasks/subtasks/${subtaskId}/titulo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo.trim() })
      });
      fetchTasks();
    } catch(e) {}
  };

  const handleSubtaskReorder = (newOrder: any[]) => {
    setSubtaskItems(newOrder);
    reorderPending.current = true;
  };

  const persistSubtaskOrder = async () => {
    if (!reorderPending.current || !selectedTask) return;
    reorderPending.current = false;
    try {
      await fetch(`/api/tasks/${selectedTask.id}/subtasks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskItemsRef.current.map((st, i) => ({ id: st.id, orden: i })))
      });
    } catch(e) {}
  };

  const handleToggleSubtask = async (subtaskId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/tasks/subtasks/${subtaskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completada: !currentStatus })
      });
      if (res.ok) fetchTasks();
    } catch(e) {}
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!confirm("?Eliminar esta subtarea?")) return;
    try {
      const res = await fetch(`/api/tasks/subtasks/${subtaskId}`, { method: 'DELETE' });
      if (res.ok) fetchTasks();
    } catch(e) {}
  };

  const toggleTaskSubtasksExpand = (taskId: number) => {
    setExpandedTaskSubtasks(prev => { const next = new Set(prev); if (next.has(taskId)) next.delete(taskId); else next.add(taskId); return next; });
  };
  
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    let finalContent = newComment;
    if (replyingTo) finalContent = `> Citando a ${replyingTo.user.nombre}:\n> "${replyingTo.content}"\n\n${newComment}`;

    const payload: any = { task_id: selectedTask.id, content: finalContent };
    if (selectedSubtaskIdForComment) {
       payload.subtask_id = selectedSubtaskIdForComment;
    }

    try {
      const res = await fetch(`/api/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setNewComment(''); setReplyingTo(null); setSelectedSubtaskIdForComment(''); fetchTaskDetails(selectedTask.id!); }
    } catch (err) {} finally { setIsSubmittingComment(false); }
  };


const handleUpdateComment = async (commentId: number) => {
    if (!editCommentContent.trim() || !selectedTask) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editCommentContent })
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditCommentContent('');
        fetchTaskDetails(selectedTask.id!); // Recarga los comentarios
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Error al editar");
      }
    } catch (error) { alert("Error de conexi  n"); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("?Est  s seguro de eliminar este avance?")) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTaskDetails(selectedTask.id!); // Recarga los comentarios
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Error al eliminar");
      }
    } catch (error) { alert("Error de conexi  n"); }
  };




  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.[0]) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      const res = await fetch(`/api/attachments/${selectedTask.id}`, { method: 'POST', body: formData });
      if (res.ok) fetchTaskDetails(selectedTask.id!);
    } catch (err) {} finally { setIsUploading(false); }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !linkUrl.trim()) return;
    setIsAddingLink(true);
    try {
      const res = await fetch(`/api/attachments/${selectedTask.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim() })
      });
      if (res.ok) {
        setLinkUrl(''); setLinkTitle(''); setShowLinkForm(false);
        fetchTaskDetails(selectedTask.id!);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "No se pudo agregar el enlace.");
      }
    } catch (err) {
      alert("Error de conexión al agregar el enlace.");
    } finally { setIsAddingLink(false); }
  };

  useEffect(() => {
    if (currentView === 'control') fetchControlTasks();
  }, [currentView, controlAreaId, currentUser, tasks, allUsers, areas]);

  const toggleResponsible = (userName: string) => {
    setSelectedResponsibles(prev => { if(prev.includes(userName)) return prev.filter(name => name !== userName); else return [...prev, userName]; });
  };

  const handleDragStart = (e: React.DragEvent, task: any) => { e.dataTransfer.setData('taskId', task.id.toString()); };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('taskId');
    if (!taskIdStr) return;

    const taskId = parseInt(taskIdStr);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.estado === newStatus) return;

    if (!currentUser?.is_admin) {
        if (task.estado === 'Completado' || task.estado === 'Cancelado') {
            alert("?? AUDITOR  A: Esta tarea ya est   finalizada y no puede moverse."); return;
        }
        if (task.estado !== 'Planeado' && newStatus === 'Planeado') {
            alert("?? AUDITOR  A: No puedes regresar una tarea en curso al estado 'Planeado'."); return;
        }
    }

    try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...task, estado: newStatus }) });
        if (res.ok) fetchTasks(); else { const errorData = await res.json(); alert(errorData.error || "Error al mover la tarea."); }
    } catch (err) { alert("Error de conexión al mover la tarea."); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  
 /*  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    if (selectedResponsibles.length === 0) { alert("?? Debes seleccionar al menos un responsable para la tarea."); return; }
    const formData = new FormData(e.currentTarget);
    const fInicio = formData.get('fecha_inicio') as string;
    const fFin = formData.get('fecha_fin') as string;
    if (fInicio && fFin && new Date(fFin) < new Date(fInicio)) { alert("?? Error: La Fecha de Compromiso no puede ser anterior a la Fecha de Inicio."); return; }

    try {
      const taskData = {
        // FIX 1: Forzamos el texto a MAY  SCULAS
        actividad: String(formData.get('actividad')).toUpperCase(), 
        responsable: selectedResponsibles.join(', '), 
        fecha_registro: formData.get('fecha_registro'), fecha_inicio: fInicio, fecha_fin: fFin, 
        prioridad: formData.get('prioridad'), prerequisito: formData.get('prerequisito'), 
        observacion: formData.get('observacion'), porcentaje_avance: parseFloat(formData.get('porcentaje_avance') as string) || 0,
        estado: formData.get('estado'), created_by_id: currentUser.id,
        proyecto_id: formData.get('proyecto_id') ? parseInt(formData.get('proyecto_id') as string) : null,
        area_origen_id: formData.get('area_origen_id') ? parseInt(formData.get('area_origen_id') as string) : null,
        gerente_responsable: formData.get('gerente_responsable'), tipo: formData.get('tipo'), tematica: formData.get('tematica'),
        compromiso_semanal: formData.get('compromiso_semanal'), requiere_inversion: formData.get('requiere_inversion') === 'S  ',
        alineacion_estrategica: formData.get('alineacion_estrategica'), impacto: formData.get('impacto'), viabilidad_tecnica: formData.get('viabilidad_tecnica'),
        orden_ejecucion: formData.get('orden_ejecucion') ? parseInt(formData.get('orden_ejecucion') as string) : null
      };
      
      const res = await fetch(editingItem ? `/api/tasks/${editingItem.id}` : '/api/tasks', { method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) { 
          setIsModalOpen(false); 
          fetchTasks(); 
          fetchControlTasks(); 
          setPreselectedProjectId(null); 
          setSelectedResponsibles([]); 
      } 
      else { const errorData = await res.json(); alert(errorData.error || "Ocurri   un error al guardar la tarea."); }
    } catch (err) {}
  }; */
  
  
const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || isSubmitting) return; 
    if (selectedResponsibles.length === 0) { alert("⚠️ Debes seleccionar al menos un responsable para la tarea."); return; }
    
    const formData = new FormData(e.currentTarget);
    const fInicio = formData.get('fecha_inicio') as string;
    const fFin = formData.get('fecha_fin') as string;
    //if (fInicio && fFin && new Date(fFin) < new Date(fInicio)) { alert("⚠️ Error: La Fecha de Compromiso no puede ser anterior a la Fecha de Inicio."); return; }
    if (fInicio && fFin && fFin < fInicio) { alert("⚠️ Error: La Fecha de Compromiso no puede ser anterior a la Fecha de Inicio."); return; }
    setIsSubmitting(true);

    try {
      const taskData = {
        actividad: String(formData.get('actividad')).toUpperCase(), 
        responsable: selectedResponsibles.join(', '), 
        fecha_registro: formData.get('fecha_registro'), fecha_inicio: fInicio, fecha_fin: fFin, 
        prioridad: formData.get('prioridad'), prerequisito: formData.get('prerequisito'), 
        observacion: formData.get('observacion'), porcentaje_avance: parseFloat(formData.get('porcentaje_avance') as string) || 0,
        estado: formData.get('estado'), created_by_id: currentUser.id,
        proyecto_id: formData.get('proyecto_id') ? parseInt(formData.get('proyecto_id') as string) : null,
        area_origen_id: formData.get('area_origen_id') ? parseInt(formData.get('area_origen_id') as string) : null,
        gerente_responsable: formData.get('gerente_responsable'), tipo: formData.get('tipo'), tematica: formData.get('tematica'),
        compromiso_semanal: formData.get('compromiso_semanal'), requiere_inversion: formData.get('requiere_inversion') === 'Sí',
        alineacion_estrategica: formData.get('alineacion_estrategica'), impacto: formData.get('impacto'), viabilidad_tecnica: formData.get('viabilidad_tecnica'),
        orden_ejecucion: formData.get('orden_ejecucion') ? parseInt(formData.get('orden_ejecucion') as string) : null
      };
      
      const res = await fetch(editingItem ? `/api/tasks/${editingItem.id}` : '/api/tasks', { 
        method: editingItem ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(taskData) 
      });
      
      if (res.status === 401) { handleLogout(); return; }
      
  /*     if (res.ok) { 
          setIsModalOpen(false); 
          fetchTasks(); 
          fetchControlTasks(); 
          setPreselectedProjectId(null); 
          setSelectedResponsibles([]); 
      } 
      else { 
          // AQUÍ SE CAPTURA EL MENSAJE DE AUDITORÍA
          const errorData = await res.json(); 
          alert(errorData.error || "Ocurrió un error al guardar la tarea."); 
      } 




 

    } catch (err) {
      alert("Error de conexión al servidor al guardar la tarea.");
    } finally {
      setIsSubmitting(false); 
    }
  }; */
  
  
  
if (res.ok) {
          setIsModalOpen(false);
          setEditingTaskFromProject(false);
          fetchTasks();
          fetchControlTasks();
          setPreselectedProjectId(null);
          setSelectedResponsibles([]);
      }
      else {
          const errorData = await res.json();
          alert(errorData.error || "Ocurrió un error al guardar la tarea.");

          // 👇 REFRESH AUTOMÁTICO EN CASO DE ERROR
          setIsModalOpen(false); // Cerramos el modal para limpiar la vista
          setEditingTaskFromProject(false);
          fetchTasks();          // Recargamos los datos reales de la BD
          fetchControlTasks();
      }
    } catch (err) {
      alert("Error de conexión al servidor al guardar la tarea.");

      // 👇 REFRESH AUTOMÁTICO EN CASO DE CAÍDA DE RED
      setIsModalOpen(false);
      setEditingTaskFromProject(false);
      fetchTasks();
      fetchControlTasks();
    } finally {
      setIsSubmitting(false); 
    }
  };


/* 
const handleQuickUpdate = async (taskId: number, field: string, value: any) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/quick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        fetchTasks(); 
        fetchControlTasks(); 
      } else {
        // AQUÍ ESTÁ LA CORRECCIÓN: Leemos el mensaje exacto de auditoría
        const errorData = await res.json();
        alert(errorData.error || "Error al actualizar el dato.");
        
        // Refrescamos la pantalla para borrar el intento fallido de la vista
        fetchTasks(); 
        fetchControlTasks();
      }
    } catch (err) {
      alert("Error de conexión al servidor.");
      fetchTasks();
    }
  }; */

const handleQuickUpdate = async (taskId: number, field: string, value: any) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/quick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        fetchTasks(); 
        fetchControlTasks(); 
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Error al actualizar el dato.");
        
        // 👇 REFRESH AUTOMÁTICO: Obliga a la tabla a regresar al valor original
        fetchTasks(); 
        fetchControlTasks();
      }
    } catch (err) {
      alert("Error de conexión al servidor.");
      // 👇 REFRESH AUTOMÁTICO: Si hay error de red, repintamos la tabla
      fetchTasks();
      fetchControlTasks();
    }
  };





const handleDeleteEvidence = async (evidenceId: number) => {
    if (!window.confirm("⚠️ ¿Estás seguro de que deseas eliminar esta evidencia? Esta acción no se puede deshacer y la borrará permanentemente.")) return;

    try {
      const res = await fetch(`/api/tasks/evidence/${evidenceId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Soft Refresh: Recargamos las tablas para que el archivo desaparezca de la vista instantáneamente
        fetchTasks();
        fetchControlTasks();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Ocurrió un error al intentar eliminar la evidencia.");
      }
    } catch (err) {
      alert("Error de conexión al servidor al intentar eliminar la evidencia.");
    }
  };
  
  
  // 🚀 NUEVA FUNCIÓN: Borrado exclusivo desde Control de Gestión
  const handleDeleteControlTask = async (taskId: number) => {
    if (!window.confirm("⚠️ ¿Estás seguro de que deseas eliminar esta tarea desde el Control de Gestión. Esta acción la ocultará de los tableros.")) return;

    try {
      const res = await fetch(`/api/control/tasks/${taskId}/delete`, {
        method: 'PATCH'
      });

      if (res.ok) {
        // Refresco de tablas para desaparecer el registro
        fetchControlTasks();
        fetchTasks();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Ocurrió un error al intentar eliminar la tarea.");
      }
    } catch (err) {
      alert("Error de conexión al servidor.");
    }
  };



  
  

  const handleProjectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fInicio = formData.get('fecha_inicio') as string; const fFin = formData.get('fecha_fin') as string;
    //if (fInicio && fFin && new Date(fFin) < new Date(fInicio)) { alert("?? Error: La Fecha de Fin Estimada del proyecto no puede ser anterior a la Fecha de Inicio."); return; }
    if (fInicio && fFin && fFin < fInicio) { alert("⚠️ Error: La Fecha de Fin Estimada del proyecto no puede ser anterior a la Fecha de Inicio."); return; }
    try {
      const projectData = {
        nombre: formData.get('nombre'), descripcion: formData.get('descripcion'), estado: formData.get('estado'), 
        fecha_inicio: fInicio, fecha_fin: fFin, lider_id: formData.get('lider_id') ? parseInt(formData.get('lider_id') as string) : null,
        prioritario: formData.get('prioritario') === 'on' 
      };
      const res = await fetch(editingItem ? `/api/projects/${editingItem.id}` : '/api/projects', { method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
      if (res.ok) { setIsModalOpen(false); fetchProjects(); }
    } catch (err) {}
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
      const res = await fetch(editingItem ? `/api/areas/${editingItem.id}` : '/api/areas', { method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(areaData) });
      if (res.ok) { setIsModalOpen(false); fetchAreas(); fetchUsers(); }
    } catch (err) {}
  };

  const handleUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formEmail = formData.get('email') as string;

    const duplicate = allUsers.find(u => u.email.toLowerCase() === formEmail.toLowerCase() && (editingItem ? u.id !== editingItem.id : true) );
    if (duplicate) { if (!confirm(`?? El correo ${formEmail} ya est   asignado al usuario ${duplicate.nombre} ${duplicate.apellido}.\n\n?Est  s seguro de continuar y usar el mismo correo para este registro?`)) return; }

    try {
      const userData = {
        nombre: formData.get('nombre'), apellido: formData.get('apellido'), cargo: formData.get('cargo'),
        jefe_directo: formJefe, area_id: formData.get('area_id') ? parseInt(formData.get('area_id') as string) : null,
        email: formEmail, password: formData.get('password') || undefined,
        is_admin: formData.get('is_admin') === 'on' ? 1 : 0, debe_cambiar_password: formData.get('debe_cambiar_password') === 'on' ? 1 : 0,
        acceso_supervision: accesoSupervision ? 1 : 0, areas_autorizadas: selectedAreas.join(','),
        can_create_tasks: formData.get('can_create_tasks') === 'on' ? 1 : 0, can_edit_tasks: formData.get('can_edit_tasks') === 'on' ? 1 : 0, can_delete_tasks: formData.get('can_delete_tasks') === 'on' ? 1 : 0,
        perm_users_view: formData.get('perm_users_view') === 'on' ? 1 : 0, perm_users_create: formData.get('perm_users_create') === 'on' ? 1 : 0,
        perm_users_edit: formData.get('perm_users_edit') === 'on' ? 1 : 0, perm_users_delete: formData.get('perm_users_delete') === 'on' ? 1 : 0,
        perm_areas_view: formData.get('perm_areas_view') === 'on' ? 1 : 0, perm_areas_create: formData.get('perm_areas_create') === 'on' ? 1 : 0,
        perm_areas_edit: formData.get('perm_areas_edit') === 'on' ? 1 : 0, perm_areas_delete: formData.get('perm_areas_delete') === 'on' ? 1 : 0,
        perm_projects_view: formData.get('perm_projects_view') === 'on' ? 1 : 0, perm_projects_create: formData.get('perm_projects_create') === 'on' ? 1 : 0,
        perm_projects_edit: formData.get('perm_projects_edit') === 'on' ? 1 : 0, perm_projects_delete: formData.get('perm_projects_delete') === 'on' ? 1 : 0,
        perm_reports_view: formData.get('perm_reports_view') === 'on' ? 1 : 0,
        perm_gantt_view: formData.get('perm_gantt_view') === 'on' ? 1 : 0,
        // FIX 2: Agregamos el nuevo permiso para edici  n en Control de Gesti  n
        perm_control_edit: formData.get('perm_control_edit') === 'on' ? 1 : 0,
		
		perm_control_delete: formData.get('perm_control_delete') === 'on' ? 1 : 0,
        can_download_evidence: formData.get('can_download_evidence') === 'on' ? true : false,
		
        can_download_evidence: formData.get('can_download_evidence') === 'on' ? true : false,
        can_delete_evidence: formData.get('can_delete_evidence') === 'on' ? true : false,
        perm_subtasks_view: formData.get('perm_subtasks_view') === 'on' ? 1 : 0, perm_subtasks_create: formData.get('perm_subtasks_create') === 'on' ? 1 : 0,
        perm_subtasks_edit: formData.get('perm_subtasks_edit') === 'on' ? 1 : 0, perm_subtasks_edit_title: formData.get('perm_subtasks_edit_title') === 'on' ? 1 : 0,
        perm_subtasks_delete: formData.get('perm_subtasks_delete') === 'on' ? 1 : 0,
      };
      const res = await fetch(editingItem ? `/api/users/${editingItem.id}` : '/api/users', { method: editingItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
      if (res.ok) { setIsModalOpen(false); fetchUsers(); } 
      else { const data = await res.json().catch(() => ({})); alert(data.error || "Error del servidor."); }
    } catch (err) {}
  };

  const handleDelete = async (id: number, type: View) => {
    if (!confirm(`?Est  s seguro de eliminar este registro?`)) return;
    try {
      const res = await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
      if (res.ok) { 
        if (type === 'tasks') fetchTasks(); if (type === 'users') fetchUsers(); 
        if (type === 'areas') fetchAreas(); if (type === 'projects') fetchProjects();
      } else { const data = await res.json(); alert(data.error || "Ocurri   un error."); }
    } catch (err) {}
  };
  
  
  
  
  

  const exportToExcelData = async (tasksToExport: any[], filenamePrefix: string, filterDesc?: string) => {
    if (tasksToExport.length === 0) return alert("No hay datos para exportar.");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'TaskFlow Pro';
    workbook.created = new Date();

    const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const bdr = (argb = 'FFe2e8f0') => ({ style: 'thin' as const, color: { argb } });
    const cellBorder = { top: bdr(), left: bdr(), bottom: bdr(), right: bdr() };

    const estadoBg: Record<string, string> = {
      'Completado': 'FFd1fae5', 'En curso': 'FFdbeafe', 'En espera': 'FFfef9c3',
      'Cancelado': 'FFe2e8f0', 'Planeado': 'FFf1f5f9',
    };
    const estadoFg: Record<string, string> = {
      'Completado': 'FF065f46', 'En curso': 'FF1e40af', 'En espera': 'FF92400e',
      'Cancelado': 'FF475569', 'Planeado': 'FF334155',
    };
    const avanceBg = (p: number) => p >= 76 ? 'FFbbf7d0' : p >= 51 ? 'FFbfdbfe' : p >= 26 ? 'FFfde68a' : 'FFfecaca';

    // ── SHEET 1: LISTADO DE TAREAS ──────────────────────────────────────────
    const ws1 = workbook.addWorksheet('Listado de Tareas', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });
    ws1.views = [{ state: 'frozen', ySplit: 4 }];

    const COLS = [
      { key: 'id',                 width: 7,  header: 'ID' },
      { key: 'actividad',          width: 45, header: 'Actividad' },
      { key: 'responsable',        width: 35, header: 'Responsable(s)' },
      { key: 'area_origen',        width: 22, header: 'Área / Origen' },
      { key: 'proyecto',           width: 25, header: 'Proyecto / Iniciativa' },
      { key: 'gerente',            width: 22, header: 'Gerente Responsable' },
      { key: 'tipo',               width: 18, header: 'Tipo' },
      { key: 'estado',             width: 14, header: 'Estado' },
      { key: 'fechaFin',           width: 16, header: 'Fecha Compromiso' },
      { key: 'fechaCierre',        width: 16, header: 'Fecha de Cierre' },
      { key: 'diasAtraso',         width: 14, header: 'Días de Atraso' },
      { key: 'tematica',           width: 22, header: 'Temática' },
      { key: 'prioridad',          width: 13, header: 'Prioridad' },
      { key: 'avance',             width: 11, header: '% Avance' },
      { key: 'subtareas',          width: 13, header: 'Subtareas' },
      { key: 'compromiso_semanal', width: 40, header: 'Compromiso Semanal' },
      { key: 'dependencia',        width: 22, header: 'Dependencia' },
      { key: 'inversion',          width: 15, header: 'Requiere Inversión' },
      { key: 'alineacion',         width: 30, header: 'Alineación Estratégica' },
      { key: 'impacto',            width: 22, header: 'Impacto' },
      { key: 'viabilidad',         width: 22, header: 'Viabilidad Técnica' },
      { key: 'calificacion',       width: 13, header: 'Calificación' },
      { key: 'orden_ejecucion',    width: 10, header: 'Orden' },
      { key: 'observaciones',      width: 50, header: 'Observaciones' },
    ];
    const NCOLS = COLS.length;
    const LAST_COL = String.fromCharCode(64 + NCOLS);
    ws1.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    // Fila 1: Título
    ws1.mergeCells(`A1:${LAST_COL}1`);
    const r1 = ws1.getCell('A1');
    r1.value = `REPORTE DE ACTIVIDADES — ${new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })} — Exportado por: ${workbook.creator}`;
    r1.fill = fill('FF0f172a'); r1.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 30;

    // Fila 2: Filtros
    ws1.mergeCells(`A2:${LAST_COL}2`);
    const r2 = ws1.getCell('A2');
    r2.value = filterDesc ? `Filtros: ${filterDesc}  |  ${tasksToExport.length} registros` : `Sin filtros aplicados  |  ${tasksToExport.length} registros`;
    r2.fill = fill('FF1e293b'); r2.font = { color: { argb: 'FFcbd5e1' }, size: 9, italic: true };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(2).height = 20;

    // Fila 3: Separador
    ws1.getRow(3).height = 5;

    // Fila 4: Encabezados
    const hRow = ws1.getRow(4);
    hRow.height = 32;
    COLS.forEach((col, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = col.header;
      cell.fill = fill('FF1e293b');
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: bdr('FF0f172a'), left: bdr('FF0f172a'), bottom: { style: 'medium', color: { argb: 'FF0f172a' } }, right: bdr('FF0f172a') };
    });

    // Filas de datos
    tasksToExport.forEach((task, idx) => {
      const overdueDays = getDaysOverdue(task.fecha_fin, task.estado);
      const isOverdue = overdueDays > 0;
      const rowBg = isOverdue ? 'FFfff1f2' : idx % 2 === 0 ? 'FFfafafa' : 'FFFFFFFF';
      const fechaDate = task.fecha_fin ? new Date(String(task.fecha_fin).split('T')[0] + 'T00:00:00') : null;
      const fechaCierreDate = (task as any).fecha_ejecucion ? new Date(String((task as any).fecha_ejecucion).split('T')[0] + 'T00:00:00') : null;
      const totalSub = task.subtasks?.length || 0;
      const compSub = task.subtasks?.filter((s: any) => s.completada).length || 0;
      const avancePct = Number(task.porcentaje_avance) || 0;

      const row = ws1.addRow({
        id: task.id,
        actividad: task.actividad || '-',
        responsable: task.responsable || '-',
        area_origen: areas.find(a => a.id === task.area_origen_id)?.nombre || 'Sin Área',
        proyecto: projects.find(p => p.id === task.proyecto_id)?.nombre || 'Sin Proyecto',
        gerente: task.gerente_responsable || 'Sin Asignar',
        tipo: task.tipo || '-',
        estado: task.estado,
        fechaFin: fechaDate,
        fechaCierre: fechaCierreDate,
        diasAtraso: isOverdue ? overdueDays : task.estado === 'Completado' ? 'Completada' : 'Al día',
        tematica: task.tematica || '-',
        prioridad: getPriorityLabel(task.prioridad),
        avance: avancePct / 100,
        subtareas: totalSub > 0 ? `${compSub}/${totalSub}` : '-',
        compromiso_semanal: task.compromiso_semanal || '-',
        dependencia: task.prerequisito || '-',
        inversion: task.requiere_inversion ? 'Sí' : 'No',
        alineacion: task.alineacion_estrategica || '-',
        impacto: task.impacto || '-',
        viabilidad: task.viabilidad_tecnica || '-',
        calificacion: task.calificacion || '-',
        orden_ejecucion: task.orden_ejecucion ?? `Sug. #${idx + 1}`,
        observaciones: task.observacion || '-',
      });
      row.height = 20;

      // Estilo base: zebra + borde
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = fill(rowBg);
        cell.font = { size: 10, color: { argb: isOverdue ? 'FF9f1239' : 'FF334155' } };
        cell.alignment = { vertical: 'middle' };
        cell.border = cellBorder;
      });

      // Estado: color por valor
      const eCell = row.getCell('estado');
      eCell.fill = fill(estadoBg[task.estado] || 'FFf1f5f9');
      eCell.font = { bold: true, size: 10, color: { argb: estadoFg[task.estado] || 'FF334155' } };
      eCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // % Avance: número real + escala de color
      const aCell = row.getCell('avance');
      aCell.numFmt = '0%';
      aCell.fill = fill(avanceBg(avancePct));
      aCell.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
      aCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Fecha: formato fecha real
      if (fechaDate) {
        const fCell = row.getCell('fechaFin');
        fCell.numFmt = 'DD/MM/YYYY';
        fCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Fecha de cierre: mismo formato (vacía si la tarea aún no se ha cerrado)
      if (fechaCierreDate) {
        const fcCell = row.getCell('fechaCierre');
        fcCell.numFmt = 'DD/MM/YYYY';
        fcCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Días de atraso: color
      const dCell = row.getCell('diasAtraso');
      dCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (isOverdue) {
        dCell.fill = fill('FFfecaca');
        dCell.font = { bold: true, size: 10, color: { argb: 'FF991b1b' } };
      } else if (task.estado === 'Completado') {
        dCell.font = { size: 10, color: { argb: 'FF065f46' } };
      }
    });

    ws1.autoFilter = `A4:${LAST_COL}4`;

    // ── SHEET 2: RESUMEN POR ÁREA ───────────────────────────────────────────
    const ws2 = workbook.addWorksheet('Resumen por Área');
    ws2.columns = [{ width: 30 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 16 }];

    ws2.mergeCells('A1:H1');
    const ws2t = ws2.getCell('A1');
    ws2t.value = 'RESUMEN POR ÁREA'; ws2t.fill = fill('FF0f172a');
    ws2t.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    ws2t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 28;

    const aHdrs = ['Área', 'Total', 'Completadas', 'En Curso', 'En Espera', 'Atrasadas', '% Completadas', 'Avance Promedio'];
    const hRow2 = ws2.getRow(2);
    hRow2.height = 26;
    aHdrs.forEach((h, i) => {
      const c = hRow2.getCell(i + 1);
      c.value = h; c.fill = fill('FF1e293b');
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = cellBorder;
    });

    let tot = 0, totComp = 0, totCurso = 0, totEspera = 0, totAtr = 0;
    areas.forEach((area, idx) => {
      const at = tasksToExport.filter(t => t.area_origen_id === area.id);
      if (!at.length) return;
      const comp = at.filter(t => t.estado === 'Completado').length;
      const curso = at.filter(t => t.estado === 'En curso').length;
      const espera = at.filter(t => t.estado === 'En espera').length;
      const atr = at.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length;
      tot += at.length; totComp += comp; totCurso += curso; totEspera += espera; totAtr += atr;
      const avgPct = at.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / at.length;
      const row = ws2.addRow([area.nombre, at.length, comp, curso, espera, atr, comp / at.length, avgPct / 100]);
      row.height = 20;
      const bg = idx % 2 === 0 ? 'FFfafafa' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (c, ci) => {
        c.fill = fill(bg); c.font = { size: 10 };
        c.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }; c.border = cellBorder;
      });
      row.getCell(7).numFmt = '0%'; row.getCell(8).numFmt = '0%';
      if (atr > 0) { row.getCell(6).fill = fill('FFfecaca'); row.getCell(6).font = { bold: true, size: 10, color: { argb: 'FF991b1b' } }; }
    });

    const globalAvg = tasksToExport.length > 0 ? tasksToExport.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / tasksToExport.length : 0;
    const tRow2 = ws2.addRow(['TOTALES', tot, totComp, totCurso, totEspera, totAtr, tot > 0 ? totComp / tot : 0, globalAvg / 100]);
    tRow2.height = 22;
    tRow2.eachCell({ includeEmpty: true }, (c, ci) => {
      c.fill = fill('FFe2e8f0'); c.font = { bold: true, size: 10 };
      c.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' };
      c.border = { ...cellBorder, top: { style: 'medium', color: { argb: 'FF334155' } } };
    });
    tRow2.getCell(7).numFmt = '0%'; tRow2.getCell(8).numFmt = '0%';

    // ── SHEET 3: RESUMEN POR RESPONSABLE ───────────────────────────────────
    const ws3 = workbook.addWorksheet('Resumen por Responsable');
    ws3.columns = [{ width: 35 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 16 }];

    ws3.mergeCells('A1:F1');
    const ws3t = ws3.getCell('A1');
    ws3t.value = 'RESUMEN POR RESPONSABLE'; ws3t.fill = fill('FF0f172a');
    ws3t.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    ws3t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws3.getRow(1).height = 28;

    const rHdrs = ['Responsable', 'Total', 'Completadas', 'Pendientes', 'Atrasadas', 'Avance Promedio'];
    const hRow3 = ws3.getRow(2);
    hRow3.height = 26;
    rHdrs.forEach((h, i) => {
      const c = hRow3.getCell(i + 1);
      c.value = h; c.fill = fill('FF1e293b');
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = cellBorder;
    });

    const userStatsAll = allUsers.map(u => {
      const name = `${u.nombre} ${u.apellido}`;
      const ut = tasksToExport.filter(t => t.responsable && String(t.responsable).includes(name));
      if (!ut.length) return null;
      return {
        name, total: ut.length,
        completed: ut.filter(t => t.estado === 'Completado').length,
        pending: ut.filter(t => t.estado !== 'Completado' && t.estado !== 'Cancelado').length,
        overdue: ut.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length,
        avg: ut.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / ut.length,
      };
    }).filter(Boolean).sort((a: any, b: any) => b.total - a.total) as any[];

    userStatsAll.forEach((u, idx) => {
      const row = ws3.addRow([u.name, u.total, u.completed, u.pending, u.overdue, u.avg / 100]);
      row.height = 20;
      const bg = idx % 2 === 0 ? 'FFfafafa' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (c, ci) => {
        c.fill = fill(bg); c.font = { size: 10 };
        c.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }; c.border = cellBorder;
      });
      row.getCell(6).numFmt = '0%';
      if (u.overdue > 0) { row.getCell(5).fill = fill('FFfecaca'); row.getCell(5).font = { bold: true, size: 10, color: { argb: 'FF991b1b' } }; }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportExcel = () => {
    const tasksData = currentView === 'tasks' ? filteredTasks : filteredControlTasks;
    const parts: string[] = [];
    if (searchTerm) parts.push(`Búsqueda: "${searchTerm}"`);
    if (statusFilter !== 'All') parts.push(`Estado: ${statusFilter}`);
    if (taskPriorityFilter.length > 0) parts.push(`Prioridad: ${taskPriorityFilter.map(getPriorityLabel).join(', ')}`);
    if (taskDateFrom) parts.push(`Desde: ${taskDateFrom}`);
    if (taskDateTo) parts.push(`Hasta: ${taskDateTo}`);
    exportToExcelData(tasksData, 'Reporte_General', parts.length ? parts.join(' | ') : undefined);
  };

  const handleExportFilteredReport = () => {
    const parts: string[] = [];
    if (reportAreaFilter.length > 0) { const names = reportAreaFilter.map(id => areas.find(x => String(x.id) === id)?.nombre).filter(Boolean); if (names.length) parts.push(`Área: ${names.join(', ')}`); }
    if (reportProjectFilter.length > 0) { const names = reportProjectFilter.map(id => projects.find(x => String(x.id) === id)?.nombre).filter(Boolean); if (names.length) parts.push(`Proyecto: ${names.join(', ')}`); }
    if (reportDateFrom) parts.push(`Desde: ${reportDateFrom}`);
    if (reportDateTo) parts.push(`Hasta: ${reportDateTo}`);
    exportToExcelData(filteredReportTasks, 'Reporte_Filtrado', parts.length ? parts.join(' | ') : undefined);
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Plantilla_Importacion');

    worksheet.columns = [
      { header: 'Ignorar', key: 'ignore1', width: 10 }, 
      { header: 'Actividad (*Obligatorio)', key: 'actividad', width: 40 },
      { header: 'Responsable', key: 'responsable', width: 30 }, 
      { header: 'Área Origen', key: 'area', width: 20 },
      { header: 'Proyecto', key: 'proyecto', width: 20 }, 
      { header: 'Gerente Responsable', key: 'gerente', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 15 }, 
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Fecha Inicio (YYYY-MM-DD)', key: 'fecha_inicio', width: 20 }, 
      { header: 'Fecha Fin Estimada (YYYY-MM-DD)', key: 'fecha_fin', width: 20 }, 
      { header: 'Temática', key: 'tematica', width: 20 },
      { header: 'Prioridad', key: 'prioridad', width: 15 }, 
      { header: '% Avance', key: 'avance', width: 15 },
      { header: 'Compromiso Semanal', key: 'compromiso', width: 30 }, 
      { header: 'Dependencia (Prerequisito)', key: 'prerequisito', width: 20 },
      { header: 'Requiere Inversión (S  /No)', key: 'inversion', width: 20 }, 
      { header: 'Alineación Estratégica', key: 'alineacion', width: 30 },
      { header: 'Impacto', key: 'impacto', width: 20 }, 
      { header: 'Viabilidad Técnica', key: 'viabilidad', width: 20 },
      { header: 'Ignorar', key: 'ignore20', width: 10 }, 
      { header: 'Observación', key: 'observacion', width: 40 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4f46e5' } }; cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; });

    worksheet.addRow({
      ignore1: '', actividad: 'EJEMPLO DE TAREA NUEVA', responsable: 'Nombre Apellido',
      area: 'Sistemas', proyecto: 'Migración Nube', gerente: 'Jefe Sistemas',
      tipo: 'Soporte', estado: 'Planeado', 
      fecha_inicio: '2026-04-01', 
      fecha_fin: '2026-12-31', 
      tematica: 'Infraestructura',
      prioridad: 'Alta', avance: '0', compromiso: 'Avanzar 20%', prerequisito: 'Ninguno',
      inversion: 'No', alineacion: 'WIG 2 Reducci  n y control del costo', impacto: '2. Medio',
      viabilidad: '3. Baja Complejidad', ignore20: '', observacion: 'Prueba de importaci  n'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Plantilla_Importacion_Tareas.xlsx`);
    setShowImportMenu(false); 
  };
  
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0]; 
      if (!worksheet) throw new Error("El archivo no tiene hojas");

      const rows: any[] = [];
      const mapPriorityToSystem = (p: string) => {
          const str = String(p || '').toUpperCase();
          if(str.includes('MUY ALTA')) return '0|Muy Alta';
          if(str.includes('ALTA')) return '1|Alta';
          if(str.includes('MEDIA')) return '2|Media';
          if(str.includes('MUY BAJA')) return '4|Muy Baja';
          if(str.includes('BAJA')) return '3|Baja';
          return '2|Media';
      };

  /*     const parseExcelDate = (cell: ExcelJS.Cell | undefined) => {
        if (!cell) return '';
        if (cell.value instanceof Date) {
            const d = cell.value;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        const text = cell.text || String(cell.value || '').trim();
        if (text.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
            const parts = text.split(/[\/\-]/);
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return text;
      }; */
	  
	  
	  const parseExcelDate = (cell: ExcelJS.Cell | undefined) => {
          if (!cell) return '';
          if (cell.value instanceof Date) {
            const d = cell.value;
            // 🚀 CORRECCIÓN: Usamos UTC para extraer el número exacto e ignorar la zona horaria local
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          const text = cell.text || String(cell.value || '').trim();
          if (text.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
            const parts = text.split(/[\/\-]/);
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          return text;
        };

      const normalizeForMatch = (str: string) => {
          return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
      };

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; 
        const val = (colIndex: number) => row.getCell(colIndex)?.text || '';
        
        // FIX 1B: Forzamos la actividad importada a MAY  SCULAS
        const actividad = val(2).toUpperCase(); 
        if (!actividad) return; 

        const areaName = val(4); const projectName = val(5);
        const areaObj = areas.find(a => normalizeForMatch(a.nombre) === normalizeForMatch(areaName));
        const projectObj = projects.find(p => normalizeForMatch(p.nombre) === normalizeForMatch(projectName));

        const rawFechaInicio = parseExcelDate(row.getCell(9));
        const finalFechaInicio = rawFechaInicio || new Date().toISOString().split('T')[0];

        rows.push({
          actividad: actividad, responsable: val(3), area_origen_id: areaObj ? areaObj.id : null,
          proyecto_id: projectObj ? projectObj.id : null, gerente_responsable: val(6),
          tipo: val(7), estado: val(8) || 'Planeado', 
          fecha_inicio: finalFechaInicio, 
          fecha_fin: parseExcelDate(row.getCell(10)), 
          tematica: val(11), 
          prioridad: mapPriorityToSystem(val(12)), 
          porcentaje_avance: parseInt(val(13).replace('%', '')) || 0, 
          compromiso_semanal: val(14), 
          prerequisito: val(15), 
          requiere_inversion: val(16).toLowerCase() === 's  ' || val(16).toLowerCase() === 'si', 
          alineacion_estrategica: val(17), 
          impacto: val(18), 
          viabilidad_tecnica: val(19), 
          observacion: val(21), 
          fecha_registro: new Date().toISOString().split('T')[0] 
        });
      });

      if (rows.length === 0) { alert("No se encontraron tareas v  lidas."); setIsImporting(false); return; }

      const res = await fetch('/api/tasks/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: rows }) });
      
      if (res.ok) { 
          alert(`Éxito! Se importaron ${rows.length} tareas correctamente.`); 
          await fetchTasks(); 
          await fetchControlTasks(); 
      } 
      else { alert("Error al importar en el servidor."); }

    } catch (error) { alert("Error al leer el archivo Excel."); } finally { e.target.value = ''; setIsImporting(false); }
  };

  const toggleArea = (id: number) => setExpandedAreas(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleProject = (id: number) => setExpandedProjects(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const renderAreaTree = (parentId: number | null = null, level: number = 0): React.ReactNode => {
    const children = areas.filter(a => (parentId === null ? !a.parent_area_id : a.parent_area_id === parentId));
    return children.map((area) => {
      const isExpanded = expandedAreas.has(area.id!);
      const hasChildren = areas.some(a => a.parent_area_id === area.id);
      return (
        <React.Fragment key={area.id}>
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 ml-${level * 8}`}>
             <h3 className="font-bold text-slate-900 flex justify-between">
                <span onClick={() => hasChildren && toggleArea(area.id!)} className="cursor-pointer flex items-center gap-2">
                  {hasChildren && <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}{area.nombre}
                </span>
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

  // ───────────────────────────────────────────────────────────────────────
  // Vista Cronograma (Gantt) — solo lectura, supervisión dirección + PM.
  // Componente propio (sin dependencias): tareas activas agrupadas por proyecto
  // sobre una línea de tiempo con escala semana/mes/trimestre.
  // ───────────────────────────────────────────────────────────────────────
  const renderGanttView = () => {
    const MS_DAY = 86400000;
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Parseo sin desfase de zona horaria (mismo patrón que getDaysOverdue).
    const parseLocalDate = (v: any): Date | null => {
      if (!v) return null;
      const parts = String(v).split('T')[0].split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts.map(Number);
      if (!y || !m || !d) return null;
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    };

    // Normaliza estados inconsistentes en BD ("En Espera"/"En espera", "Planeada"/"Planeado").
    const normalizeEstado = (e: string) => {
      const s = String(e || '').trim().toLowerCase();
      if (s.startsWith('planea')) return 'Planeado';
      if (s.startsWith('en curso')) return 'En curso';
      if (s.startsWith('en espera')) return 'En espera';
      if (s.startsWith('complet') || s.startsWith('finaliz')) return 'Completado';
      if (s.startsWith('cancel')) return 'Cancelado';
      return String(e || '').trim() || 'Sin estado';
    };

    const ESTADO_CLR: Record<string, string> = {
      'Planeado': '#64748b', 'En curso': '#3b82f6', 'En espera': '#f59e0b',
      'Completado': '#10b981', 'Cancelado': '#94a3b8', 'Sin estado': '#cbd5e1',
    };

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    // 1) Tareas activas con fechas saneadas (swap si fin < inicio).
    const activos = tasks
      .map(t => {
        const estado = normalizeEstado(t.estado);
        let ini = parseLocalDate(t.fecha_inicio);
        let fin = parseLocalDate(t.fecha_fin);
        if (!ini && fin) ini = fin;
        if (!fin && ini) fin = ini;
        if (!ini || !fin) return null;
        if (fin.getTime() < ini.getTime()) { const tmp = ini; ini = fin; fin = tmp; }
        return { task: t, estado, ini, fin };
      })
      .filter((x): x is { task: any; estado: string; ini: Date; fin: Date } => !!x)
      .filter(x => x.estado !== 'Completado' && x.estado !== 'Cancelado');

    if (activos.length === 0) {
      return (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <GanttChartSquare size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">No hay tareas activas para mostrar en el cronograma.</p>
        </div>
      );
    }

    // 2) Rango temporal (incluye "hoy" para que la línea siempre sea visible).
    //    Acotado a una ventana sensata [hoy−2 años, hoy+3 años] para que una fecha
    //    atípica/errónea (typo tipo 2099) no trunque la grilla ni infle el ancho.
    //    Las barras fuera de la ventana se recortan al borde (ver más abajo).
    const floorT = new Date(hoy.getFullYear() - 2, 0, 1).getTime();
    const ceilT = new Date(hoy.getFullYear() + 3, 11, 31).getTime();
    const minT = Math.max(floorT, Math.min(hoy.getTime(), ...activos.map(a => a.ini.getTime())));
    const maxT = Math.min(ceilT, Math.max(hoy.getTime(), ...activos.map(a => a.fin.getTime())));

    const dayWidth = ganttScale === 'week' ? 11 : ganttScale === 'quarter' ? 1.7 : 3.6;

    // Alinear el inicio de la grilla al comienzo del primer periodo.
    const gridStart = new Date(minT);
    gridStart.setHours(0, 0, 0, 0);
    if (ganttScale === 'week') {
      gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7)); // al lunes
    } else if (ganttScale === 'quarter') {
      gridStart.setDate(1); gridStart.setMonth(Math.floor(gridStart.getMonth() / 3) * 3);
    } else {
      gridStart.setDate(1);
    }

    // Construir periodos (columnas) hasta cubrir maxT.
    const periods: { start: Date; label: string }[] = [];
    const cursor = new Date(gridStart);
    let guard = 0;
    while (cursor.getTime() <= maxT && guard < 800) {
      guard++;
      let label = '';
      if (ganttScale === 'week') label = `${cursor.getDate()} ${MESES[cursor.getMonth()]}`;
      else if (ganttScale === 'quarter') label = `Q${Math.floor(cursor.getMonth() / 3) + 1} ${String(cursor.getFullYear()).slice(2)}`;
      else label = `${MESES[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`;
      periods.push({ start: new Date(cursor), label });
      if (ganttScale === 'week') cursor.setDate(cursor.getDate() + 7);
      else if (ganttScale === 'quarter') cursor.setMonth(cursor.getMonth() + 3);
      else cursor.setMonth(cursor.getMonth() + 1);
    }

    const gridStartT = gridStart.getTime();
    const gridEndT = cursor.getTime();
    const totalWidth = ((gridEndT - gridStartT) / MS_DAY) * dayWidth;
    const xOf = (t: number) => ((t - gridStartT) / MS_DAY) * dayWidth;
    const todayX = xOf(hoy.getTime());
    const LABEL_W = 260;

    // 3) Agrupar por proyecto.
    const grupos: { key: string; nombre: string; items: typeof activos }[] = [];
    const idx: Record<string, number> = {};
    for (const a of activos) {
      const proj = projects.find(p => p.id === a.task.proyecto_id);
      const key = proj ? `p${proj.id}` : 'sin';
      const nombre = proj ? proj.nombre : 'Sin proyecto';
      if (idx[key] === undefined) { idx[key] = grupos.length; grupos.push({ key, nombre, items: [] }); }
      grupos[idx[key]].items.push(a);
    }
    grupos.forEach(g => g.items.sort((x, y) => x.ini.getTime() - y.ini.getTime()));
    grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const scaleBtn = (val: 'week' | 'month' | 'quarter', txt: string) => (
      <button onClick={() => setGanttScale(val)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${ganttScale === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{txt}</button>
    );

    const leyenda = [
      { label: 'Planeado', clr: ESTADO_CLR['Planeado'] },
      { label: 'En curso', clr: ESTADO_CLR['En curso'] },
      { label: 'En espera', clr: ESTADO_CLR['En espera'] },
      { label: 'Atrasada', clr: '#ef4444' },
    ];

    const modeBtn = (val: 'bars' | 'calendar', icon: React.ReactNode, txt: string) => (
      <button onClick={() => setGanttMode(val)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${ganttMode === val ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{icon}{txt}</button>
    );

    // ── Modo Calendario (heatmap de carga por día) ──
    const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    const metricLabel = calMetric === 'due' ? 'que vencen' : calMetric === 'start' ? 'que inician' : calMetric === 'total' ? 'en total (activas + inician + vencen)' : 'activas';
    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const firstDow = (new Date(calMonth.y, calMonth.m, 1).getDay() + 6) % 7; // 0 = lunes
    const countForDay = (day: number) => {
      const t = new Date(calMonth.y, calMonth.m, day, 0, 0, 0, 0).getTime();
      // 'total' = suma aritmética activas + inician + vencen; los días de inicio/fin cuentan más de una vez a propósito.
      if (calMetric === 'total') {
        return activos.reduce((acc, a) => {
          let n = 0;
          if (a.ini.getTime() <= t && t <= a.fin.getTime()) n++; // activa
          if (a.ini.getTime() === t) n++;                        // inicia
          if (a.fin.getTime() === t) n++;                        // vence
          return acc + n;
        }, 0);
      }
      return activos.filter(a => {
        if (calMetric === 'due') return a.fin.getTime() === t;
        if (calMetric === 'start') return a.ini.getTime() === t;
        return a.ini.getTime() <= t && t <= a.fin.getTime();
      }).length;
    };
    const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const dayCounts = dayNums.map(countForDay);
    const maxCount = Math.max(1, ...dayCounts);
    const calCells: (number | null)[] = [...Array(firstDow).fill(null), ...dayNums];
    while (calCells.length % 7 !== 0) calCells.push(null);
    const shiftMonth = (delta: number) => setCalMonth(prev => { const d = new Date(prev.y, prev.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    const isTodayCell = (day: number) => hoy.getFullYear() === calMonth.y && hoy.getMonth() === calMonth.m && hoy.getDate() === day;
    const cellBg = (c: number) => c === 0 ? '#f8fafc' : `rgba(37, 99, 235, ${0.15 + (c / maxCount) * 0.7})`;
    const cellStrong = (c: number) => (c / maxCount) > 0.55;
    const metricBtn = (val: 'active' | 'due' | 'start' | 'total', txt: string) => (
      <button onClick={() => setCalMetric(val)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${calMetric === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{txt}</button>
    );

    return (
      <div className="space-y-4">
        {/* Barra de control */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vista</span>
              <div className="flex gap-1">{modeBtn('bars', <GanttChartSquare size={13} />, 'Gantt')}{modeBtn('calendar', <Calendar size={13} />, 'Calendario')}</div>
            </div>
            {ganttMode === 'bars' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escala</span>
                <div className="flex gap-1">{scaleBtn('week', 'Semana')}{scaleBtn('month', 'Mes')}{scaleBtn('quarter', 'Trimestre')}</div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contar</span>
                <div className="flex gap-1">{metricBtn('active', 'Activas')}{metricBtn('due', 'Vencen')}{metricBtn('start', 'Inician')}{metricBtn('total', 'Total')}</div>
              </div>
            )}
            <span className="text-xs text-slate-500 font-medium">{activos.length} tareas activas · {grupos.length} proyectos</span>
          </div>
          {ganttMode === 'bars' && (
            <div className="flex items-center gap-3 flex-wrap">
              {leyenda.map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.clr }} />
                  <span className="text-[11px] font-medium text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cronograma (Gantt) */}
        {ganttMode === 'bars' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: LABEL_W + totalWidth }}>
              {/* Overlay de gridlines (detrás del contenido) */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LABEL_W, width: totalWidth }}>
                {periods.map((p, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-slate-100" style={{ left: xOf(p.start.getTime()) }} />
                ))}
              </div>

              {/* Cabecera de periodos */}
              <div className="flex sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <div className="shrink-0 px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200" style={{ width: LABEL_W }}>Tarea / Proyecto</div>
                <div className="relative" style={{ width: totalWidth, height: 40 }}>
                  {periods.map((p, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center px-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap" style={{ left: xOf(p.start.getTime()) }}>{p.label}</div>
                  ))}
                </div>
              </div>

              {/* Grupos por proyecto */}
              {grupos.map(g => {
                const colapsado = ganttCollapsed[g.key];
                const avg = Math.round(g.items.reduce((s, x) => s + (Number(x.task.porcentaje_avance) || 0), 0) / g.items.length);
                return (
                  <div key={g.key}>
                    <div className="flex items-stretch bg-slate-50/70 border-b border-slate-200 hover:bg-slate-100/70 cursor-pointer" onClick={() => setGanttCollapsed(prev => ({ ...prev, [g.key]: !prev[g.key] }))}>
                      <div className="shrink-0 px-3 py-2.5 flex items-center gap-2 border-r border-slate-200" style={{ width: LABEL_W }}>
                        <ChevronDown size={15} className={`text-slate-400 transition-transform shrink-0 ${colapsado ? '-rotate-90' : ''}`} />
                        <FolderKanban size={14} className="text-indigo-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-700 truncate" title={g.nombre}>{g.nombre}</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded-full shrink-0">{g.items.length}</span>
                      </div>
                      <div className="relative flex items-center" style={{ width: totalWidth }}>
                        <span className="text-[10px] font-bold text-slate-400 px-3">Avance prom. {avg}%</span>
                      </div>
                    </div>

                    {!colapsado && g.items.map((a, ri) => {
                      const atrasada = a.fin.getTime() < hoy.getTime();
                      const clr = atrasada ? '#ef4444' : (ESTADO_CLR[a.estado] || '#64748b');
                      // Recorte al rango visible [0, totalWidth]: una tarea con fecha fuera
                      // del horizonte se pega al borde en vez de dibujarse fuera de la grilla.
                      const left = Math.max(0, Math.min(xOf(a.ini.getTime()), totalWidth));
                      const right = Math.max(0, Math.min(xOf(a.fin.getTime() + MS_DAY), totalWidth));
                      const w = Math.max(right - left, 6);
                      const avance = Math.max(0, Math.min(100, Number(a.task.porcentaje_avance) || 0));
                      const resp = a.task.responsable || '';
                      return (
                        <div key={a.task.id ?? ri} className="flex items-stretch border-b border-slate-100 hover:bg-blue-50/30">
                          <div className="shrink-0 px-4 py-2 border-r border-slate-200 flex flex-col justify-center" style={{ width: LABEL_W }}>
                            <span className="text-xs font-medium text-slate-700 truncate" title={a.task.actividad}>{a.task.actividad}</span>
                            {resp && <span className="text-[10px] text-slate-400 truncate">{resp}</span>}
                          </div>
                          <div className="relative" style={{ width: totalWidth, height: 40 }}>
                            <div
                              className="absolute top-1/2 -translate-y-1/2 rounded-md shadow-sm overflow-hidden"
                              style={{ left, width: w, height: 20, backgroundColor: `${clr}33`, border: `1.5px solid ${clr}` }}
                              title={`${a.task.actividad}\n${a.estado}${atrasada ? ' (atrasada)' : ''}\n${a.ini.toLocaleDateString('es-CO')} → ${a.fin.toLocaleDateString('es-CO')}\nAvance: ${avance}%`}
                            >
                              <div className="h-full" style={{ width: `${avance}%`, backgroundColor: clr }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Línea de "hoy" (sobre el contenido) */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: LABEL_W + todayX }}>
                  <div className="w-0.5 h-full bg-red-500/70" />
                  <span className="absolute top-0 left-1 text-[9px] font-bold text-red-600 bg-white/90 px-1 rounded-sm">hoy</span>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Calendario (carga por día) */}
        {ganttMode === 'calendar' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {/* Navegación de mes */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => shiftMonth(-1)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Mes anterior"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-800">{MESES_FULL[calMonth.m]} {calMonth.y}</h3>
                <p className="text-[11px] text-slate-400">Tareas {metricLabel} por día · pico {maxCount}/día</p>
              </div>
              <button onClick={() => shiftMonth(1)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Mes siguiente"><ChevronRight size={18} /></button>
            </div>
            {/* Cabecera de días */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] font-bold text-slate-400 uppercase">{w}</div>)}
            </div>
            {/* Celdas del mes */}
            <div className="grid grid-cols-7 gap-1.5">
              {calCells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const c = dayCounts[day - 1];
                const strong = cellStrong(c);
                const today = isTodayCell(day);
                return (
                  <div
                    key={i}
                    title={`${day} de ${MESES_FULL[calMonth.m]}: ${c} tarea${c === 1 ? '' : 's'} ${metricLabel}`}
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition-all ${today ? 'ring-2 ring-red-400 border-red-300' : 'border-slate-100'}`}
                    style={{ backgroundColor: cellBg(c) }}
                  >
                    <span className="text-[10px] font-semibold" style={{ color: strong ? 'rgba(255,255,255,0.85)' : '#94a3b8' }}>{day}</span>
                    {c > 0 && <span className="text-base sm:text-lg font-black leading-none" style={{ color: strong ? '#ffffff' : '#1e40af' }}>{c}</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              {calMetric === 'active'
                ? 'Cada celda cuenta las tareas en curso ese día (inicio ≤ día ≤ fin).'
                : calMetric === 'due'
                  ? 'Cada celda cuenta las tareas cuya fecha de fin es ese día.'
                  : calMetric === 'start'
                    ? 'Cada celda cuenta las tareas cuya fecha de inicio es ese día.'
                    : 'Suma de las tres métricas (activas + inician + vencen). Ojo: los días de inicio y de fin se cuentan más de una vez, por lo que el número es mayor que el de tareas reales.'}
              {' '}Solo tareas activas (excluye Completadas/Canceladas).
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderReportsView = () => {
    const totalTasks = filteredReportTasks.length;
    const completedTasks = filteredReportTasks.filter(t => t.estado === 'Completado').length;
    const inProgressTasks = filteredReportTasks.filter(t => t.estado === 'En curso').length;
    const overdueTasks = filteredReportTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length;
    const generalProgress = totalTasks > 0 ? (filteredReportTasks.reduce((sum, t) => sum + (Number(t.porcentaje_avance) || 0), 0) / totalTasks).toFixed(1) : 0;

    const ttStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' };

    // Barras por área
    const tasksByArea = areas.map(area => {
      const at = filteredReportTasks.filter(t => t.area_origen_id === area.id);
      return { name: area.nombre.length > 15 ? area.nombre.substring(0, 15) + '...' : area.nombre, Total: at.length, Completadas: at.filter(t => t.estado === 'Completado').length, Atrasadas: at.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length };
    }).filter(d => d.Total > 0);

    // Donut distribución por estado
    const ESTADO_CLR: Record<string, string> = { 'Planeado': '#64748b', 'En curso': '#3b82f6', 'En espera': '#f59e0b', 'Completado': '#10b981', 'Cancelado': '#cbd5e1' };
    const estadoData = ['Planeado', 'En curso', 'En espera', 'Completado', 'Cancelado'].map(e => ({
      name: e, value: filteredReportTasks.filter(t => t.estado === e).length, color: ESTADO_CLR[e],
    })).filter(d => d.value > 0);

    // Avance por proyecto (barras horizontales)
    const projectProgress = projects.map(p => {
      const pt = filteredReportTasks.filter(t => t.proyecto_id === p.id);
      if (!pt.length) return null;
      const avg = Math.round(pt.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / pt.length);
      return { name: p.nombre.length > 24 ? p.nombre.substring(0, 24) + '…' : p.nombre, Avance: avg, Tareas: pt.length };
    }).filter(Boolean).sort((a: any, b: any) => b.Avance - a.Avance) as any[];

    // Distribución por prioridad
    const PRIO_CLR: Record<string, string> = { 'Muy Alta': '#ef4444', 'Alta': '#f97316', 'Media': '#3b82f6', 'Baja': '#64748b', 'Muy Baja': '#cbd5e1' };
    const priorityData = ['0|Muy Alta', '1|Alta', '2|Media', '3|Baja', '4|Muy Baja'].map(p => {
      const label = getPriorityLabel(p);
      const pt = filteredReportTasks.filter(t => t.prioridad === p);
      return { name: label, Total: pt.length, Atrasadas: pt.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length, color: PRIO_CLR[label] };
    }).filter(d => d.Total > 0);

    // Próximas a vencer (14 días)
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const in14 = new Date(todayD); in14.setDate(in14.getDate() + 14);
    const proximasAVencer = filteredReportTasks.filter(t => {
      if (!t.fecha_fin || t.estado === 'Completado' || t.estado === 'Cancelado') return false;
      const f = new Date(String(t.fecha_fin).split('T')[0] + 'T00:00:00');
      return f >= todayD && f <= in14;
    }).sort((a: any, b: any) => new Date(String(a.fecha_fin).split('T')[0]).getTime() - new Date(String(b.fecha_fin).split('T')[0]).getTime());

    // Tabla de salud por área
    const areaHealth = areas.map(area => {
      const at = filteredReportTasks.filter(t => t.area_origen_id === area.id);
      if (!at.length) return null;
      const comp = at.filter(t => t.estado === 'Completado').length;
      const enCurso = at.filter(t => t.estado === 'En curso').length;
      const atrasadas = at.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length;
      const avgAvance = Math.round(at.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / at.length);
      return { nombre: area.nombre, total: at.length, comp, enCurso, atrasadas, avgAvance, riskRate: atrasadas / at.length };
    }).filter(Boolean).sort((a: any, b: any) => b.atrasadas - a.atrasadas) as any[];

    // Ranking empleados
    const userStats = allUsers.map(user => {
      const fullName = `${user.nombre} ${user.apellido}`;
      const ut = filteredReportTasks.filter(t => t.responsable && String(t.responsable).includes(fullName));
      return { name: fullName, total: ut.length, completed: ut.filter(t => t.estado === 'Completado').length, overdue: ut.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length, progress: ut.length > 0 ? Math.round(ut.reduce((s, t) => s + (Number(t.porcentaje_avance) || 0), 0) / ut.length) : 0 };
    }).filter(u => u.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

    const clearFilters = () => { setReportAreaFilter([]); setReportProjectFilter([]); setReportDateFrom(''); setReportDateTo(''); };

    return (
      <div className="space-y-6">

        {/* Filtros */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filtrar por Área</label>
            <MultiSelect
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium"
              placeholder="Todas las Áreas"
              selected={reportAreaFilter}
              onChange={setReportAreaFilter}
              options={areas.map(a => ({ value: String(a.id), label: a.nombre }))}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filtrar por Proyecto</label>
            <MultiSelect
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium"
              placeholder="Todos los Proyectos"
              selected={reportProjectFilter}
              onChange={setReportProjectFilter}
              options={projects.map(p => ({ value: String(p.id), label: p.nombre }))}
            />
          </div>
          <div className="w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Desde</label>
            <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 font-medium" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
          </div>
          <div className="w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hasta</label>
            <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 font-medium" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={clearFilters} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all"><FilterX size={18} /></button>
            <button onClick={handleExportFilteredReport} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-200 flex items-center gap-2"><Download size={18} /> Exportar Excel</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><FileText size={20}/></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p><h3 className="text-2xl font-black text-slate-900">{totalTasks}</h3></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={20}/></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completadas</p><h3 className="text-2xl font-black text-emerald-600">{completedTasks}</h3></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><PlayCircle size={20}/></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Curso</p><h3 className="text-2xl font-black text-indigo-600">{inProgressTasks}</h3></div>
          </div>
          <div className={`p-5 rounded-2xl border shadow-sm flex items-center gap-3 ${overdueTasks > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${overdueTasks > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-400'}`}><AlertCircle size={20}/></div>
            <div><p className={`text-[10px] font-bold uppercase tracking-widest ${overdueTasks > 0 ? 'text-red-500' : 'text-slate-400'}`}>Atrasadas</p><h3 className={`text-2xl font-black ${overdueTasks > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueTasks}</h3></div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl border border-slate-700 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0"><TrendingUp size={20}/></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Avance Global</p>
              <h3 className="text-2xl font-black text-white">{generalProgress}%</h3>
              <div className="w-full bg-white/10 h-1 rounded-full mt-1"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${generalProgress}%` }} /></div>
            </div>
          </div>
        </div>

        {/* Fila 2: Barras por área + Donut por estado */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5"><BarChart3 size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Volumen de Tareas por Área</span></div>
            <div className="h-72">
              {tasksByArea.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tasksByArea} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={ttStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                    <Bar dataKey="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Atrasadas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">Sin datos para mostrar</div>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4"><PieChartIconLucide size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Distribución por Estado</span></div>
            {estadoData.length > 0 ? (
              <>
                <div className="relative h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={estadoData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {estadoData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} formatter={(val: any, name: any) => [`${val} tareas`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900">{totalTasks}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tareas</span>
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  {estadoData.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }}/><span className="text-slate-600 font-medium">{e.name}</span></div>
                      <div className="flex items-center gap-2"><span className="font-black text-slate-900">{e.value}</span><span className="text-slate-400 w-8 text-right">{totalTasks > 0 ? Math.round((e.value / totalTasks) * 100) : 0}%</span></div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="flex h-44 items-center justify-center text-slate-400 text-sm italic">Sin datos</div>}
          </div>
        </div>

        {/* Fila 3: Avance por proyecto + Distribución por prioridad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5"><TrendingUp size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Avance por Proyecto</span></div>
            <div className="h-72">
              {projectProgress.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={projectProgress} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={ttStyle} formatter={(val: any) => [`${val}%`, 'Avance promedio']} />
                    <Bar dataKey="Avance" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {projectProgress.map((e: any, i: number) => (
                        <Cell key={i} fill={e.Avance >= 76 ? '#10b981' : e.Avance >= 51 ? '#3b82f6' : e.Avance >= 26 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">Sin proyectos con tareas en el filtro actual</div>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5"><Activity size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Distribución por Prioridad</span></div>
            <div className="h-72">
              {priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={ttStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Total" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {priorityData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                    <Bar dataKey="Atrasadas" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">Sin datos</div>}
            </div>
          </div>
        </div>

        {/* Fila 4: Tabla salud por área + Próximas a vencer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2"><Building2 size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Salud por Área</span></div>
            {areaHealth.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Área</th>
                      <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                      <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Complet.</th>
                      <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">En Curso</th>
                      <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasadas</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">Avance Prom.</th>
                      <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaHealth.map((area: any, idx: number) => {
                      const riskCls = area.riskRate > 0.3 ? 'text-red-600 bg-red-50 border-red-200' : area.riskRate > 0 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
                      const riskLabel = area.riskRate > 0.3 ? 'Alto' : area.riskRate > 0 ? 'Medio' : 'Bajo';
                      return (
                        <tr key={idx} className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                          <td className="px-4 py-3 font-semibold text-slate-800 text-xs">{area.nombre}</td>
                          <td className="px-3 py-3 text-center font-black text-slate-700">{area.total}</td>
                          <td className="px-3 py-3 text-center font-bold text-emerald-600">{area.comp}</td>
                          <td className="px-3 py-3 text-center font-bold text-indigo-600">{area.enCurso}</td>
                          <td className="px-3 py-3 text-center">{area.atrasadas > 0 ? <span className="font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg text-xs">{area.atrasadas}</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressBarColor(area.avgAvance)}`} style={{ width: `${area.avgAvance}%` }} /></div>
                              <span className="text-xs font-bold text-slate-600 w-8 text-right">{area.avgAvance}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center"><span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${riskCls}`}>{riskLabel}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-8 text-center text-slate-400 text-sm italic">Sin datos para mostrar</div>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2"><Calendar size={18} className="text-amber-500"/><span className="font-bold text-slate-900">Próximas a Vencer</span></div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 uppercase">14 días</span>
            </div>
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {proximasAVencer.length > 0 ? (proximasAVencer as any[]).map((t: any, i: number) => {
                const f = new Date(String(t.fecha_fin).split('T')[0] + 'T00:00:00');
                const dLeft = Math.ceil((f.getTime() - todayD.getTime()) / 86400000);
                const urgCls = dLeft === 0 ? 'text-red-600 bg-red-50 border-red-200' : dLeft <= 3 ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-amber-600 bg-amber-50 border-amber-200';
                return (
                  <div key={i} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2 flex-1">{t.actividad}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${urgCls}`}>{dLeft === 0 ? 'Hoy' : `${dLeft}d`}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{String(t.responsable || '').split(',')[0].trim()}</p>
                  </div>
                );
              }) : (
                <div className="p-8 text-center">
                  <CheckCircle2 size={28} className="text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 italic">Sin vencimientos en los próximos 14 días</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ranking de empleados */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-5"><Activity size={18} className="text-slate-400"/><span className="font-bold text-slate-900">Ranking por Carga de Trabajo</span></div>
          {userStats.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {userStats.map((user, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {idx === 0 && <span className="text-base shrink-0">🏆</span>}
                      {idx === 1 && <span className="text-base shrink-0">🥈</span>}
                      {idx === 2 && <span className="text-base shrink-0">🥉</span>}
                      {idx > 2 && <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded shrink-0">#{idx+1}</span>}
                      <span className="text-sm font-bold text-slate-800 truncate" title={user.name}>{user.name}</span>
                    </div>
                    <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">{user.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressBarColor(user.progress)}`} style={{ width: `${user.progress}%` }}/></div>
                    <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{user.progress}%</span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold">
                    <span className="text-emerald-600">{user.completed} completadas</span>
                    {user.overdue > 0 && <span className="text-red-500">{user.overdue} atrasadas</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-center text-slate-400 text-sm italic py-8">Sin datos de empleados</div>}
        </div>

      </div>
    );
  };

  if (isLoggedIn === null) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-medium text-slate-500">Cargando...</div>;

  const currentViewTasksForHeader = currentView === 'tasks' ? filteredTasks : currentView === 'control' ? filteredControlTasks : [];
  const headerAvgProgressRaw = currentViewTasksForHeader.length > 0 ? (currentViewTasksForHeader.reduce((acc, t) => acc + (Number(t.porcentaje_avance) || 0), 0) / currentViewTasksForHeader.length) : 0;
  const headerAvgProgress = headerAvgProgressRaw.toFixed(1);

  const activeProjectsCount = projects.filter(p => p.estado === 'Activo').length;
  const completedProjectsCount = projects.filter(p => p.estado === 'Finalizado').length;
  const overdueProjectsCount = projects.filter(p => p.estado === 'Activo' && getDaysOverdue(p.fecha_fin || '', p.estado) > 0).length;
  const globalProjectProgressRaw = projects.length > 0 ? projects.reduce((acc, p) => { const pTasks = tasks.filter(t => t.proyecto_id === p.id); const pProgress = pTasks.length > 0 ? pTasks.reduce((sum, t) => sum + (Number(t.porcentaje_avance) || 0), 0) / pTasks.length : 0; return acc + pProgress; }, 0) / projects.length : 0;

  const filteredProjects = projects.filter(p => {
    if (projectSearchTerm && !p.nombre.toLowerCase().includes(projectSearchTerm.toLowerCase())) return false;
    if (projectStatusFilter && p.estado !== projectStatusFilter) return false;
    if (projectLiderFilter.length > 0 && !projectLiderFilter.includes(String(p.lider_id))) return false;
    if (projectPrioritarioFilter && !p.prioritario) return false;
    return true;
  });

const renderDynamicCell = (colId: string, task: any, index: number, isControlView = false) => {
    const overdueDays = getDaysOverdue(task.fecha_fin, task.estado);
    const taskProject = projects.find(p => p.id === task.proyecto_id);
    const responsablesArray = task.responsable ? String(task.responsable).split(',').map(r => r.trim()) : [];
    const isTaskSubExpanded = expandedTaskSubtasks.has(task.id!);
    const totalSubtasks = task.subtasks?.length || 0;
    const completedSubtasks = task.subtasks?.filter((st: any) => st.completada).length || 0;
    const canView = canViewSubtasks(String(task.responsable));
    const isTaskLocked = task.estado === 'Completado' || task.estado === 'Cancelado';
    const isTaskActive = task.estado !== 'Planeado' || task.porcentaje_avance > 0;
    const canEditTask = !!(currentUser?.is_admin || (currentUser?.can_edit_tasks && !isTaskLocked));
    const canEditControl = !!(currentUser?.is_admin || (currentUser as any)?.perm_control_edit);
    const canDeleteTask = !!(currentUser?.is_admin || (currentUser?.can_delete_tasks && !isTaskActive));

    switch(colId) {
      case 'orden':
        return (
          <td key={`orden-${task.id}`} className="px-6 py-4">
            <div className="flex justify-center items-center">
              {index === 0 && <span className="text-2xl drop-shadow-md animate-pulse" title="Prioridad #1 Absoluta">🏆</span>}
              {index === 1 && <span className="text-xl drop-shadow-md" title="Prioridad #2">🥈</span>}
              {index === 2 && <span className="text-xl drop-shadow-md" title="Prioridad #3">🥉</span>}
              {index > 2 && <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-md border border-slate-200 shadow-inner">#{index + 1}</span>}
            </div>
          </td>
        );
      case 'actividad':
        return (
          <td key={`actividad-${task.id}`} className="px-6 py-4">
            <div
              onClick={() => {
                const canEdit = isControlView ? canEditControl : canEditTask;
                if (canEdit) {
                  setEditingItem(task); setIsModalOpen(true); setIsModalReadOnly(false);
                } else if (isTaskLocked && !isControlView) {
                  setEditingItem(task); setIsModalOpen(true); setIsModalReadOnly(true);
                } else {
                  setSelectedTask(task); setDetailsTab('comments'); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!);
                }
              }}
              className="text-sm font-bold text-slate-900 cursor-pointer hover:text-blue-600 hover:underline transition-colors max-w-[250px] leading-tight"
            >{task.actividad}</div>
            <span className={`text-[9px] font-black px-2 py-0.5 mt-1 rounded-full uppercase inline-block bg-slate-100 text-slate-500 border-slate-200 ${getPriorityColor(task.prioridad)}`}>{getPriorityLabel(task.prioridad)}</span>
            {task.calificacion && <span className="ml-2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase inline-block bg-indigo-100 text-indigo-700 border-indigo-200">⚡ {task.calificacion} pts</span>}
            {totalSubtasks > 0 && canView && (
              <div className="mt-2">
                <button onClick={() => toggleTaskSubtasksExpand(task.id!)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                  <ChevronDown size={14} className={`transition-transform ${isTaskSubExpanded ? 'rotate-180' : ''}`} /> 📋 Subtareas ({completedSubtasks}/{totalSubtasks})
                </button>
              </div>
            )}
          </td>
        );
      case 'proyecto':
        return (
          <td key={`proyecto-${task.id}`} className="px-6 py-4">
            {taskProject ? <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1 w-fit max-w-[150px]"><FolderKanban size={10} className="shrink-0" /> <span className="truncate">{taskProject.nombre}</span></span> : <span className="text-xs text-slate-300 italic">-</span>}
          </td>
        );
		
		
		
   /*    case 'compromiso':
        return (
          <td key={`compromiso-${task.id}`} className="px-6 py-4">
            <div className="text-[10px] text-slate-400">{task.fecha_fin}</div>
            {overdueDays > 0 && <span className="mt-1 inline-block text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase">⏳ {overdueDays} DÍAS</span>}
          </td>
        ); */
  
      case 'compromiso':
        return (
          <td key={`compromiso-${task.id}`} className="px-6 py-4">
            {/* 🚀 CORRECCIÓN: split('T')[0] para que la vista quede limpia */}
            <div className="text-[10px] text-slate-400">{task.fecha_fin ? String(task.fecha_fin).split('T')[0] : ''}</div>
            {overdueDays > 0 && <span className="mt-1 inline-block text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase">⏳ {overdueDays} DÍAS</span>}
          </td>
        );
  
  
  
  /*     case 'avance':
        return (
          <td key={`avance-${task.id}`} className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressBarColor(task.porcentaje_avance)}`} style={{ width: `${task.porcentaje_avance}%` }} /></div><span className={`text-[10px] font-bold ${getProgressTextColor(task.porcentaje_avance)}`}>{task.porcentaje_avance}%</span></div></td>
        );
      case 'estado':
        return (
          <td key={`estado-${task.id}`} className="px-6 py-4"><span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(task.estado)}`}>{task.estado}</span></td>
        ); */

case 'avance':
        const isManualProgress = totalSubtasks === 0; 
        return (
          <td key={`avance-${task.id}`} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${getProgressBarColor(task.porcentaje_avance)}`} style={{ width: `${task.porcentaje_avance}%` }} />
              </div>
              
              {/* AQUÍ ESTÁ LA MAGIA: Agregamos !isTaskLocked para desaparecer el input en 100% */}
              {isManualProgress && (currentUser?.is_admin || (currentUser?.can_edit_tasks && !isTaskLocked)) ? (
                <div className="flex items-center gap-0.5">
                  <input 
                    key={`input-avance-${task.id}-${task.porcentaje_avance}`} // Obliga a resetear si hay error
                    type="number" 
                    min="0" max="100" 
                    defaultValue={task.porcentaje_avance}
                 /*    onBlur={(e) => {
                      let val = parseFloat(e.target.value);
                      if (isNaN(val)) val = 0;
                      if (val < 0) val = 0;
                      if (val > 100) val = 100;
                      if (val !== task.porcentaje_avance) {
                        handleQuickUpdate(task.id!, 'porcentaje_avance', val);
                      }
                    }} */
                       onBlur={(e) => {
                      let val = parseFloat(e.target.value);
                      if (isNaN(val)) val = 0;
                      if (val < 0) val = 0;
                      if (val > 100) val = 100;
                      
                      if (val !== task.porcentaje_avance) {
                        // 1. Enviamos la petición de cambio al servidor
                        handleQuickUpdate(task.id!, 'porcentaje_avance', val);
                        
                        // 2. TRUCO DE UX: Regresamos la vista al valor original inmediatamente.
                        // Si es exitoso, fetchTasks traerá el valor nuevo y lo repintará.
                        // Si falla la auditoría, la pantalla ya corrigió el número erróneo sola.
                        e.target.value = String(task.porcentaje_avance);
                      }
                    }}

                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className={`w-10 text-[10px] font-bold p-1 border border-transparent hover:border-slate-200 focus:border-blue-400 rounded text-center outline-none bg-transparent hover:bg-white transition-all ${getProgressTextColor(task.porcentaje_avance)}`}
                    title="Editar avance (Presiona Enter para guardar)"
                  />
                  <span className="text-[10px] font-bold text-slate-400">%</span>
                </div>
              ) : (
                <span className={`text-[10px] font-bold ${getProgressTextColor(task.porcentaje_avance)}`}>{task.porcentaje_avance}%</span>
              )}
            </div>
          </td>
        );

      case 'estado':
        return (
          <td key={`estado-${task.id}`} className="px-6 py-4">
            {/* AQUÍ TAMBIÉN: Agregamos !isTaskLocked para desaparecer el select */}
            {(currentUser?.is_admin || (currentUser?.can_edit_tasks && !isTaskLocked)) ? (
              <select
                key={`select-estado-${task.id}-${task.estado}`} // Reset visual si falla
                value={task.estado}
                onChange={(e) => handleQuickUpdate(task.id!, 'estado', e.target.value)}
                className={`text-[9px] font-black px-2 py-1.5 rounded-full uppercase tracking-wider outline-none cursor-pointer border border-transparent hover:border-slate-300 transition-all ${getStatusColor(task.estado)} appearance-none text-center text-align-last-center`}
                style={{ textAlignLast: 'center' }}
                title="Cambiar estado"
              >
                <option value="Planeado" className="text-slate-700 bg-white">Planeado</option>
                <option value="En curso" className="text-slate-700 bg-white">En curso</option>
                <option value="En espera" className="text-slate-700 bg-white">En espera</option>
                <option value="Completado" className="text-slate-700 bg-white">Completado</option>
                <option value="Cancelado" className="text-slate-700 bg-white">Cancelado</option>
              </select>
            ) : (
              <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(task.estado)}`}>
                {task.estado}
              </span>
            )}
          </td>
        );







/* case 'responsable':
        return (
          <td key={`responsable-${task.id}`} className="px-6 py-4">
            {isControlView ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{String(task.responsable || 'U').charAt(0)}</div>
                <div>
                  <span className="text-xs font-bold text-slate-700 block">{String(task.responsable || 'Usuario').split(',')[0]}</span>
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 mt-1 rounded-full uppercase inline-block">{(() => { const respUser = allUsers.find(u => `${u.nombre} ${u.apellido}` === String(task.responsable).split(',')[0].trim()); const area = areas.find(a => a.id === respUser?.area_id); return area ? area.nombre : 'Sin Área'; })()}</span>
                </div>
              </div>
            ) : (
              <div className="flex -space-x-2 pl-1" title={String(task.responsable)}>
                {responsablesArray.slice(0, 3).map((resp, idx) => (
                  <div 
                    key={idx} 
                    className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase border border-white"
                  >
                    {String(resp).charAt(0)}
                  </div>
                ))}
                {responsablesArray.length > 3 && (
                  <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] border border-white">
                    +{responsablesArray.length - 3}
                  </div>
                )}
              </div>
            )}
          </td>
        );
 */
 
 
case 'responsable':
        return (
          <td key={`responsable-${task.id}`} className="px-6 py-4">
            {isControlView ? (
              <div className="flex items-center gap-3">
                {/* Avatar del Responsable Principal */}
                <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 shadow-sm border border-white">
                  {String(responsablesArray[0] || 'U').charAt(0)}
                </div>
                
                <div>
                  {/* Nombre del Responsable Principal */}
                  <span className="text-xs font-bold text-slate-700 block leading-tight mb-1">
                    {responsablesArray[0]}
                  </span>
                  
                  {/* Contenedor de Badges (Área + Contador de extras) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase inline-block border border-blue-100/50 max-w-[120px] truncate">
                      {(() => {
                        const respUser = allUsers.find(u => `${u.nombre || ''} ${u.apellido || ''}`.trim() === responsablesArray[0]);
                        const area = areas.find(a => a.id === respUser?.area_id);
                        return area ? area.nombre : 'Sin Área';
                      })()}
                    </span>
                    
                    {/* Badge de "+X más" (Solo aparece si hay múltiples responsables) */}
                    {responsablesArray.length > 1 && (
                      <span 
                        className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase cursor-help border border-slate-200"
                        title={`También responsables:\n${responsablesArray.slice(1).join('\n')}`}
                      >
                        +{responsablesArray.length - 1} más
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Vista estándar: Avatares apilados horizontalmente */
              <div className="flex -space-x-2 pl-1" title={String(task.responsable)}>
                {responsablesArray.slice(0, 3).map((resp, idx) => (
                  <div 
                    key={idx} 
                    className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase border border-white shadow-sm"
                  >
                    {String(resp).charAt(0)}
                  </div>
                ))}
                {responsablesArray.length > 3 && (
                  <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] border border-white shadow-sm">
                    +{responsablesArray.length - 3}
                  </div>
                )}
              </div>
            )}
          </td>
        );















      case 'acciones':
        return (
          <td key={`acciones-${task.id}`} className="px-6 py-4">
            <div className="flex justify-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setDetailsTab('comments'); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Ver Detalles"><Eye size={16} /></button>
              {!isControlView ? (
                <>
                  {canDeleteTask ? <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id!, 'tasks'); }} className="text-slate-400 hover:text-red-600 transition-colors" title="Eliminar Tarea"><Trash2 size={16} /></button> : (currentUser?.can_delete_tasks && isTaskActive) && <button className="text-slate-200 cursor-not-allowed"><Lock size={16} /></button>}
                </>
/*               ) : (
                (currentUser?.is_admin || (currentUser as any)?.perm_control_edit) && (
                  <button onClick={() => { setEditingItem(task); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 transition-colors" title="Editar Tarea desde Control"><Edit2 size={16} /></button>
                )
              )}
            </div>
          </td>
        );
      default: return null; */
	  // ... código previo (línea 1374 aprox)
              ) : (
                <>
                  {(currentUser?.is_admin || (currentUser as any)?.perm_control_delete) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteControlTask(task.id!); }} className="text-slate-400 hover:text-red-600 transition-colors" title="Eliminar Tarea del Tablero">
                      <Trash2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </td>
        );
      default: return null;
	  
	  
	  
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsSidebarOpen(false)} 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} bg-white border-r border-slate-200 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:sticky md:top-0 h-screen shrink-0 shadow-xl md:shadow-none`}>
        {/* Botón contraer/expandir (solo desktop) */}
        <button
          onClick={toggleSidebarCollapsed}
          title={isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          className="hidden md:flex absolute -right-3 top-7 z-50 w-6 h-6 items-center justify-center bg-white border border-slate-200 rounded-full shadow-md text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${isSidebarCollapsed ? 'md:p-4 md:justify-center' : ''}`}>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0"><LayoutDashboard size={18} /></div>
            <span className={isSidebarCollapsed ? 'md:hidden' : ''}>TaskFlow Pro</span>
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
            <ChevronLeft size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button onClick={() => { setCurrentView('tasks'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Panel de Actividades" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'tasks' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Panel de Actividades</span></button>
          {canViewProjects && <button onClick={() => { setCurrentView('projects'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Gestión de Proyectos" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'projects' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><FolderKanban size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Gestión de Proyectos</span></button>}
          {canViewReports && <button onClick={() => { setCurrentView('reports'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Reportes" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><PieChartIconLucide size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Reportes</span></button>}
          {canViewGantt && <button onClick={() => { setCurrentView('gantt'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Cronograma (Gantt)" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'gantt' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><GanttChartSquare size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Cronograma</span></button>}
          {canViewUsers && <button onClick={() => { setCurrentView('users'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Gestión de Usuarios" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'users' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Gestión de Usuarios</span></button>}
          {canViewAreas && <button onClick={() => { setCurrentView('areas'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Gestión de áreas" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'areas' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Gestión de áreas</span></button>}
          {(currentUser?.acceso_supervision || currentUser?.is_admin) && <button onClick={() => { setCurrentView('control'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} title="Control de Gestión" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''} ${currentView === 'control' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Control de Gestión</span></button>}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {currentUser && (
            <div className={`flex items-center gap-3 mb-4 px-2 ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''}`}>
              <div title={`${currentUser.nombre} ${currentUser.apellido}`} className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm uppercase">{String(currentUser.nombre || '').charAt(0)}{String(currentUser.apellido || '').charAt(0)}</div>
              <div className={`min-w-0 overflow-hidden ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser.nombre} {currentUser.apellido}</p>
                <p className="text-[10px] font-medium text-slate-500 truncate">{(currentUser as any).cargo || currentUser.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} title="Cerrar Sesión" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''}`}><LogOut size={18} className="shrink-0" /> <span className={isSidebarCollapsed ? 'md:hidden' : ''}>Cerrar Sesión</span></button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen relative" onClick={() => { if(showImportMenu) setShowImportMenu(false); if(showColumnManager) setShowColumnManager(false); }}>
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 pt-4 lg:pt-8 pb-0 sticky top-0 z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
                  >
                    <Menu size={20} />
                  </button>
                  {currentView === 'tasks' ? (
                    <>
                      <div className="flex items-center gap-4 mb-1">
                        <button onClick={() => setTaskTab('personal')} className={`text-lg sm:text-xl lg:text-2xl font-bold transition-all ${taskTab === 'personal' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}>Mis Tareas</button>
                        <button onClick={() => setTaskTab('team')} className={`text-lg sm:text-xl lg:text-2xl font-bold transition-all ${taskTab === 'team' ? 'text-slate-900 border-b-2 border-blue-600 pb-1' : 'text-slate-400 hover:text-slate-600'}`}>Equipo</button>
                      </div>
                      <p className="text-slate-500 text-xs sm:text-sm truncate">Gestiona y supervisa las actividades</p>
                    </>
                  ) : currentView === 'reports' ? (
                    <>
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 capitalize truncate">Reportes Gerenciales</h2>
                      <p className="text-slate-500 text-xs sm:text-sm truncate">Visualización de datos y métricas globales</p>
                    </>
                  ) : currentView === 'gantt' ? (
                    <>
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 capitalize truncate">Cronograma (Gantt)</h2>
                      <p className="text-slate-500 text-xs sm:text-sm truncate">Supervisión de tareas activas por proyecto en la línea de tiempo</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 capitalize truncate">
                        {currentView === 'users' ? 'Gestión de Usuarios' : currentView === 'areas' ? 'Gestión de áreas' : currentView === 'projects' ? 'Gestión de Proyectos' : 'Control de Gestión'}
                      </h2>
                      <p className="text-slate-500 text-xs sm:text-sm truncate">Administración y supervisión del sistema</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:gap-4 flex-wrap justify-end">
                  {(currentView === 'tasks' || currentView === 'control') && (
                    <div className="hidden lg:flex bg-slate-50 rounded-xl px-4 py-2 border border-slate-200 items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progreso Real</div>
                        <div className={`text-sm font-bold ${getProgressTextColor(headerAvgProgressRaw)}`}>{headerAvgProgress}%</div>
                      </div>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressBarColor(headerAvgProgressRaw)}`} style={{ width: `${headerAvgProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <button onClick={() => { setShowNotifications(!showNotifications); setShowNotes(false); if (!showNotifications) markNotificationsRead(); }} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 relative transition-all active:scale-95">
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

                  <div className="relative">
                    <button onClick={() => { setShowNotes(!showNotes); setShowNotifications(false); if (!showNotes) fetchNotes(); }} title="Mis Notas" className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 relative transition-all active:scale-95">
                      <NotebookPen size={20} />
                    </button>
                    <AnimatePresence>
                      {showNotes && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                          <div className="p-4 border-b border-slate-50 bg-amber-50/60 flex justify-between items-center">
                            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2"><NotebookPen size={14} className="text-amber-500" /> Mis Notas</h4>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{notes.length} {notes.length === 1 ? 'Nota' : 'Notas'}</span>
                          </div>
                          <form onSubmit={handleCreateNote} className="p-3 border-b border-slate-100 flex gap-2">
                            <input type="text" value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Escribir nueva nota..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0" />
                            <button type="submit" disabled={isSavingNote || !newNoteContent.trim()} title="Agregar nota" className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-all shrink-0 active:scale-95"><Plus size={16} /></button>
                          </form>
                          <div className="max-h-80 overflow-y-auto">
                            {notes.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm italic">Sin notas todavía. Apunta tus pendientes aquí.</div> : (
                              notes.map(note => (
                                <div key={note.id} className="p-4 border-b border-slate-50 last:border-0 hover:bg-amber-50/40 transition-colors group">
                                  {editingNoteId === note.id ? (
                                    <div className="space-y-2">
                                      <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} rows={3} autoFocus className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all">Cancelar</button>
                                        <button type="button" onClick={handleUpdateNote} disabled={isSavingNote || !editingNoteContent.trim()} className="px-3 py-1 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-all">Guardar</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">{new Date(note.updated_at).toLocaleString()}</span>
                                      </div>
                                      <button type="button" onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }} className="p-1.5 text-slate-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0" title="Editar nota"><Edit2 size={14} /></button>
                                      <button type="button" onClick={() => handleDeleteNote(note.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" title="Eliminar nota"><Trash2 size={14} /></button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {(currentView === 'tasks' || currentView === 'control') && canCreateInCurrentView() && (
                    <div className="relative">
                      <input type="file" id="excel-upload" accept=".xlsx, .xls" hidden onChange={handleImportExcel} />
                      <div className="flex rounded-xl shadow-lg shadow-indigo-200">
                        <button onClick={() => document.getElementById('excel-upload')?.click()} disabled={isImporting} className="bg-indigo-600 text-white px-3 sm:px-4 py-2.5 rounded-l-xl font-medium flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 border-r border-indigo-700">
                          <Upload size={18} /> <span className="hidden sm:inline">{isImporting ? 'Importando...' : 'Importar'}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowImportMenu(!showImportMenu); }} disabled={isImporting} className="bg-indigo-600 text-white px-2 py-2.5 rounded-r-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center">
                          <ChevronDown size={18} />
                        </button>
                      </div>

                      <AnimatePresence>
                        {showImportMenu && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                            <div className="py-1">
                              <button onClick={() => { document.getElementById('excel-upload')?.click(); setShowImportMenu(false); }} className="w-full px-4 py-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"><FileText size={16} className="text-indigo-600" /><span className="font-medium">Cargar archivo Excel</span></button>
                              <button onClick={handleDownloadTemplate} className="w-full px-4 py-3 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors border-t border-slate-100"><Download size={16} className="text-indigo-600" /><span className="font-medium">Descargar plantilla</span></button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {(currentView === 'tasks' || currentView === 'control') && (
                    <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-3 sm:px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                      <Download size={18} /> <span className="hidden sm:inline">Exportar Excel</span>
                    </button>
                  )}

                  {canCreateInCurrentView() && currentView !== 'reports' && (
                    <button onClick={() => { setEditingItem(null); setPreselectedProjectId(null); setUserSearchTerm(''); setIsModalOpen(true); }} className="bg-slate-900 text-white px-3 sm:px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
                      <Plus size={18} /> <span className="hidden sm:inline">{currentView === 'tasks' ? 'Nueva Tarea' : currentView === 'users' ? 'Nuevo Usuario' : currentView === 'projects' ? 'Nuevo Proyecto' : 'Nueva Área'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          
          {currentView === 'reports' && renderReportsView()}

          {currentView === 'gantt' && renderGanttView()}

          {currentView === 'tasks' && (
            <>
              <div className="mb-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  
                  <div onClick={() => setStatusFilter('All')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'All' ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'All' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}><LayoutDashboard size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'All' ? 'text-blue-100' : 'text-slate-400'}`}>Global</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-black ${statusFilter === 'All' ? 'text-white' : getProgressTextColor(headerAvgProgressRaw)}`}>{headerAvgProgress}%</span>
                    </div>
                  </div>
                  
                  <div onClick={() => setStatusFilter('Planeado')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'Planeado' ? 'bg-slate-700 border-slate-800 text-white' : 'bg-white border-slate-200 hover:border-slate-400'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'Planeado' ? 'bg-slate-600 text-white' : 'bg-slate-50 text-slate-600'}`}><Clock size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'Planeado' ? 'text-slate-300' : 'text-slate-400'}`}>Planeado</span>
                    </div>
                    <span className="text-3xl font-black">{filteredTasks.filter(t => t.estado === 'Planeado').length}</span>
                  </div>

                  <div onClick={() => setStatusFilter('En curso')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'En curso' ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'En curso' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}><PlayCircle size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'En curso' ? 'text-indigo-100' : 'text-slate-400'}`}>En curso</span>
                    </div>
                    <span className="text-3xl font-black">{filteredTasks.filter(t => t.estado === 'En curso').length}</span>
                  </div>
                  
                  <div onClick={() => setStatusFilter('En espera')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'En espera' ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-200 hover:border-amber-400'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'En espera' ? 'bg-amber-400 text-white' : 'bg-amber-50 text-amber-600'}`}><Eye size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'En espera' ? 'text-amber-50' : 'text-slate-400'}`}>En espera</span>
                    </div>
                    <span className="text-3xl font-black">{filteredTasks.filter(t => t.estado === 'En espera').length}</span>
                  </div>

                  <div onClick={() => setStatusFilter('Atrasadas')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'Atrasadas' ? 'bg-red-600 border-red-700 text-white' : filteredTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length > 0 ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-slate-200 hover:border-red-300'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'Atrasadas' ? 'bg-red-500 text-white' : filteredTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-400'}`}><AlertCircle size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'Atrasadas' ? 'text-red-100' : filteredTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length > 0 ? 'text-red-600' : 'text-slate-400'}`}>Atrasadas</span>
                    </div>
                    <span className={`text-3xl font-black ${statusFilter === 'Atrasadas' ? 'text-white' : filteredTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{filteredTasks.filter(t => getDaysOverdue(t.fecha_fin, t.estado) > 0).length}</span>
                  </div>

                  <div onClick={() => setStatusFilter('Completado')} className={`cursor-pointer p-4 rounded-2xl border transition-all active:scale-95 shadow-sm flex flex-col justify-center ${statusFilter === 'Completado' ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-200 hover:border-emerald-400'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${statusFilter === 'Completado' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'}`}><CheckCircle2 size={14} /></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusFilter === 'Completado' ? 'text-emerald-50' : 'text-slate-400'}`}>Completado</span>
                    </div>
                    <span className="text-3xl font-black">{filteredTasks.filter(t => t.estado === 'Completado').length}</span>
                  </div>
                </div>
              </div>

              <ChartsSection data={filteredTasks} />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-200/50 p-1.5 rounded-xl w-max border border-slate-200 shadow-inner">
                    <button onClick={() => setTaskDisplayMode('list')} className={`flex items-center gap-2 px-5 py-2 text-xs font-black rounded-lg transition-all ${taskDisplayMode === 'list' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><ListChecks size={16}/> VISTA LISTA</button>
                    <button onClick={() => setTaskDisplayMode('kanban')} className={`flex items-center gap-2 px-5 py-2 text-xs font-black rounded-lg transition-all ${taskDisplayMode === 'kanban' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Columns size={16}/> TABLERO KANBAN</button>
                  </div>

                  {taskDisplayMode === 'list' && (
                    <div className="relative z-20">
                      <button onClick={(e) => { e.stopPropagation(); setShowColumnManager(!showColumnManager); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 flex items-center gap-2 text-sm font-bold shadow-sm active:scale-95">
                        <Settings size={16} /> Columnas
                      </button>
                      <AnimatePresence>
                        {showColumnManager && (
                          <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                              Personalizar Tabla
                              <button onClick={() => setShowColumnManager(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                            </div>
                            <div className="p-2 space-y-1">
                              {tableCols.map((col, idx) => (
                                <div key={col.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                                    <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.id)} className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 w-4 h-4" />
                                    <span className={`text-sm ${col.visible ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{col.label}</span>
                                  </label>
                                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => moveColumn(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronDown size={14} className="rotate-180" /></button>
                                    <button onClick={() => moveColumn(idx, 'down')} disabled={idx === tableCols.length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronDown size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar actividad..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  {taskDisplayMode === 'list' && (
                    <select className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 text-sm outline-none font-medium text-slate-600 w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="All">Todos los Estados</option>
                      <option value="Planeado">Planeado</option>
                      <option value="En curso">En curso</option>
                      <option value="En espera">En espera</option>
                      <option value="Atrasadas">Atrasadas 🚨</option>
                      <option value="Completado">Completado</option>
                    </select>
                  )}
                  <MultiSelect
                    className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 text-sm font-medium w-44"
                    placeholder="Prioridad"
                    selected={taskPriorityFilter}
                    onChange={setTaskPriorityFilter}
                    options={PRIORITY_OPTIONS}
                  />
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-slate-400 shrink-0" />
                    <input type="date" className="bg-white border border-slate-200 shadow-sm rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 w-36" value={taskDateFrom} onChange={e => setTaskDateFrom(e.target.value)} title="Registro desde" />
                    <span className="text-slate-400 text-xs font-bold">—</span>
                    <input type="date" className="bg-white border border-slate-200 shadow-sm rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 w-36" value={taskDateTo} onChange={e => setTaskDateTo(e.target.value)} title="Registro hasta" />
                  </div>
                  {(taskPriorityFilter.length > 0 || taskDateFrom || taskDateTo) && (
                    <button onClick={() => { setTaskPriorityFilter([]); setTaskDateFrom(''); setTaskDateTo(''); }} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap">
                      <FilterX size={14} /> Limpiar
                    </button>
                  )}
                </div>
              </div>

              {taskDisplayMode === 'kanban' ? (
                <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-300px)] items-start">
                  {['Planeado', 'En curso', 'En espera', 'Completado'].map(colStatus => {
                    const colTasks = filteredTasks.filter(t => t.estado === colStatus);
                    let headerColor = 'bg-slate-100 text-slate-700 border-slate-200';
                    let dotColor = 'bg-slate-400';
                    if(colStatus === 'En curso') { headerColor = 'bg-indigo-50 text-indigo-700 border-indigo-200'; dotColor = 'bg-indigo-500'; }
                    if(colStatus === 'En espera') { headerColor = 'bg-amber-50 text-amber-700 border-amber-200'; dotColor = 'bg-amber-500'; }
                    if(colStatus === 'Completado') { headerColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'; dotColor = 'bg-emerald-500'; }

                    return (
                      <div key={colStatus} className="flex-1 min-w-[300px] w-[300px] bg-slate-100/50 rounded-2xl flex flex-col border border-slate-200" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, colStatus)}>
                         <div className={`p-4 rounded-t-2xl border-b flex justify-between items-center ${headerColor}`}>
                           <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span><h3 className="font-bold text-sm uppercase tracking-wider">{colStatus}</h3></div>
                           <span className="text-xs font-black bg-white/50 px-2 py-0.5 rounded-md">{colTasks.length}</span>
                         </div>
                         <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                            {colTasks.length === 0 ? <div className="h-full flex items-center justify-center text-xs font-medium text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl py-8">Arrastra aqu  </div> : (
                              <AnimatePresence>
                                {colTasks.map((task) => {
                                  const globalIndex = filteredTasks.findIndex(t => t.id === task.id);
                                  const isTaskLocked = task.estado === 'Completado' || task.estado === 'Cancelado';
                                  const canEditTask = !!(currentUser?.is_admin || (currentUser?.can_edit_tasks && !isTaskLocked));
                                  const taskProject = projects.find(p => p.id === task.proyecto_id);
                                  const responsablesArray = task.responsable ? String(task.responsable).split(',').map(r => r.trim()) : [];

                                  return (
                                    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} key={task.id} draggable={canEditTask ? "true" : "false"} onDragStart={(e) => handleDragStart(e as any, task)} onClick={() => { setSelectedTask(task); setDetailsTab('comments'); setIsDetailsModalOpen(true); fetchTaskDetails(task.id!); }} className={`relative bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all ${canEditTask ? 'cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-md' : 'cursor-pointer hover:border-slate-300'}`}>
                                      <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border ${globalIndex === 0 ? 'bg-yellow-100 border-yellow-300' : globalIndex === 1 ? 'bg-slate-100 border-slate-300' : globalIndex === 2 ? 'bg-orange-100 border-orange-300' : 'bg-white border-slate-200 z-10'}`}>
                                        {globalIndex === 0 ? <Trophy size={14} className="text-yellow-600" /> : globalIndex === 1 ? <Medal size={14} className="text-slate-500" /> : globalIndex === 2 ? <Medal size={14} className="text-orange-600" /> : <span className="font-black text-slate-500">#{globalIndex + 1}</span>}
                                      </div>
                                      <div className="flex justify-between items-start mb-2.5 pr-4"><span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getPriorityColor(task.prioridad)}`}>{getPriorityLabel(task.prioridad)}</span></div>
                                      <h4 className="text-sm font-bold text-slate-800 mb-1 leading-snug line-clamp-2">{task.actividad}</h4>
                                      {taskProject && <div className="text-[10px] font-bold text-indigo-500 mb-3 flex items-center gap-1 line-clamp-1"><FolderKanban size={12}/> {taskProject.nombre}</div>}
                                      <div className="flex items-center justify-between mt-4">
                                        <div className="flex -space-x-1.5">{responsablesArray.slice(0, 3).map((resp, idx) => <div key={idx} className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-bold uppercase border border-white shadow-sm" title={resp}>{String(resp).charAt(0)}</div>)}</div>
                                        <div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${getProgressBarColor(task.porcentaje_avance)}`} style={{width: `${task.porcentaje_avance}%`}}></div></div><span className="text-[10px] font-bold text-slate-500">{task.porcentaje_avance}%</span></div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            )}
                         </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto p-2">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white">
                        {tableCols.filter(c => c.visible).map(col => (
                          <th key={col.id} className={`px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${col.id === 'orden' || col.id === 'acciones' ? 'text-center' : ''}`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 relative">
                      <AnimatePresence>
                        {filteredTasks.length === 0 ? (
                          <tr><td colSpan={tableCols.filter(c => c.visible).length} className="px-6 py-8 text-center text-slate-400 text-sm">No hay tareas.</td></tr>
                        ) : (
                          filteredTasks.map((task, index) => {
                             const isTaskSubExpanded = expandedTaskSubtasks.has(task.id!);
                             const totalSubtasks = task.subtasks?.length || 0;
                             const canView = canViewSubtasks(String(task.responsable));
                             const canToggle = canToggleSubtasks(String(task.responsable));

                             return (
                              <React.Fragment key={task.id}>
                                <motion.tr layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className={`hover:bg-slate-50 transition-colors group ${task.estado === 'Completado' ? 'bg-emerald-50/10' : ''}`}>
                                  {tableCols.filter(c => c.visible).map(col => renderDynamicCell(col.id, task, index, false))}
                                </motion.tr>
                                {isTaskSubExpanded && totalSubtasks > 0 && canView && (
                                   <tr>
                                     <td colSpan={tableCols.filter(c => c.visible).length} className="p-0 border-b border-slate-100 bg-slate-50/50">
                                       <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                          <div className="px-8 py-3"><div className="space-y-2 border-l-2 border-indigo-200 pl-4 py-1 ml-2">{task.subtasks.map((st: any) => (<div key={st.id} className="flex items-center gap-2"><button disabled={!canToggle} onClick={(e) => { e.stopPropagation(); canToggle && handleToggleSubtask(st.id, st.completada); }} className={`transition-colors ${st.completada ? 'text-emerald-500' : 'text-slate-300'} ${canToggle ? 'hover:text-blue-500 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>{st.completada ? <CheckSquare size={16} /> : <Square size={16} />}</button><span className={`text-xs ${st.completada ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{st.titulo}</span></div>))}</div></div>
                                       </motion.div>
                                     </td>
                                   </tr>
                                )}
                              </React.Fragment>
                             );
                          })
                        )}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {currentView === 'projects' && (
            <div className="w-full space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Activos</span><span className="text-2xl font-black text-slate-900">{activeProjectsCount}</span></div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completados</span><span className="text-2xl font-black text-emerald-600">{completedProjectsCount}</span></div>
                 <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-center ${overdueProjectsCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}><span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${overdueProjectsCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>Atrasados</span><span className={`text-2xl font-black ${overdueProjectsCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueProjectsCount}</span></div>
                 <div className="bg-blue-600 p-4 rounded-2xl border border-blue-700 shadow-sm flex flex-col justify-center"><span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Avance Global</span><span className="text-2xl font-black text-white">{globalProjectProgressRaw.toFixed(1)}%</span></div>
              </div>

              {/* Barra de filtros */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-2">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar proyecto..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                      value={projectSearchTerm}
                      onChange={e => setProjectSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 w-full lg:w-48"
                    value={projectStatusFilter}
                    onChange={e => setProjectStatusFilter(e.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    <option value="Activo">Activo</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                  <MultiSelect
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium w-full lg:w-52"
                    placeholder="Todos los líderes"
                    selected={projectLiderFilter}
                    onChange={setProjectLiderFilter}
                    options={Array.from(new Set(projects.map(p => p.lider_id).filter(Boolean))).map(liderId => {
                      const u = allUsers.find(u => u.id === liderId);
                      return u ? { value: String(liderId), label: `${u.nombre} ${u.apellido}` } : null;
                    }).filter(Boolean) as { value: string; label: string }[]}
                  />
                  <button
                    onClick={() => setProjectPrioritarioFilter(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap ${projectPrioritarioFilter ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    ⭐ Solo prioritarios
                  </button>
                  {(projectSearchTerm || projectStatusFilter || projectLiderFilter.length > 0 || projectPrioritarioFilter) && (
                    <button
                      onClick={() => { setProjectSearchTerm(''); setProjectStatusFilter(''); setProjectLiderFilter([]); setProjectPrioritarioFilter(false); }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap"
                    >
                      <FilterX size={15} /> Limpiar
                    </button>
                  )}
                </div>
                {(projectSearchTerm || projectStatusFilter || projectLiderFilter.length > 0 || projectPrioritarioFilter) && (
                  <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                    Mostrando <span className="font-bold text-slate-600">{filteredProjects.length}</span> de <span className="font-bold text-slate-600">{projects.length}</span> proyectos
                  </p>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No hay proyectos registrados. Crea uno nuevo para comenzar.</div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">Ningún proyecto coincide con los filtros aplicados.</div>
              ) : (
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
                  {filteredProjects.map(project => {
                    const isExpanded = expandedProjects.has(project.id!);
                    const projectTasks = tasks.filter(t => t.proyecto_id === project.id);
                    const progressRaw = projectTasks.length > 0 ? (projectTasks.reduce((acc, t) => acc + (Number(t.porcentaje_avance) || 0), 0) / projectTasks.length) : 0;
                    const lider = allUsers.find(u => u.id === project.lider_id);
                    const liderName = lider ? `${lider.nombre} ${lider.apellido}` : 'Sin l  der asignado';
                    const projectOverdueDays = project.estado === 'Activo' ? getDaysOverdue(project.fecha_fin || '', project.estado) : 0;

                    return (
                      <div key={project.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${project.prioritario ? 'border-orange-300 ring-1 ring-orange-100' : 'border-slate-200'}`}>
                        <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleProject(project.id!)}>
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`p-3 rounded-xl ${projectOverdueDays > 0 ? 'bg-red-50 text-red-600' : project.prioritario ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}><FolderKanban size={20}/></div>
                            <div>
                              <div className="flex items-center gap-2"><h3 className="font-bold text-slate-900 text-lg">{project.nombre}</h3>{project.prioritario && <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded uppercase tracking-tighter">⭐ Prioritario</span>}{projectOverdueDays > 0 && <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-tighter">⚠️ Atrasado</span>}</div>
                              <p className="text-xs text-slate-500 line-clamp-1">{project.descripcion || 'Sin descripci  n'}</p>
                              <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400 uppercase"><UserIcon size={10} /> Líder: <span className="text-indigo-500">{liderName}</span></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="hidden md:block text-right"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${getStatusColor(project.estado)}`}>{project.estado}</span><div className={`text-[10px] mt-1 font-bold ${projectOverdueDays > 0 ? 'text-red-500' : 'text-slate-400'}`}>{project.fecha_inicio} / {project.fecha_fin}</div></div>
                            <div className="w-32 flex flex-col gap-1"><div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Avance</span><span>{progressRaw.toFixed(0)}%</span></div><div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressBarColor(progressRaw)}`} style={{ width: `${progressRaw}%` }} /></div></div>
                            <div className="flex items-center gap-2">
                              {(currentUser?.is_admin || currentUser?.perm_projects_edit) && <button onClick={(e) => { e.stopPropagation(); setEditingItem(project); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={16}/></button>}
                              {(currentUser?.is_admin || currentUser?.perm_projects_delete) && <button onClick={(e) => { e.stopPropagation(); handleDelete(project.id!, 'projects'); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>}
                              <ChevronDown size={20} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 bg-slate-50/50">
                              <div className="p-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={12} /> Tareas Asociadas ({projectTasks.length})</h4>
                                {projectTasks.length === 0 ? <p className="text-xs text-slate-400 italic">No hay tareas asignadas a este proyecto.</p> : (
                                  <div className="space-y-2 mb-4">
                                    {projectTasks.map(t => {
                                      const tOverdue = getDaysOverdue(t.fecha_fin, t.estado);
                                      const isTaskSubExpanded = expandedTaskSubtasks.has(t.id!);
                                      const totalSubtasks = t.subtasks?.length || 0;
                                      const completedSubtasks = t.subtasks?.filter((st: any) => st.completada).length || 0;
                                      const canView = canViewSubtasks(String(t.responsable));
                                      const canToggle = canToggleSubtasks(String(t.responsable));
                                      const isTaskLocked = t.estado === 'Completado' || t.estado === 'Cancelado';
                                      const canEditTask = !!(currentUser?.is_admin || (currentUser?.can_edit_tasks && !isTaskLocked));

                                      return (
                                        <div key={t.id} className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-200 transition-colors group mb-2">
                                          <div className="flex items-center justify-between p-3">
                                            <div className="flex flex-col gap-1 w-1/3 min-w-[200px]"><span className="text-sm font-bold text-slate-800 line-clamp-1" title={t.actividad}>{t.actividad}</span><div className="flex items-center gap-2"><span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border ${getPriorityColor(t.prioridad)}`}>{getPriorityLabel(t.prioridad)}</span><span className={`text-[10px] font-bold ${tOverdue > 0 ? 'text-red-500' : 'text-slate-400'}`}>{t.fecha_fin} {tOverdue > 0 && '??'}</span></div></div>
                                            <div className="flex-1 px-4 flex items-center gap-3 justify-center"><div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getProgressBarColor(t.porcentaje_avance)}`} style={{ width: `${t.porcentaje_avance}%` }} /></div><span className={`text-[10px] font-bold w-6 text-right ${getProgressTextColor(t.porcentaje_avance)}`}>{t.porcentaje_avance}%</span></div>
                                            <div className="flex items-center gap-4 justify-end w-1/3"><span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${getStatusColor(t.estado)}`}>{t.estado}</span><div className="flex items-center gap-1.5" title={String(t.responsable)}><div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase border border-slate-200">{String(t.responsable || 'U').charAt(0)}</div><span className="text-[10px] font-bold text-slate-500 uppercase hidden sm:block w-16 truncate">{String(t.responsable || 'Usuario').split(' ')[0]}</span></div><div className="flex items-center gap-1">{canEditTask && (<button onClick={(e) => { e.stopPropagation(); setEditingItem(t); setEditingTaskFromProject(true); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Editar Tarea"><Edit2 size={16} /></button>)}<button onClick={() => { setSelectedTask(t); setDetailsTab('subtasks'); setIsDetailsModalOpen(true); fetchTaskDetails(t.id!); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Ver Detalles"><Eye size={16} /></button></div></div>
                                          </div>
                                          {totalSubtasks > 0 && canView && (
                                            <>
                                              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-1.5 flex items-center"><button onClick={() => toggleTaskSubtasksExpand(t.id!)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors w-max"><ChevronDown size={14} className={`transition-transform ${isTaskSubExpanded ? 'rotate-180' : ''}`} /> ? Subtareas ({completedSubtasks}/{totalSubtasks})</button></div>
                                              <AnimatePresence>
                                                {isTaskSubExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50 overflow-hidden">{t.subtasks?.map((st: any) => (<div key={st.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100/50 last:border-0"><button disabled={!canToggle} onClick={(e) => { e.stopPropagation(); canToggle && handleToggleSubtask(st.id, st.completada); }} className={`transition-colors ${st.completada ? 'text-emerald-500' : 'text-slate-300'} ${canToggle ? 'hover:text-blue-500 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>{st.completada ? <CheckSquare size={14} /> : <Square size={14} />}</button><span className={`text-xs ${st.completada ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{st.titulo}</span></div>))}</motion.div>)}
                                              </AnimatePresence>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {currentUser?.can_create_tasks && <button onClick={() => { setEditingItem(null); setPreselectedProjectId(project.id!); setCurrentView('tasks'); setIsModalOpen(true); }} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors w-max shadow-sm"><Plus size={14} /> A?adir Tarea a este Proyecto</button>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        {currentView === 'control' && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-6 mb-6 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-900">Filtro Maestro por área</h3>
                    <p className="text-sm text-slate-500">Selecciona un  área para visualizar todas sus actividades</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <Filter className="text-slate-400 shrink-0" size={20} />
                    <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:min-w-[240px]" value={controlAreaId || ''} onChange={(e) => setControlAreaId(e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">Todas las  áreas Autorizadas</option>
                      {areas.filter(a => {
                        if (currentUser?.is_admin) return true;
                        const autorizadas = currentUser?.areas_autorizadas ? String(currentUser.areas_autorizadas).split(',') : [];
                        return autorizadas.includes(a.id!.toString());
                      }).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 mt-6 pt-6 border-t border-slate-100">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar actividad en supervisión..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <MultiSelect
                      className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 text-sm font-medium w-full sm:w-56"
                      placeholder="Todos los Responsables"
                      selected={controlResponsableFilter}
                      onChange={setControlResponsableFilter}
                      options={Array.from(new Set(controlTasks.flatMap(t => t.responsable ? String(t.responsable).split(',').map(r => r.trim()) : []))).filter(Boolean).sort().map(resp => ({ value: String(resp), label: String(resp) }))}
                    />

                    <select className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 text-sm outline-none font-medium text-slate-600 w-full sm:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="All">Todos los Estados</option>
                      <option value="Planeado">Planeado</option>
                      <option value="En curso">En curso</option>
                      <option value="En espera">En espera</option>
                      <option value="Atrasadas">Atrasadas 🚨</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-slate-100">
                  <MultiSelect
                    className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 text-sm font-medium flex-1"
                    placeholder="Todas las Prioridades"
                    selected={controlPriorityFilter}
                    onChange={setControlPriorityFilter}
                    options={PRIORITY_OPTIONS}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar size={15} className="text-slate-400 shrink-0" />
                    <input type="date" className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 flex-1" value={controlDateFrom} onChange={e => setControlDateFrom(e.target.value)} title="Registro desde" />
                    <span className="text-slate-400 text-xs font-bold">—</span>
                    <input type="date" className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 flex-1" value={controlDateTo} onChange={e => setControlDateTo(e.target.value)} title="Registro hasta" />
                  </div>
                  {(controlPriorityFilter.length > 0 || controlDateFrom || controlDateTo) && (
                    <button onClick={() => { setControlPriorityFilter([]); setControlDateFrom(''); setControlDateTo(''); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all whitespace-nowrap">
                      <FilterX size={15} /> Limpiar
                    </button>
                  )}
                </div>
              </div>
			  
			  
			  
			  
			  
              <ChartsSection data={filteredControlTasks} />
              
              <div className="flex justify-end mb-4 relative z-20">
                <button onClick={(e) => { e.stopPropagation(); setShowColumnManager(!showColumnManager); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95">
                  <Settings size={14} /> Columnas
                </button>
                <AnimatePresence>
                  {showColumnManager && (
                    <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-10 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                      <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                        Personalizar Tabla
                        <button onClick={() => setShowColumnManager(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                      </div>
                      <div className="p-2 space-y-1">
                        {tableCols.map((col, idx) => (
                          <div key={col.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.id)} className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 w-4 h-4" />
                              <span className={`text-sm ${col.visible ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{col.label}</span>
                            </label>
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => moveColumn(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronDown size={14} className="rotate-180" /></button>
                              <button onClick={() => moveColumn(idx, 'down')} disabled={idx === tableCols.length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30 p-0.5"><ChevronDown size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {filteredControlTasks.length > 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto p-2">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white">
                        {tableCols.filter(c => c.visible).map(col => (
                          <th key={col.id} className={`px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${col.id === 'orden' || col.id === 'acciones' ? 'text-center' : ''}`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <AnimatePresence>
                        {filteredControlTasks.map((task, index) => {
                           const isTaskSubExpanded = expandedTaskSubtasks.has(task.id!);
                           const totalSubtasks = task.subtasks?.length || 0;
                           const canView = canViewSubtasks(String(task.responsable));
                           const canToggle = canToggleSubtasks(String(task.responsable));

                           return (
                            <React.Fragment key={task.id}>
                              <motion.tr layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="hover:bg-slate-50 transition-colors">
                                {tableCols.filter(c => c.visible).map(col => renderDynamicCell(col.id, task, index, true))}
                              </motion.tr>
                              {isTaskSubExpanded && totalSubtasks > 0 && canView && (
                                 <tr>
                                   <td colSpan={tableCols.filter(c => c.visible).length} className="p-0 border-b border-slate-100 bg-slate-50/50">
                                     <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="px-8 py-3"><div className="space-y-2 border-l-2 border-indigo-200 pl-4 py-1 ml-2">{task.subtasks.map((st: any) => (<div key={st.id} className="flex items-center gap-2"><button disabled={!canToggle} onClick={(e) => { e.stopPropagation(); canToggle && handleToggleSubtask(st.id, st.completada); }} className={`transition-colors ${st.completada ? 'text-emerald-500' : 'text-slate-300'} ${canToggle ? 'hover:text-blue-500 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>{st.completada ? <CheckSquare size={16} /> : <Square size={16} />}</button><span className={`text-xs ${st.completada ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{st.titulo}</span></div>))}</div></div>
                                     </motion.div>
                                   </td>
                                 </tr>
                              )}
                            </React.Fragment>
                           );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                 <div className="p-8 text-center text-slate-400 text-sm mt-6 bg-white rounded-2xl border border-slate-200">No hay tareas para supervisar en esta   rea.</div>
              )}
            </>
          )}

          {currentView === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allUsers.length === 0 ? <div className="col-span-full p-8 text-center text-slate-400 text-sm">No hay usuarios para mostrar.</div> : (
                allUsers.map(user => {
                  const areaName = areas.find(a => a.id === user.area_id)?.nombre || (user as any).area_nombre || 'Sin   rea';
                  return (
                    <div key={user.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group relative">
                       <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user.is_admin ? 'bg-red-100 text-red-600 shadow-sm shadow-red-100' : 'bg-slate-100 text-slate-400'}`}>{user.is_admin ? <Shield size={24} /> : <UserIcon size={24} />}</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(currentUser?.is_admin || currentUser?.perm_users_edit) && <button onClick={() => { setEditingItem(user); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>}
                          {(currentUser?.is_admin || currentUser?.perm_users_delete) && <button onClick={() => handleDelete(user.id!, 'users')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-slate-900">{user.nombre} {user.apellido}</h3>{user.is_admin ? <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Admin</span> : null}</div>
                      <p className="text-xs text-slate-500 mb-4">{user.cargo} ? {areaName}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}
          
          {currentView === 'areas' && (
             <div className="max-w-3xl">
               {areas.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No hay   reas creadas o hubo un problema al cargarlas desde el servidor.</div> : renderAreaTree()}
             </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsModalOpen(false); setEditingTaskFromProject(false); setIsModalReadOnly(false); }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{isModalReadOnly ? 'Ver' : (editingItem ? 'Editar' : 'Nuevo')} {(currentView === 'tasks' || currentView === 'control' || editingTaskFromProject) ? 'Tarea' : currentView === 'users' ? 'Usuario' : currentView === 'projects' ? 'Proyecto' : 'Área'}</h3>
                  {isModalReadOnly && <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wide">Solo lectura</span>}
                </div>
                <button onClick={() => { setIsModalOpen(false); setEditingTaskFromProject(false); setIsModalReadOnly(false); }} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>

              <form onSubmit={(currentView === 'tasks' || currentView === 'control' || editingTaskFromProject) ? handleTaskSubmit : currentView === 'users' ? handleUserSubmit : currentView === 'projects' ? handleProjectSubmit : handleAreaSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50">

                {(currentView === 'tasks' || currentView === 'control' || editingTaskFromProject) && (
                  <div className="space-y-6">
                    {isModalReadOnly && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold">
                        <Lock size={15} className="shrink-0" />
                        Esta tarea está completada. Los campos son de solo lectura.
                      </div>
                    )}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">1. Identificación Básica</h4>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Actividad</label>
                        <input name="actividad" required defaultValue={editingItem?.actividad} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Proyecto / Iniciativa</label>
                          <select name="proyecto_id" defaultValue={editingItem?.proyecto_id || preselectedProjectId || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none text-indigo-700 font-medium ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:border-indigo-500'}`}>
                            <option value="">Ninguno</option>
                            {projects.filter(p => p.estado === 'Activo').map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">  área / Origen</label>
                          <select name="area_origen_id" defaultValue={editingItem?.area_origen_id || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`}>
                            <option value="">Selecciona un área</option>
                            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                          <input name="tipo" placeholder="Ej: Mejora, Soporte, Desarrollo..." defaultValue={editingItem?.tipo} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Temática</label>
                          <input name="tematica" placeholder="Ej: Facturación Electrónica" defaultValue={editingItem?.tematica} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">2. Asignación y Tiempos</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Gerente / Jefe Responsable</label>
                          <select name="gerente_responsable" defaultValue={editingItem?.gerente_responsable || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`}>
                            <option value="">Sin Asignar</option>
                            {allUsers.map(u => <option key={u.id} value={`${u.nombre} ${u.apellido}`}>{u.nombre} {u.apellido}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between items-center">
                            <span>Ejecutores ({selectedResponsibles.length})</span>
                          </label>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input type="text" placeholder="Buscar usuario..." disabled={isModalReadOnly} className={`w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white focus:border-blue-400'}`} value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} />
                              </div>
                              <div className="max-h-24 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {allUsers.filter(u => `${u.nombre} ${u.apellido}`.toLowerCase().includes(userSearchTerm.toLowerCase())).map(u => {
                                      const fullName = `${u.nombre} ${u.apellido}`;
                                      const isSelected = selectedResponsibles.includes(fullName);
                                      return (
                                          <div key={u.id} onClick={() => !isModalReadOnly && toggleResponsible(fullName)} className={`flex items-center gap-2 p-2 rounded-lg transition-colors border ${isModalReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-transparent hover:border-slate-200 text-slate-600'}`}>
                                              {isSelected ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-slate-400"/>}
                                              <span className="text-xs font-bold truncate" title={fullName}>{fullName}</span>
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Registro</label>
                          <input name="fecha_registro" type="date" readOnly defaultValue={editingItem?.fecha_registro || new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-not-allowed text-slate-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Inicio</label>
                          <input name="fecha_inicio" type="date" required defaultValue={editingItem?.fecha_inicio} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Compromiso</label>
                          <input name="fecha_fin" type="date" required defaultValue={editingItem?.fecha_fin} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Compromiso Semanal</label>
                        <textarea name="compromiso_semanal" rows={2} placeholder="Meta de la semana..." defaultValue={editingItem?.compromiso_semanal} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none resize-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-2 border-b border-indigo-200 pb-2">3. M  tricas y Evaluaci  n (Matriz)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600 uppercase">Alineación Estratégica</label>
                          <select name="alineacion_estrategica" defaultValue={editingItem?.alineacion_estrategica || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-indigo-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white focus:border-indigo-500'}`}>
                            <option value="">Seleccione una opción</option>
                            <option value="WIG 1 Crecimiento de Ingresos">WIG 1 Crecimiento de Ingresos</option>
                            <option value="WIG 2 Reducci  n y control del costo">WIG 2 Reducción y control del costo</option>
                            <option value="WIG 3 Satisfacci  n del cliente">WIG 3 Satisfacción del cliente</option>
                          </select>
                        </div>
                        <div className="space-y-1 flex flex-col justify-end">
                           <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors h-[38px]">
                             <input type="checkbox" name="requiere_inversion" defaultChecked={editingItem?.requiere_inversion} disabled={isModalReadOnly} className={`w-4 h-4 text-indigo-600 rounded border-indigo-300 ${isModalReadOnly ? 'cursor-not-allowed opacity-60' : ''}`} />
                             <span className="text-sm font-bold text-indigo-900">Requiere Inversión Económica</span>
                           </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600 uppercase">Impacto Financiero/Operativo</label>
                          <select name="impacto" defaultValue={editingItem?.impacto || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-indigo-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white focus:border-indigo-500'}`}>
                            <option value="">Seleccione una opción</option>
                            <option value="1. Bajo">1. Bajo</option>
                            <option value="2. Medio">2. Medio</option>
                            <option value="3. Alto">3. Alto</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600 uppercase">Viabilidad Técnica</label>
                          <select name="viabilidad_tecnica" defaultValue={editingItem?.viabilidad_tecnica || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-indigo-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white focus:border-indigo-500'}`}>
                            <option value="">Seleccione una opción</option>
                            <option value="1. Alta Complejidad">1. Alta Complejidad</option>
                            <option value="2. Media Complejidad">2. Media Complejidad</option>
                            <option value="3. Baja Complejidad">3. Baja Complejidad</option> 
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600 uppercase">Calificación Total</label>
                          <div className="w-full px-4 py-2 bg-indigo-100/50 border border-indigo-200 rounded-xl text-indigo-400 text-sm font-medium italic">
                            {editingItem?.calificacion ? `? ${editingItem.calificacion} Puntos` : 'Autom  tico'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600 uppercase">Orden de Ejecución (Manual)</label>
                          <input name="orden_ejecucion" type="number" min="1" placeholder="Ej: 1" defaultValue={editingItem?.orden_ejecucion || ''} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-indigo-400 rounded-xl outline-none font-bold text-indigo-900 shadow-sm ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20'}`} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">4. Control y Estado</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Prioridad</label>
                          <select name="prioridad" defaultValue={editingItem?.prioridad || '2|Media'} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`}>
                            <option value="0|Muy Alta">Muy Alta</option><option value="1|Alta">Alta</option><option value="2|Media">Media</option><option value="3|Baja">Baja</option><option value="4|Muy Baja">Muy Baja</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label>
                          <select name="estado" defaultValue={editingItem?.estado || 'Planeado'} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`}>
                            {(!editingItem || editingItem.estado === 'Planeado' || currentUser?.is_admin) && <option value="Planeado">Planeado</option>}
                            <option value="En curso">En curso</option>
                            <option value="En espera">En espera</option>
                            <option value="Completado">Completado</option>
                            {editingItem && <option value="Cancelado">Cancelado</option>}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">% Avance Actual</label>
                          <input name="porcentaje_avance" type="number" min="0" max="100" required defaultValue={editingItem?.porcentaje_avance || 0} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Dependencia (Prerequisito)</label>
                          <textarea name="prerequisito" rows={2} defaultValue={editingItem?.prerequisito} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none resize-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Observaciones</label>
                          <textarea name="observacion" rows={2} defaultValue={editingItem?.observacion} disabled={isModalReadOnly} className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none resize-none ${isModalReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-500'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {currentView === 'projects' && !editingTaskFromProject && (
                  <>
                    <div className="space-y-1 mb-4">
                       <label className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors">
                         <input type="checkbox" name="prioritario" defaultChecked={editingItem?.prioritario} className="w-5 h-5 text-orange-600 rounded border-orange-300" />
                         <span className="text-sm font-bold text-orange-800">Marcar como Proyecto Prioritario ??</span>
                       </label>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Proyecto</label><input name="nombre" required defaultValue={editingItem?.nombre} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Descripci  n</label><textarea name="descripcion" rows={3} defaultValue={editingItem?.descripcion} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 resize-none" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">L  der del Proyecto</label><select name="lider_id" defaultValue={editingItem?.lider_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"><option value="">Sin Asignar</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Inicio</label><input name="fecha_inicio" type="date" defaultValue={editingItem?.fecha_inicio} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Fin Estimada</label><input name="fecha_fin" type="date" defaultValue={editingItem?.fecha_fin} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" /></div></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label><select name="estado" defaultValue={editingItem?.estado || 'Activo'} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"><option value="Activo">Activo</option><option value="Finalizado">Finalizado</option><option value="Cancelado">Cancelado</option></select></div>
                  </>
                )}

                {currentView === 'users' && (
                  <>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Nombre</label><input name="nombre" required defaultValue={editingItem?.nombre} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Apellido</label><input name="apellido" required defaultValue={editingItem?.apellido} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Email</label><input name="email" type="email" required defaultValue={editingItem?.email} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Contrase?a {editingItem && '(Dejar vac  o si no cambia)'}</label><input name="password" type="password" required={!editingItem} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Cargo</label><input name="cargo" required defaultValue={editingItem?.cargo} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">  rea</label><select name="area_id" defaultValue={editingItem?.area_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"><option value="">Sin   rea</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div></div>
                    {formJefe && <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium border border-blue-100 flex items-center gap-2"><Shield size={16} /> Jefe Directo Calculado: <span className="font-bold">{formJefe}</span></div>}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="font-bold text-slate-900 text-sm">Permisos y Accesos</h4>
                      <div className="flex flex-col gap-3">
                         <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-100"><input type="checkbox" name="debe_cambiar_password" defaultChecked={editingItem?.debe_cambiar_password} className="w-5 h-5 text-amber-600 rounded border-amber-300" /><span className="text-sm font-bold text-amber-800">Exigir cambio de contraseña al ingresar</span></label>
                         <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100"><input type="checkbox" name="is_admin" defaultChecked={editingItem?.is_admin} className="w-5 h-5 text-blue-600 rounded" /><span className="text-sm font-bold text-slate-700">Administrador Total del Sistema</span></label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Tareas</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="can_create_tasks" defaultChecked={editingItem?.can_create_tasks} className="rounded text-blue-600" /> Crear</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="can_edit_tasks" defaultChecked={editingItem?.can_edit_tasks} className="rounded text-blue-600" /> Editar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="can_delete_tasks" defaultChecked={editingItem?.can_delete_tasks} className="rounded text-blue-600" /> Eliminar</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Subtareas</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_subtasks_view" defaultChecked={editingItem?.perm_subtasks_view} className="rounded text-blue-600" /> Ver</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_subtasks_create" defaultChecked={editingItem?.perm_subtasks_create} className="rounded text-blue-600" /> Crear</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_subtasks_edit" defaultChecked={editingItem?.perm_subtasks_edit} className="rounded text-blue-600" /> Marcar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_subtasks_edit_title" defaultChecked={editingItem?.perm_subtasks_edit_title} className="rounded text-blue-600" /> Editar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_subtasks_delete" defaultChecked={editingItem?.perm_subtasks_delete} className="rounded text-blue-600" /> Eliminar</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Proyectos</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_projects_view" defaultChecked={editingItem?.perm_projects_view} className="rounded text-blue-600" /> Ver</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_projects_create" defaultChecked={editingItem?.perm_projects_create} className="rounded text-blue-600" /> Crear</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_projects_edit" defaultChecked={editingItem?.perm_projects_edit} className="rounded text-blue-600" /> Editar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_projects_delete" defaultChecked={editingItem?.perm_projects_delete} className="rounded text-blue-600" /> Eliminar</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Reportes</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_reports_view" defaultChecked={editingItem?.perm_reports_view} className="rounded text-indigo-600" /> Ver Reportes</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Cronograma</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_gantt_view" defaultChecked={(editingItem as any)?.perm_gantt_view} className="rounded text-indigo-600" /> Ver Cronograma (Gantt)</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Usuarios</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_users_view" defaultChecked={editingItem?.perm_users_view} className="rounded text-blue-600" /> Ver</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_users_create" defaultChecked={editingItem?.perm_users_create} className="rounded text-blue-600" /> Crear</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_users_edit" defaultChecked={editingItem?.perm_users_edit} className="rounded text-blue-600" /> Editar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_users_delete" defaultChecked={editingItem?.perm_users_delete} className="rounded text-blue-600" /> Eliminar</label></div>
                         <div className="space-y-2 p-4 border border-slate-200 rounded-xl bg-white shadow-sm"><h5 className="text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100">Areas</h5><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_areas_view" defaultChecked={editingItem?.perm_areas_view} className="rounded text-blue-600" /> Ver</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_areas_create" defaultChecked={editingItem?.perm_areas_create} className="rounded text-blue-600" /> Crear</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_areas_edit" defaultChecked={editingItem?.perm_areas_edit} className="rounded text-blue-600" /> Editar</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perm_areas_delete" defaultChecked={editingItem?.perm_areas_delete} className="rounded text-blue-600" /> Eliminar</label></div>
                      </div>

                      <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-sm">
                         <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={accesoSupervision} onChange={(e) => setAccesoSupervision(e.target.checked)} className="w-5 h-5 text-blue-600 rounded" /><span className="text-sm font-bold text-slate-700">Otorgar acceso a "Control de Gestión"</span></label>
                         
                         {/* FIX 2: Checkbox para habilitar edici  n en Control de Gestión */}
                         {accesoSupervision && (
						 <>
                           <label className="flex items-center gap-3 cursor-pointer mt-2 pl-8">
                             <input type="checkbox" name="perm_control_edit" defaultChecked={editingItem?.perm_control_edit} className="w-5 h-5 text-indigo-600 rounded border-indigo-300" />
                             <span className="text-sm font-bold text-indigo-700">Permitir EDITAR tareas desde la vista de Control de Gestión</span>
                           </label>
						   
					         {/* 🚀 NUEVO: Checkbox para habilitar eliminación en Control de Gestión */}
                             <label className="flex items-center gap-3 cursor-pointer mt-2 pl-8">
                               <input type="checkbox" name="perm_control_delete" defaultChecked={editingItem?.perm_control_delete} className="w-5 h-5 text-red-600 rounded border-red-300" />
                               <span className="text-sm font-bold text-red-700">Permitir ELIMINAR tareas desde la vista de Control de Gestión</span>
                             </label>
                           </>
                         )}

<label className="flex items-center gap-3 cursor-pointer mt-2 pl-8">
     <input 
       type="checkbox" 
       name="can_download_evidence" 
       defaultChecked={editingItem?.can_download_evidence} 
       className="w-5 h-5 text-indigo-600 rounded border-indigo-300" 
     />
     <span className="text-sm font-bold text-indigo-700">Permitir DESCARGAR evidencias adjuntas</span>
   </label>

<label className="flex items-center gap-3 cursor-pointer mt-2 pl-8">
     <input 
       type="checkbox" 
       name="can_delete_evidence" 
       defaultChecked={editingItem?.can_delete_evidence} 
       className="w-5 h-5 text-red-600 rounded border-red-300" 
     />
     <span className="text-sm font-bold text-red-700">Permitir ELIMINAR evidencias adjuntas</span>
   </label>




                         {accesoSupervision && (
                           <div className="pl-8 space-y-2 mt-2 border-t border-slate-100 pt-3">
                             <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Selecciona las areas que puede supervisar:</span>
                             <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                               {areas.map(a => (<label key={a.id} className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 cursor-pointer"><input type="checkbox" className="rounded text-blue-600" checked={selectedAreas.includes(a.id!)} onChange={(e) => { if (e.target.checked) setSelectedAreas(prev => [...prev, a.id!]); else setSelectedAreas(prev => prev.filter(id => id !== a.id!)); }} />{a.nombre}</label>))}
                             </div>
                           </div>
                         )}
                      </div>
                    </div>
                  </>
                )}

                {currentView === 'areas' && (
                  <>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del   rea</label><input name="nombre" required defaultValue={editingItem?.nombre} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Descripci  n</label><textarea name="descripcion" required rows={3} defaultValue={editingItem?.descripcion} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none" /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">  rea Padre (Opcional)</label><select name="parent_area_id" defaultValue={editingItem?.parent_area_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"><option value="">Ninguna (Nivel Ra  z)</option>{areas.filter(a => a.id !== editingItem?.id).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Jefe de   rea (Opcional)</label><select name="jefe_id" defaultValue={editingItem?.jefe_id || ''} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"><option value="">Sin Asignar</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}</select></div></div>
                  </>
                )}
                
                {currentView !== 'tasks' && currentView !== 'control' && currentView !== 'users' && currentView !== 'areas' && currentView !== 'projects' && (
                  <p className="text-center text-sm text-slate-500 py-8">Formulario de administraci  n {currentView}</p>
                )}

              <div className="pt-6 flex gap-3">
                  {!isModalReadOnly && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex-1 text-white py-3 rounded-xl font-bold transition-all shadow-lg ${isSubmitting ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 active:scale-95'}`}
                    >
                      {isSubmitting ? 'Guardando...' : (editingItem ? 'Guardar Cambios' : 'Crear Registro')}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => { setIsModalOpen(false); setIsModalReadOnly(false); }}
                    className={`${isModalReadOnly ? 'flex-1' : 'px-6'} py-3 rounded-xl font-bold transition-all ${isSubmitting ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {isModalReadOnly ? 'Cerrar' : 'Cancelar'}
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
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                     <div>
                       <div className="flex items-center gap-3 mb-1"><h3 className="text-xl font-black text-slate-900">{selectedTask.actividad}</h3><span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${getStatusColor(selectedTask.estado)}`}>{selectedTask.estado}</span></div>
                     </div>
                     <button onClick={() => { setIsDetailsModalOpen(false); setShowLinkForm(false); setLinkUrl(''); setLinkTitle(''); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                   </div>
                   
                   <div className="flex border-b border-slate-100 px-6 bg-white shrink-0">
                      <button onClick={() => setDetailsTab('subtasks')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'subtasks' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><div className="flex items-center gap-2"><ListChecks size={16} /> Subtareas</div></button>
                      <button onClick={() => setDetailsTab('comments')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'comments' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><div className="flex items-center gap-2"><Activity size={16} /> Registro de Avances</div></button>
                      <button onClick={() => setDetailsTab('attachments')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${detailsTab === 'attachments' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><div className="flex items-center gap-2"><Paperclip size={16} /> Evidencias</div></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6">
                      {detailsTab === 'subtasks' && (
                         <div className="flex flex-col h-[50vh]">
                            <div className="flex-1 overflow-y-auto mb-4 pr-2" onPointerUp={persistSubtaskOrder}>
                               {subtaskItems.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center h-full text-slate-400"><ListChecks size={32} className="mb-2 opacity-50" /><span className="text-sm font-medium">No hay subtareas registradas en esta actividad</span></div>
                               ) : (
                                  <Reorder.Group axis="y" values={subtaskItems} onReorder={handleSubtaskReorder} className="space-y-2">
                                     {subtaskItems.map((st: any) => {
                                        const canToggle = canToggleSubtasks(String(selectedTask.responsable));
                                        const canDelete = canDeleteSubtasks();
                                        const canEdit = canEditSubtaskContent(String(selectedTask.responsable), selectedTask.created_by_id);
                                        const today = new Date(); today.setHours(0,0,0,0);
                                        const isOverdue = st.fecha_compromiso && !st.completada && new Date(st.fecha_compromiso) < today;
                                        return (
                                           <Reorder.Item key={st.id} value={st} className={`flex items-center gap-2 p-3 border rounded-xl transition-colors cursor-grab active:cursor-grabbing active:shadow-md active:z-10 ${isOverdue ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                                              <GripVertical size={15} className="text-slate-300 shrink-0 pointer-events-none" />
                                              <button disabled={!canToggle} onClick={() => canToggle && handleToggleSubtask(st.id, st.completada)} className={`transition-colors shrink-0 ${st.completada ? 'text-emerald-500' : 'text-slate-300'} ${canToggle ? 'hover:text-blue-500 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>{st.completada ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                                              {editingSubtaskTitleId === st.id ? (
                                                <input type="text" defaultValue={st.titulo} className="flex-1 text-sm px-2 py-1 border border-indigo-300 rounded-lg outline-none focus:border-indigo-500 bg-white font-bold min-w-0" autoFocus onBlur={e => handleUpdateSubtaskTitle(st.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleUpdateSubtaskTitle(st.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingSubtaskTitleId(null); }} />
                                              ) : (
                                                <span className={`flex-1 text-sm min-w-0 ${st.completada ? 'text-slate-400 line-through' : 'text-slate-700 font-bold'}`}>{st.titulo}</span>
                                              )}
                                              {canEdit && editingSubtaskTitleId !== st.id && (
                                                <button onClick={() => setEditingSubtaskTitleId(st.id)} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors shrink-0" title="Editar título"><Edit2 size={14}/></button>
                                              )}
                                              {canEdit ? (
                                                editingSubtaskDateId === st.id ? (
                                                  <input type="date" defaultValue={st.fecha_compromiso || ''} className="text-xs px-2 py-1 border border-indigo-300 rounded-lg outline-none focus:border-indigo-500 bg-white" autoFocus onBlur={e => handleUpdateSubtaskDate(st.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleUpdateSubtaskDate(st.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingSubtaskDateId(null); }} />
                                                ) : (
                                                  <button onClick={() => setEditingSubtaskDateId(st.id)} title="Editar fecha de compromiso" className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 transition-colors ${st.fecha_compromiso ? (isOverdue ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200') : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}>
                                                    <Calendar size={12} />
                                                    <span>{st.fecha_compromiso || 'Fecha'}</span>
                                                  </button>
                                                )
                                              ) : st.fecha_compromiso ? (
                                                <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}><Calendar size={12} /><span>{st.fecha_compromiso}</span></span>
                                              ) : null}
                                              {canDelete && <button onClick={() => handleDeleteSubtask(st.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors shrink-0" title="Eliminar"><Trash2 size={16}/></button>}
                                              {!canDelete && !canToggle && !canEdit && <Lock size={14} className="text-slate-300 shrink-0" />}
                                           </Reorder.Item>
                                        );
                                     })}
                                  </Reorder.Group>
                               )}
                            </div>
                            {canCreateSubtasks() && (
                               <form onSubmit={handleAddSubtask} className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                                  <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Escribe una nueva subtarea..." className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" required />
                                  <div className="flex gap-2">
                                     <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                        <input type="date" value={newSubtaskDate} onChange={e => setNewSubtaskDate(e.target.value)} className="flex-1 text-sm bg-transparent outline-none text-slate-600" />
                                     </div>
                                     <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 whitespace-nowrap"><Plus size={16}/> Agregar</button>
                                  </div>
                               </form>
                            )}
                         </div>
                      )}

                      {detailsTab === 'comments' && (
                        <div className="flex flex-col h-[50vh]">
                          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                             {comments.length === 0 ? (
                               <div className="flex flex-col items-center justify-center h-full text-slate-400"><Activity size={32} className="mb-2 opacity-50" /><span className="text-sm font-medium">No hay avances registrados a  n</span></div>
                             ) : (
                               comments.map(c => {
                                 const isQuote = c.content.startsWith('> Citando a'); let quotePart = ''; let replyPart = c.content;
                                 if (isQuote) { const parts = c.content.split('\n\n'); quotePart = parts[0].replace(/> /g, ''); replyPart = parts.slice(1).join('\n\n'); }
                                 
                                 return (
                                   <div key={c.id} className={`flex gap-3 group ${c.user_id === currentUser?.id ? 'flex-row-reverse' : ''}`}>
                                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-xs font-bold shrink-0 uppercase shadow-sm">{String(c.user?.nombre || 'U').charAt(0)}{String(c.user?.apellido || '').charAt(0)}</div>
                                      <div className="flex flex-col gap-1 max-w-[80%]">
                                        <div className={`p-3 rounded-2xl shadow-sm flex flex-col gap-1.5 ${c.user_id === currentUser?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'}`}>
                                           <div className="flex items-center justify-between gap-4"><span className={`text-[10px] font-bold ${c.user_id === currentUser?.id ? 'text-blue-200' : 'text-slate-500'}`}>{c.user?.nombre} {c.user?.apellido}</span></div>
                                           {isQuote && <div className={`pl-3 py-1 mb-1 border-l-2 text-xs italic rounded-r-md ${c.user_id === currentUser?.id ? 'border-blue-300 bg-blue-700/30 text-blue-100' : 'border-slate-400 bg-slate-200/50 text-slate-600'}`}>{quotePart}</div>}
                                           
                                           {c.subtask && (
                                              <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded w-max mb-1 ${c.user_id === currentUser?.id ? 'bg-blue-800/30 text-blue-100' : 'bg-slate-200 text-slate-600'}`}>
                                                 <Tag size={10} /> Referente a: {c.subtask.titulo}
                                              </div>
                                           )}

                                      {/* MODO EDICI  N VS MODO LECTURA */}
                                           {editingCommentId === c.id ? (
                                              <div className="flex flex-col gap-2 mt-1">
                                                <textarea 
                                                  value={editCommentContent} 
                                                  onChange={(e) => setEditCommentContent(e.target.value)} 
                                                  className="w-full p-2 text-sm text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                                                  rows={3}
                                                />
                                                <div className="flex justify-end gap-2">
                                                  <button onClick={() => setEditingCommentId(null)} className="px-3 py-1 text-[10px] font-bold bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Cancelar</button>
                                                  <button onClick={() => handleUpdateComment(c.id)} className="px-3 py-1 text-[10px] font-bold bg-emerald-500 text-white rounded hover:bg-emerald-600">Guardar</button>
                                                </div>
                                              </div>
                                           ) : (
                                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{replyPart}</p>
                                           )}

                                           <span className={`text-[9px] font-medium text-right ${c.user_id === currentUser?.id ? 'text-blue-200' : 'text-slate-400'}`}>{new Date(c.created_at).toLocaleString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        
                                        <div className={`flex items-center gap-3 mt-1 ${c.user_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                                          <button onClick={() => setReplyingTo(c)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all px-1"><Reply size={12} /> Citar</button>
                                          
                                          {/* BOTONES EDITAR Y ELIMINAR (Solo due?o y si no est   completada/cancelada) */}
                                          {c.user_id === currentUser?.id && selectedTask?.estado !== 'Completado' && selectedTask?.estado !== 'Cancelado' && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                              <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(replyPart); }} className="text-slate-400 hover:text-blue-500" title="Editar"><Edit2 size={12} /></button>
                                              <button onClick={() => handleDeleteComment(c.id)} className="text-slate-400 hover:text-red-500" title="Eliminar"><Trash2 size={12} /></button>
                                            </div>
                                          )}
                                        </div>

                                     </div>
                                   </div>
                                 );
                               })
                             )}
                          </div>
                          
                          <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                             {replyingTo && (
                               <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-start gap-4">
                                 <div className="text-xs text-indigo-800"><span className="font-bold flex items-center gap-1"><Reply size={12}/> Respondiendo a {replyingTo.user?.nombre}:</span><p className="italic line-clamp-2 opacity-80 mt-1 border-l-2 border-indigo-300 pl-2">{replyingTo.content.replace(/> Citando a.*\n> ".*"\n\n/g, '')}</p></div>
                                 <button type="button" onClick={() => setReplyingTo(null)} className="text-indigo-400 hover:text-indigo-700 p-1 bg-indigo-100 rounded-full"><X size={14}/></button>
                               </div>
                             )}

                             {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                                <select 
                                  className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 outline-none focus:border-blue-400"
                                  value={selectedSubtaskIdForComment}
                                  onChange={(e) => setSelectedSubtaskIdForComment(e.target.value)}
                                >
                                  <option value="">-- Comentario general de la tarea --</option>
                                  {selectedTask.subtasks.map((st: any) => (
                                    <option key={st.id} value={st.id}>Referente a: {st.titulo}</option>
                                  ))}
                                </select>
                             )}

                             <form onSubmit={handleCommentSubmit} className="flex gap-2">
                                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Registrar un nuevo avance..." className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm" required />
                                <button type="submit" disabled={isSubmittingComment} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md active:scale-95">Registrar</button>
                             </form>
                          </div>
                        </div>
                      )}

                      {detailsTab === 'attachments' && (
                         <div className="flex flex-col h-[50vh]">
                            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                               {attachments.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-400"><Paperclip size={32} className="mb-2 opacity-50" /><span className="text-sm font-medium">No hay evidencias adjuntas</span></div> : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                     {attachments.map(att => {
                                        const isLink = att.type === 'link';
                                        const linkHost = isLink ? (() => { try { return new URL(att.filepath).hostname; } catch { return ''; } })() : '';
                                        return (
                                        <div key={att.id} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors group">
                                           <div className={`p-2 rounded-lg shrink-0 ${isLink ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>{isLink ? <Link2 size={20} /> : <FileText size={20} />}</div>
                                           <div className="flex-1 min-w-0">
                                              {isLink ? (
                                                 <a href={att.filepath} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-700 hover:underline truncate block" title={att.filepath}>{att.filename || att.filepath}</a>
                                              ) : (
                                                 <p className="text-sm font-bold text-slate-700 truncate" title={att.filename}>{att.filename || 'Archivo adjunto'}</p>
                                              )}
                                              <p className="text-[10px] text-slate-400 font-medium truncate">{linkHost ? `${linkHost} · ` : ''}{new Date(att.uploaded_at).toLocaleString()}</p>
                                           </div>
		{/* Enlaces: abrir es libre. Archivos: descarga solo con permiso explícito o admin */}
		{isLink ? (
		  <a href={att.filepath} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 rounded-lg shadow-sm transition-all shrink-0 opacity-0 group-hover:opacity-100" title="Abrir enlace">
			<ExternalLink size={16}/>
		  </a>
		) : (currentUser?.is_admin || (currentUser as any)?.can_download_evidence) && (
		  <a href={att.filepath} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 rounded-lg shadow-sm transition-all shrink-0 opacity-0 group-hover:opacity-100" title="Descargar evidencia">
			<Download size={16}/>
		  </a>
		)}
		{(currentUser?.is_admin || (currentUser as any)?.can_delete_evidence) && (
		  <button
			type="button"
			onClick={() => handleDeleteEvidence(att.id)}
			className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-lg shadow-sm transition-all shrink-0 opacity-0 group-hover:opacity-100 ml-1"
			title="Eliminar evidencia"
		  >
			<Trash2 size={16}/>
		  </button>
		)}



                                           </div>
                                     );})}
                                  </div>
                               )}
                            </div>
                            <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                               <AnimatePresence>
                                  {showLinkForm && (
                                     <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleAddLink} className="overflow-hidden">
                                        <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                                           <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://ejemplo.com/documento" autoFocus className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                                           <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Nombre para mostrar (opcional)" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                                           <div className="flex justify-end gap-2 pt-1">
                                              <button type="button" onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkTitle(''); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all">Cancelar</button>
                                              <button type="submit" disabled={isAddingLink || !linkUrl.trim()} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">{isAddingLink ? 'Agregando...' : 'Agregar enlace'}</button>
                                           </div>
                                        </div>
                                     </motion.form>
                                  )}
                               </AnimatePresence>
                               <div className="grid grid-cols-2 gap-3">
                                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-600 transition-all text-slate-500">
                                     {isUploading ? <span className="text-sm font-bold animate-pulse">Subiendo archivo...</span> : <><Upload size={18} /><span className="text-sm font-bold">Subir archivo</span><input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} /></>}
                                  </label>
                                  <button type="button" onClick={() => setShowLinkForm(prev => !prev)} className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl transition-all ${showLinkForm ? 'bg-blue-50 border-blue-400 text-blue-600' : 'border-slate-300 text-slate-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600'}`}>
                                     <Link2 size={18} /><span className="text-sm font-bold">Agregar enlace</span>
                                  </button>
                               </div>
                            </div>
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
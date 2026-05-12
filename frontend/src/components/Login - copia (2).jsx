import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User } from 'lucide-react';
import api from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); // Evita que el formulario recargue la página

    try {
      // Enviamos la petición al backend
      const response = await api.post('/login', { email, password });
      
      // Verificamos si recibimos el token
      if (response.data && response.data.token) {
		  
		  // 1. Guardar el token (Esto se mantiene igual)
  localStorage.setItem('token', response.data.token);
  
// 2. INYECTAR TODOS LOS PERMISOS MAESTROS AL USUARIO
  const usuarioConPermisos = {
    ...response.data.user,
    is_admin: true,
    acceso_supervision: true,
    
    // Permisos de Tareas
    can_create_tasks: true,
    can_edit_tasks: true,
    can_delete_tasks: true,
    
    // Permisos del Módulo de Usuarios
    perm_users_view: true,
    perm_users_create: true,
    perm_users_edit: true,
    perm_users_delete: true,
    
    // Permisos del Módulo de Áreas
    perm_areas_view: true,
    perm_areas_create: true,
    perm_areas_edit: true,
    perm_areas_delete: true,

    // Truco: Asignar el área de Dirección para visibilidad global
    area_nombre: 'DIRECCION'
  };
  
  localStorage.setItem('user', JSON.stringify(usuarioConPermisos));
  
  // 3. LA ORDEN DE NAVEGAR
  window.location.href = '/dashboard';
		  
		  
		  
        // 1. Guardamos el Token en el almacenamiento local del navegador
        //localStorage.setItem('token', response.data.token);
        
        // 2. Guardamos los datos del usuario para el perfil
       // localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // 3. NAVEGACIÓN: Usamos el router de React para ir al Dashboard
        // Esto cambia la vista sin recargar el navegador
       // navigate('/dashboard'); 
      }
    } catch (error) {
      // Si el backend responde con error (ej. 401), mostramos el mensaje
      const errorMsg = error.response?.data?.error || "Error de validación: Verifique sus credenciales.";
      alert(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4 border-blue-600">
        <div className="bg-slate-50 p-8 text-center border-b">
          <div className="flex justify-center mb-3 text-blue-600">
            <ShieldCheck size={54} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">TASKFLOW PRO</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">IT Operations Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Usuario de Red</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="email" 
                placeholder="admin@taskflow.com"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transform transition active:scale-95"
          >
            INGRESAR AL SISTEMA
          </button>
          <div className="text-center pt-2">
            <span className="text-[10px] text-slate-400 font-medium">BARRANQUILLA NODE - SECURE ACCESS ONLY</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
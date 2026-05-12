import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, LockKeyhole, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react'; // Asegúrate de tener framer-motion instalado

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Estados para el flujo de Cambio de Contraseña
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); 
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      // --- CAPTURAMOS LA BANDERA DE SEGURIDAD ---
      if (res.status === 403 && data.requiere_cambio) {
        setRequiresPasswordChange(true);
        setIsLoading(false);
        return; // Detenemos el flujo aquí
      }

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      } else {
        alert(data.error || "Error de validación: Verifique sus credenciales.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("Error de conexión con el servidor. Verifica que el backend esté corriendo.");
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      return alert("La contraseña debe tener al menos 6 caracteres.");
    }
    
    if (newPassword !== confirmPassword) {
      return alert("Las contraseñas nuevas no coinciden.");
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/change-password', { // <-- Asegúrate de tener esta ruta en tu backend
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email, 
          currentPassword: password, // Mandamos la genérica como comprobación de seguridad
          newPassword: newPassword 
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert("¡Contraseña actualizada con éxito! Por favor inicia sesión con tu nueva clave.");
        // Reseteamos el formulario y volvemos al login normal
        setRequiresPasswordChange(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data.error || "Error al actualizar la contraseña.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden relative">
        
        <AnimatePresence mode="wait">
          
          {/* --- PANTALLA 1: LOGIN NORMAL --- */}
          {!requiresPasswordChange ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <LayoutDashboard size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">TaskFlow Pro</h2>
              <p className="text-slate-500 text-center mb-8">Ingresa tus credenciales para continuar</p>
              
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="admin@taskflow.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contraseña</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" 
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
                
                <div className="text-center pt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Barranquilla Node - Secure Access Only
                  </span>
                </div>
              </form>
            </motion.div>
          ) : (
            
            /* --- PANTALLA 2: CAMBIO DE CONTRASEÑA OBLIGATORIO --- */
            <motion.div 
              key="change-password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <button 
                onClick={() => setRequiresPasswordChange(false)}
                className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition-colors"
                title="Volver"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="flex justify-center mb-6 mt-4">
                <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                  <LockKeyhole size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Seguridad</h2>
              <p className="text-slate-500 text-center mb-8 text-sm">Por políticas de seguridad, debes actualizar tu contraseña temporal antes de continuar.</p>
              
              <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-600 uppercase">Nueva Contraseña</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-600 uppercase">Confirma tu Contraseña</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                  />
                </div>
                
                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-all active:scale-[0.98] shadow-lg shadow-amber-200 disabled:opacity-50"
                  >
                    {isLoading ? 'Actualizando...' : 'Guardar y Entrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default Login;
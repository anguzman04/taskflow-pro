/* import { useState } from 'react';
import api from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/login', { email, password });
      localStorage.setItem('token', response.data.token); // Guardamos el token
      alert('¡Bienvenido a TaskFlow Pro!');
      // Aquí redirigirías al Dashboard
    } catch (error) {
      alert('Error: Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">TaskFlow Pro</h2>
        <input 
          type="email" 
          placeholder="Correo electrónico" 
          className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" 
          placeholder="Contraseña" 
          className="w-full p-2 mb-6 border rounded"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Entrar al Sistema
        </button>
      </form>
    </div>
  );
};

export default Login; */


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Llamada a tu backend (localhost:3000)
      const response = await api.post('/login', { email, password });
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard'); // Redirigir al entrar
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Credenciales inválidas'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-extrabold text-center text-blue-700 mb-2">TaskFlow Pro</h2>
        <p className="text-center text-gray-500 mb-8">IT Operations Portal</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuario</label>
            <input 
              type="email" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin@taskflow.com"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input 
              type="password" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
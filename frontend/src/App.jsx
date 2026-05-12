import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // <--- 1. IMPORTANTE: Importar el Dashboard

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* 2. REGISTRAR LA RUTA: Ahora el sistema sabrá a dónde ir */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Redirigir automáticamente al Login si la ruta no existe */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api'); // Importamos tu archivo api.js

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// --- CORRECCIÓN MAGISTRAL: CAMUFLAJE DE CARPETA ---
// Servimos la carpeta 'uploads' pero exigimos que la URL empiece con '/api/uploads'
// Esto engaña a IIS para que deje pasar la descarga del archivo sin romper React.
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// El espía de peticiones
app.use((req, res, next) => {
  console.log(`📡 Petición detectada: ${req.method} en la ruta ${req.url}`);
  next();
});

// ÚNICA CONEXIÓN DE RUTAS: Todo pasa por api.js
app.use('/api', apiRoutes);

// En tu index.js, cerca de donde inicias la app (app.listen)
const startCronJobs = require('./cronJobs'); // Asegúrate de la ruta correcta
startCronJobs();

app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Pro VIVO en http://localhost:${PORT}`);
});
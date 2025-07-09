// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './App.css';

import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import TareasPage from './pages/TareasPage';
import AvisosPage from './pages/AvisosPage';
import AnalistasPage from './pages/AnalistasPage';
import DetalleTareaPage from './pages/DetalleTareaPage';
import FormularioTareaPage from './pages/FormularioTareaPage';

// Importaciones para Campañas
import CampanasPage from './pages/CampanasPage'; // La página que lista campañas
import DetalleCampanaPage from './pages/DetalleCampanaPage'; // Para ver el detalle de una campaña
import FormularioCampanaPage from './pages/FormularioCampanaPage'; // Para crear y editar campañas

// Importaciones para Analistas (ya existentes)
import DetalleAnalistaPage from './pages/DetalleAnalistaPage';
import FormularioAnalistaPage from './pages/FormularioAnalistaPage';


function App() {
  return (
    <Router>
      <Navbar />
      <div className="App-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          
          {/* Rutas de Campañas - ¡El orden es crítico! */}
          {/* Las rutas más específicas (con "crear" o "editar") deben ir ANTES que las rutas genéricas con ":id" */}
          <Route path="/campanas/crear" element={<FormularioCampanaPage />} /> {/* Para crear una nueva campaña */}
          <Route path="/campanas/editar/:id" element={<FormularioCampanaPage />} /> {/* Para editar una campaña existente */}
          <Route path="/campanas/:id" element={<DetalleCampanaPage />} /> {/* Para ver el detalle de una campaña */}
          <Route path="/campanas" element={<CampanasPage />} /> {/* Lista general de campañas */}

          {/* Rutas de Tareas */}
          <Route path="/tareas/nueva" element={<FormularioTareaPage />} />
          <Route path="/tareas/editar/:id" element={<FormularioTareaPage />} />
          <Route path="/tareas/:id" element={<DetalleTareaPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          
          {/* Rutas de Avisos */}
          <Route path="/avisos" element={<AvisosPage />} />
          
          {/* Rutas de Analistas */}
          <Route path="/analistas/crear" element={<FormularioAnalistaPage />} />
          <Route path="/analistas/editar/:id" element={<FormularioAnalistaPage />} />
          <Route path="/analistas/:id" element={<DetalleAnalistaPage />} />
          <Route path="/analistas" element={<AnalistasPage />} />
          
          <Route path="/configuracion" element={<p>Página de Configuración</p>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

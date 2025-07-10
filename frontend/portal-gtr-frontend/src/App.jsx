// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './App.css';

import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';

// Importaciones de Analistas
import AnalistasPage from './pages/AnalistasPage';
import DetalleAnalistaPage from './pages/DetalleAnalistaPage';
import FormularioAnalistaPage from './pages/FormularioAnalistaPage';

// Importaciones de Campañas
import CampanasPage from './pages/CampanasPage';
import DetalleCampanaPage from './pages/DetalleCampanaPage';
import FormularioCampanaPage from './pages/FormularioCampanaPage';

// Importaciones de Tareas
import TareasPage from './pages/TareasPage';
import DetalleTareaPage from './pages/DetalleTareaPage';
import FormularioTareaPage from './pages/FormularioTareaPage';

// Importaciones de Checklist Items
import FormularioChecklistItemPage from './pages/FormularioChecklistItemPage';

// Importaciones de Avisos (¡NUEVAS!)
import AvisosPage from './pages/AvisosPage'; // La página que lista avisos
import DetalleAvisoPage from './pages/DetalleAvisoPage'; // Para ver el detalle de un aviso
import FormularioAvisoPage from './pages/FormularioAvisoPage'; // Para crear y editar avisos


function App() {
  return (
    <Router>
      <Navbar />
      <div className="App-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          
          {/* Rutas de Campañas */}
          <Route path="/campanas/crear" element={<FormularioCampanaPage />} />
          <Route path="/campanas/editar/:id" element={<FormularioCampanaPage />} />
          <Route path="/campanas/:id" element={<DetalleCampanaPage />} />
          <Route path="/campanas" element={<CampanasPage />} />

          {/* Rutas de Tareas */}
          <Route path="/tareas/nueva" element={<FormularioTareaPage />} />
          <Route path="/tareas/editar/:id" element={<FormularioTareaPage />} />
          <Route path="/tareas/:id" element={<DetalleTareaPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          
          {/* Rutas de Checklist Items */}
          <Route path="/tareas/:tareaId/checklist-items/crear" element={<FormularioChecklistItemPage />} />
          <Route path="/tareas/:tareaId/checklist-items/editar/:id" element={<FormularioChecklistItemPage />} />

          {/* RUTAS DE AVISOS - ¡El orden es crítico aquí! */}
          <Route path="/avisos/crear" element={<FormularioAvisoPage />} /> {/* Para crear un nuevo aviso */}
          <Route path="/avisos/editar/:id" element={<FormularioAvisoPage />} /> {/* Para editar un aviso existente */}
          <Route path="/avisos/:id" element={<DetalleAvisoPage />} /> {/* Para ver el detalle de un aviso */}
          <Route path="/avisos" element={<AvisosPage />} /> {/* Lista general de avisos */}
          
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

// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './App.css';

import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import CampanasPage from './pages/CampanasPage';
import TareasPage from './pages/TareasPage';
import AvisosPage from './pages/AvisosPage';
import AnalistasPage from './pages/AnalistasPage'; // La página que lista analistas
import DetalleTareaPage from './pages/DetalleTareaPage';
import FormularioTareaPage from './pages/FormularioTareaPage';

// ¡NUEVAS IMPORTACIONES PARA ANALISTAS!
import DetalleAnalistaPage from './pages/DetalleAnalistaPage'; // Para ver el detalle de un analista
import FormularioAnalistaPage from './pages/FormularioAnalistaPage'; // Para crear y editar analistas


function App() {
  return (
    <Router>
      <Navbar />
      <div className="App-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/campanas" element={<CampanasPage />} />

          {/* Rutas de Tareas */}
          <Route path="/tareas/nueva" element={<FormularioTareaPage />} /> {/* Para crear */}
          <Route path="/tareas/editar/:id" element={<FormularioTareaPage />} /> {/* Para editar */}
          <Route path="/tareas/:id" element={<DetalleTareaPage />} /> {/* Para ver detalle (general) */}
          <Route path="/tareas" element={<TareasPage />} /> {/* Esta es la lista general de tareas */}
          
          {/* ------------------------------------- */}

          <Route path="/avisos" element={<AvisosPage />} />
          
          {/* RUTAS DE ANALISTAS - ¡EL ORDEN ES CRÍTICO AQUÍ! */}
          {/* Las rutas más específicas (con "crear" o "editar") deben ir ANTES que las rutas genéricas con ":id" */}
          <Route path="/analistas/crear" element={<FormularioAnalistaPage />} /> {/* Para crear un nuevo analista */}
          <Route path="/analistas/editar/:id" element={<FormularioAnalistaPage />} /> {/* Para editar un analista existente */}
          <Route path="/analistas/:id" element={<DetalleAnalistaPage />} /> {/* Para ver el detalle de un analista */}
          <Route path="/analistas" element={<AnalistasPage />} /> {/* Lista general de analistas */}
          
          <Route path="/configuracion" element={<p>Página de Configuración</p>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

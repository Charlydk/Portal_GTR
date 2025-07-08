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
import AnalistasPage from './pages/AnalistasPage';
import DetalleTareaPage from './pages/DetalleTareaPage'; // <-- Importa la nueva página de detalle

function App() {
  return (
    <Router>
      <Navbar />
      <div className="App-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/campanas" element={<CampanasPage />} />
          <Route path="/tareas" element={<TareasPage />} /> {/* Esta es la lista general de tareas */}
          <Route path="/tareas/:id" element={<DetalleTareaPage />} /> {/* <-- Nueva ruta para el detalle */}
          {/* path="/tareas/:id" significa que :id es un parámetro que se puede leer con useParams() */}
          <Route path="/avisos" element={<AvisosPage />} />
          <Route path="/analistas" element={<AnalistasPage />} />
          <Route path="/configuracion" element={<p>Página de Configuración</p>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
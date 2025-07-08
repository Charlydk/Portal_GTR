// src/App.jsx

import React from 'react'; // Asegúrate de importar React
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './App.css'; // Mantenemos el CSS base de Vite

// Importamos nuestros componentes de navegación y de página
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import CampanasPage from './pages/CampanasPage';
import TareasPage from './pages/TareasPage';
import AvisosPage from './pages/AvisosPage';
import AnalistasPage from './pages/AnalistasPage'; // No te olvides de esta

function App() {
  return (
    <Router> {/* Envuelve toda tu aplicación en <Router> */}
      <Navbar /> {/* El Navbar siempre estará visible */}
      <div className="App-content"> {/* Un div para el contenido de la página */}
        <Routes> {/* <Routes> define las rutas disponibles */}
          <Route path="/" element={<HomePage />} /> {/* Ruta para la página de inicio */}
          <Route path="/campanas" element={<CampanasPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/avisos" element={<AvisosPage />} />
          <Route path="/analistas" element={<AnalistasPage />} />
          {/* Puedes añadir más rutas aquí para DetalleTarea, FormularioTarea, etc. más adelante */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
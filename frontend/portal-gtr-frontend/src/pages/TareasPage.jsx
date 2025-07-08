// src/pages/TareasPage.jsx
// Este archivo ahora será la "página" que contiene la lista Y el botón para crear.

import React from 'react';
import { Link } from 'react-router-dom'; // Necesitamos Link para el botón de crear
import ListaTareas from '../components/ListaTareas';

function TareasPage() {
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Gestión de Tareas</h2>
        <Link to="/tareas/nueva" className="btn btn-success">
          Crear Nueva Tarea
        </Link>
      </div>
      <ListaTareas /> {/* ListaTareas se muestra aquí */}
    </div>
  );
}

export default TareasPage;
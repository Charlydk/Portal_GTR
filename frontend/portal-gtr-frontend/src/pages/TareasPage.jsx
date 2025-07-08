import React from 'react';
import ListaTareas from '../components/ListaTareas'; // <-- Importa el componente

function TareasPage() {
  return (
    <div className="container mt-4">
      <h2>Gestión de Tareas</h2>
      <ListaTareas /> {/* <-- Renderiza el componente ListaTareas */}
    </div>
  );
}

export default TareasPage;
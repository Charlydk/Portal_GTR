// src/components/DetalleCampana.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function DetalleCampana({ campana }) {
  // Verificación básica por si la prop campana es nula
  if (!campana) {
    return <p className="container mt-4">No hay datos de campaña para mostrar.</p>;
  }

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  return (
    <div className="container mt-4">
      <h3>Detalles de la Campaña: {campana.nombre}</h3>
      <hr />
      <p><strong>ID:</strong> {campana.id}</p>
      <p><strong>Nombre:</strong> {campana.nombre}</p>
      <p><strong>Descripción:</strong> {campana.descripcion || 'N/A'}</p>
      <p><strong>Fecha de Inicio:</strong> {formatDateTime(campana.fecha_inicio)}</p>
      <p><strong>Fecha de Fin:</strong> {formatDateTime(campana.fecha_fin)}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(campana.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/campanas" className="btn btn-secondary me-2">Volver a la lista de Campañas</Link>
        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">Editar Campaña</Link>
      </div>
    </div>
  );
}

export default DetalleCampana;

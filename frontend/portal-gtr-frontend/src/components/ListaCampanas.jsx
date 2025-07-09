// src/components/ListaCampanas.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente ahora recibe solo 'campanas' como prop
function ListaCampanas({ campanas }) {
  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  return (
    <table className="table table-striped table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Descripción</th>
          <th>Fecha de Inicio</th>
          <th>Fecha de Fin</th>
          <th>Fecha de Creación</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {campanas.map((campana) => (
          <tr key={campana.id}>
            <td>{campana.id}</td>
            <td>{campana.nombre}</td>
            <td>{campana.descripcion || 'N/A'}</td>
            <td>{formatDateTime(campana.fecha_inicio)}</td>
            <td>{formatDateTime(campana.fecha_fin)}</td>
            <td>{formatDateTime(campana.fecha_creacion)}</td>
            <td>
              <Link to={`/campanas/${campana.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
              <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning btn-sm">Editar</Link>
              {/* NOTA: El botón de "Eliminar" ha sido ELIMINADO de este componente */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ListaCampanas;

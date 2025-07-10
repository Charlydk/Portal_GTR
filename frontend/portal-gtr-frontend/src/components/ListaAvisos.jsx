// src/components/ListaAvisos.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function ListaAvisos({ avisos, onDelete }) {
  // Auxiliary function to format dates
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
          <th>Título</th>
          <th>Contenido</th>
          <th>Fecha Vencimiento</th>
          <th>Creador</th>
          <th>Campaña</th>
          <th>Fecha Creación</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {avisos.map((aviso) => (
          <tr key={aviso.id}>
            <td>{aviso.id}</td>
            <td>{aviso.titulo}</td>
            <td>{aviso.contenido.substring(0, 50)}...</td>
            <td>{formatDateTime(aviso.fecha_vencimiento)}</td>
            <td>{aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : `ID: ${aviso.creador_id}`}</td>
            <td>{aviso.campana ? aviso.campana.nombre : 'N/A'}</td>
            <td>{formatDateTime(aviso.fecha_creacion)}</td>
            <td>
                <Link to={`/avisos/${aviso.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                <button
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(aviso.id)}
                >
                Eliminar
                </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ListaAvisos;

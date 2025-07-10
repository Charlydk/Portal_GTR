// src/components/ListaComentariosCampana.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function ListaComentariosCampana({ comentarios, onDeleteComentario }) {
  if (!comentarios || comentarios.length === 0) {
    return <p className="mt-3 text-muted">No hay comentarios para esta campaña.</p>;
  }

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  return (
    <div className="list-group">
      {comentarios.map((comentario) => (
        <div key={comentario.id} className="list-group-item list-group-item-action flex-column align-items-start">
          <div className="d-flex w-100 justify-content-between">
            {/* Aquí asumimos que el objeto 'analista' viene anidado en el comentario.
                Si no es así, necesitaríamos cargar el analista por su ID.
                Por ahora, usamos analista_id y puedes mostrar el nombre si lo cargas. */}
            <h5 className="mb-1">Comentario de Analista ID: {comentario.analista_id}</h5> 
            <small className="text-muted">{formatDateTime(comentario.fecha_creacion)}</small>
          </div>
          <p className="mb-1">{comentario.contenido}</p>
          <div className="d-flex justify-content-end">
            {/* Botón de eliminar comentario */}
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDeleteComentario(comentario.id)}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListaComentariosCampana;

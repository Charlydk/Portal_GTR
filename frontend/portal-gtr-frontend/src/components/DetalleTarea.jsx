// src/components/DetalleTarea.jsx

import React from 'react';

function DetalleTarea({ tarea }) { // Este componente recibirá una 'tarea' como prop
  if (!tarea) {
    return (
      <div className="container mt-4">
        <p className="text-center text-muted">Selecciona una tarea para ver sus detalles.</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">Detalle de la Tarea: {tarea.titulo}</h4>
        </div>
        <div className="card-body">
          <p><strong>Descripción:</strong> {tarea.descripcion}</p>
          <p><strong>Campaña:</strong> {tarea.campana_nombre}</p>
          <p><strong>Analista Asignado:</strong> {tarea.analista_nombre}</p>
          <p>
            <strong>Progreso:</strong>{' '}
            <span className={`badge ${
              tarea.progreso === 'PENDIENTE' ? 'text-bg-secondary' :
              tarea.progreso === 'EN_PROGRESO' ? 'text-bg-info' :
              tarea.progreso === 'COMPLETADA' ? 'text-bg-success' :
              tarea.progreso === 'BLOQUEADA' ? 'text-bg-danger' : 'text-bg-light'
            }`}>
              {tarea.progreso.replace('_', ' ')}
            </span>
          </p>
          <p><strong>Fecha de Vencimiento:</strong> {tarea.fecha_vencimiento || 'No especificada'}</p>

          <hr />

          <h5>Checklist de la Tarea:</h5>
          {tarea.checklist_items && tarea.checklist_items.length > 0 ? (
            <ul className="list-group">
              {tarea.checklist_items.map(item => (
                <li key={item.id} className={`list-group-item d-flex justify-content-between align-items-center ${item.completado ? 'list-group-item-success' : ''}`}>
                  {item.descripcion}
                  {item.completado ? (
                    <span className="badge bg-success">Completado</span>
                  ) : (
                    <span className="badge bg-warning text-dark">Pendiente</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No hay elementos en el checklist para esta tarea.</p>
          )}
        </div>
        <div className="card-footer text-end">
          <button className="btn btn-secondary me-2">Volver</button>
          <button className="btn btn-warning">Editar Tarea</button>
        </div>
      </div>
    </div>
  );
}

export default DetalleTarea;
// src/components/ListaChecklistItems.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente recibe los ítems de checklist y las funciones de manejo
function ListaChecklistItems({ checklistItems, onDeleteItem }) {
  if (!checklistItems || checklistItems.length === 0) {
    return <p className="mt-3 text-muted">No hay ítems de checklist para esta tarea.</p>;
  }

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  return (
    <div className="table-responsive">
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Completado</th>
            <th>Fecha Creación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {checklistItems.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.descripcion}</td>
              <td>{item.completado ? 'Sí' : 'No'}</td>
              <td>{formatDateTime(item.fecha_creacion)}</td>
              <td>
                {/* Link para editar el ítem de checklist */}
                <Link to={`/tareas/${item.tarea_id}/checklist-items/editar/${item.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                {/* Botón de eliminar (opcional, si lo implementas en el futuro) */}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDeleteItem(item.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaChecklistItems;

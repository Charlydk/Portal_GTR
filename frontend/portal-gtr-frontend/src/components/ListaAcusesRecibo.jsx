// src/components/ListaAcusesRecibo.jsx

import React from 'react';

function ListaAcusesRecibo({ acusesRecibo }) {
  if (!acusesRecibo || acusesRecibo.length === 0) {
    return <p className="mt-3 text-muted">No hay acuses de recibo para este aviso.</p>;
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
            <th>ID Acuse</th>
            <th>Analista</th>
            <th>Fecha de Acuse</th>
          </tr>
        </thead>
        <tbody>
          {acusesRecibo.map((acuse) => (
            <tr key={acuse.id}>
              <td>{acuse.id}</td>
              <td>{acuse.analista ? `${acuse.analista.nombre} ${acuse.analista.apellido}` : `ID: ${acuse.analista_id}`}</td>
              <td>{formatDateTime(acuse.fecha_acuse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaAcusesRecibo;

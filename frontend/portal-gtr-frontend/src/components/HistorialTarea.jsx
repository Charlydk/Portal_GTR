// src/components/HistorialTarea.jsx
import React from 'react';
import { ListGroup, Badge, Card, Alert, Spinner } from 'react-bootstrap';

const HistorialTarea = ({ historial, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="text-center">
        <Spinner animation="border" size="sm" />
        <p className="ms-2 d-inline">Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger" className="mt-3">Error al cargar el historial: {error}</Alert>;
  }

  if (!historial || historial.length === 0) {
    return <Alert variant="info" className="mt-3">No hay historial de cambios para esta tarea.</Alert>;
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleString('es-AR', options);
  };

  const getBadgeVariant = (progreso) => {
    switch (progreso) {
      case 'COMPLETADA': return 'success';
      case 'CANCELADA': return 'danger';
      case 'EN_PROGRESO': return 'primary';
      case 'PENDIENTE': return 'secondary';
      default: return 'light';
    }
  };

  return (
    <Card className="mt-4 shadow-sm">
      <Card.Header as="h5">Historial de Cambios de Estado</Card.Header>
      <ListGroup variant="flush">
        {historial.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((item) => (
          <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center flex-wrap">
            <div>
              La tarea pasó a <Badge bg={getBadgeVariant(item.new_progreso)}>{item.new_progreso.replace('_', ' ')}</Badge>
              <br />
              <small className="text-muted">
                Cambiado por: {item.changed_by_analista.nombre} {item.changed_by_analista.apellido}
              </small>
            </div>
            <span className="text-muted">{formatDateTime(item.timestamp)}</span>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Card>
  );
};

export default HistorialTarea;
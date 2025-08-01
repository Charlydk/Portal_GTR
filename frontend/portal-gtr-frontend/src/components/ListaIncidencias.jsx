// src/components/ListaIncidencias.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ListGroup, Badge, Button, Card } from 'react-bootstrap';

// Este componente recibe las incidencias directamente de su página padre
const ListaIncidencias = ({ incidencias, campanaId }) => {

  // Función para dar un color diferente a cada estado de la incidencia
  const getStatusVariant = (estado) => {
    switch (estado) {
      case 'ABIERTA':
        return 'danger';
      case 'EN PROGRESO':
        return 'warning';
      case 'CERRADA':
        return 'success';
      default:
        return 'secondary';
    }
  };

  // Formatea la fecha para que sea más legible
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Historial de Incidencias</span>
        <Link to={`/incidencias/crear?campanaId=${campanaId}`}>
          <Button variant="primary" size="sm">Registrar Nueva Incidencia</Button>
        </Link>
      </Card.Header>
      <Card.Body>
        {(!incidencias || incidencias.length === 0) ? (
          <p className="text-muted">No hay incidencias registradas para esta campaña.</p>
        ) : (
          <ListGroup variant="flush">
            {incidencias.map((incidencia) => (
              <ListGroup.Item 
                key={incidencia.id} 
                as={Link} 
                to={`/incidencias/${incidencia.id}`} 
                action 
                className="d-flex justify-content-between align-items-start"
              >
                <div className="ms-2 me-auto">
                  <div className="fw-bold">{incidencia.titulo}</div>
                  <small className="text-muted">Abierta el: {formatDateTime(incidencia.fecha_apertura)}</small>
                </div>
                <Badge bg={getStatusVariant(incidencia.estado)} pill>
                  {incidencia.estado}
                </Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default ListaIncidencias;

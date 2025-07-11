// src/pages/DetalleAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Card, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

function DetalleAvisoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authToken, user } = useAuth();

  const [aviso, setAviso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);

  const fetchAviso = useCallback(async () => {
    if (!authToken || !id) return;

    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar aviso: ${response.statusText}`);
      }
      const data = await response.json();
      setAviso(data);
    } catch (err) {
      console.error("Error fetching aviso:", err);
      setError(err.message || "No se pudo cargar el detalle del aviso.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]);

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      setError("No autenticado. Por favor, inicie sesión.");
      return;
    }
    fetchAviso();
  }, [authToken, fetchAviso]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    setDeleteMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al eliminar aviso: ${response.statusText}`);
      }

      setDeleteMessage("Aviso eliminado exitosamente.");
      setTimeout(() => {
        navigate('/avisos'); // Redirigir a la lista después de eliminar
      }, 1500);

    } catch (err) {
      console.error("Error deleting aviso:", err);
      setError(err.message || "No se pudo eliminar el aviso.");
      setLoading(false);
    }
  };

  const handleAcuseRecibo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}/acuse_recibo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ analista_id: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al registrar acuse de recibo: ${response.statusText}`);
      }

      setAviso(prev => ({
        ...prev,
        acuses_recibo: [...(prev.acuses_recibo || []), { analista: { id: user.id, nombre: user.nombre, apellido: user.apellido }, fecha_acuse: new Date().toISOString() }]
      }));
      alert("Acuse de recibo registrado exitosamente."); // Usar un modal personalizado en lugar de alert en producción
    } catch (err) {
      console.error("Error registering acuse de recibo:", err);
      setError(err.message || "No se pudo registrar el acuse de recibo.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando detalle del aviso...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>¡Error!</Alert.Heading>
          <p>{error}</p>
          <Button variant="primary" onClick={() => navigate('/avisos')}>Volver a Avisos</Button>
        </Alert>
      </Container>
    );
  }

  if (!aviso) {
    return (
      <Container className="mt-4">
        <Alert variant="info">
          <Alert.Heading>Aviso no encontrado</Alert.Heading>
          <p>El aviso que intentas ver no existe o no tienes permiso para acceder a él.</p>
          <Button variant="primary" onClick={() => navigate('/avisos')}>Volver a Avisos</Button>
        </Alert>
      </Container>
    );
  }

  const canEdit = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
  const canDelete = user && user.role === 'SUPERVISOR';
  const hasAcknowledged = user && aviso.acuses_recibo.some(ar => ar.analista.id === user.id);

  return (
    <Container className="py-5">
      <Card className="shadow-sm">
        <Card.Header as="h2" className="bg-info text-white text-center">
          Detalle del Aviso
        </Card.Header>
        <Card.Body>
          {deleteMessage && <Alert variant="success">{deleteMessage}</Alert>}
          
          <p><strong>Título:</strong> {aviso.titulo}</p>
          <p><strong>Contenido:</strong> {aviso.contenido}</p>
          <p><strong>Fecha de Creación:</strong> {new Date(aviso.fecha_creacion).toLocaleString()}</p>
          <p>
            <strong>Fecha de Vencimiento:</strong>{' '}
            {aviso.fecha_vencimiento ? new Date(aviso.fecha_vencimiento).toLocaleString() : 'N/A'}
          </p>
          <p>
            <strong>Creador:</strong>{' '}
            {aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : 'N/A'}
          </p>
          <p>
            <strong>Campaña Asociada:</strong>{' '}
            {aviso.campana ? <Link to={`/campanas/${aviso.campana.id}`}>{aviso.campana.nombre}</Link> : 'N/A'}
          </p>

          <h5 className="mt-4">Acuses de Recibo:</h5>
          {aviso.acuses_recibo && aviso.acuses_recibo.length > 0 ? (
            <ListGroup>
              {aviso.acuses_recibo.map(acuse => (
                <ListGroup.Item key={acuse.id}>
                  {acuse.analista ? `${acuse.analista.nombre} ${acuse.analista.apellido}` : 'Analista Desconocido'} -{' '}
                  {new Date(acuse.fecha_acuse).toLocaleString()}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="text-muted fst-italic">No hay acuses de recibo para este aviso.</p>
          )}

          <div className="d-flex justify-content-between mt-4">
            <Button variant="secondary" onClick={() => navigate('/avisos')}>
              Volver a la Lista
            </Button>

            <div>
              {user && user.role === 'ANALISTA' && !hasAcknowledged && (
                <Button variant="info" onClick={handleAcuseRecibo} className="me-2" disabled={loading}>
                  Registrar Acuse de Recibo
                </Button>
              )}
              {user && user.role === 'ANALISTA' && hasAcknowledged && (
                <Button variant="outline-info" disabled>
                  Acuse de Recibo Registrado
                </Button>
              )}
              
              {canEdit && (
                <Button variant="warning" onClick={() => navigate(`/avisos/editar/${aviso.id}`)} className="me-2">
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  Eliminar
                </Button>
              )}
            </div>
          </div>

          {showDeleteConfirm && (
            <Alert variant="danger" className="mt-3">
              <Alert.Heading>Confirmar Eliminación</Alert.Heading>
              <p>¿Estás seguro de que quieres eliminar este aviso? Esta acción es irreversible.</p>
              <Button variant="danger" onClick={handleDelete} className="me-2" disabled={loading}>
                Sí, Eliminar
              </Button>
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>
                Cancelar
              </Button>
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default DetalleAvisoPage;

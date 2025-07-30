// src/components/BitacoraCampana.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Form, Button, Alert, Spinner, Table, Badge, Row, Col } from 'react-bootstrap';
import RegistroIncidenciaForm from './RegistroIncidenciaForm';

const BitacoraCampana = ({ campanaId, campanaNombre }) => {
  const { user, authToken, loading: authLoading } = useAuth();
  const [bitacoraEntries, setBitacoraEntries] = useState([]);
  
  // Estados separados para el comentario
  const [displayedComment, setDisplayedComment] = useState(''); // Para MOSTRAR el comentario guardado
  const [commentInput, setCommentInput] = useState(''); // Para CONTROLAR el <textarea>
  
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryComment, setNewEntryComment] = useState('');
  const [newEntryHour, setNewEntryHour] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const generarOpcionesHorario = () => {
    const opciones = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hora = String(h).padStart(2, '0');
        const minuto = String(m).padStart(2, '0');
        opciones.push(`${hora}:${minuto}`);
      }
    }
    return opciones;
  };

  const canManageGeneralComment = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE' || user.role === 'ANALISTA');

  const fetchBitacoraEntries = useCallback(async () => {
    if (!authToken || !campanaId || !currentDate) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora?fecha=${currentDate}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar entradas de bitácora: ${response.statusText}`);
      }
      const data = await response.json();
      setBitacoraEntries(data);
    } catch (err) {
      console.error("Error fetching bitacora entries:", err);
      setError(err.message || "No se pudieron cargar las entradas de bitácora.");
    }
  }, [authToken, campanaId, currentDate]);

  const fetchGeneralComment = useCallback(async () => {
    if (!authToken || !campanaId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora_general_comment`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const savedComment = data ? data.comentario || '' : '';
        setDisplayedComment(savedComment);
        setCommentInput(savedComment);
      } else if (response.status !== 404) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "No se pudo cargar el comentario general.");
      }
    } catch (err) {
      console.error("Error fetching general comment:", err);
      setError(err.message);
    }
  }, [authToken, campanaId]);

  useEffect(() => {
    if (!authLoading && user && campanaId) {
      setLoading(true);
      Promise.all([fetchBitacoraEntries(), fetchGeneralComment()]).finally(() => setLoading(false));
    }
  }, [authLoading, user, campanaId, fetchBitacoraEntries, fetchGeneralComment]);

  const handleNewEntrySubmit = async (e) => {
    e.preventDefault();
    setSubmittingEntry(true);
    setError(null);
    setSuccess(null);
    const newEntry = {
      campana_id: campanaId,
      fecha: currentDate,
      hora: newEntryHour,
      comentario: newEntryComment,
      es_incidencia: false,
    };
    try {
      const response = await fetch(`${API_BASE_URL}/bitacora_entries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(newEntry),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al añadir entrada.`);
      }
      setSuccess('Observación añadida con éxito!');
      setNewEntryComment('');
      setNewEntryHour('');
      fetchBitacoraEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingEntry(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    }
  };

  const handleGeneralCommentSubmit = async (e) => {
    e.preventDefault();
    setSubmittingComment(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora_general_comment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ comentario: commentInput }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al actualizar comentario.`);
      }
      setSuccess('Comentario general actualizado con éxito!');
      fetchGeneralComment(); 
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingComment(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    }
  };

  const handleIncidenciaSuccess = () => {
    setSuccess('Incidencia registrada con éxito!');
    fetchBitacoraEntries();
    setTimeout(() => { setSuccess(null); }, 5000);
  };

  const handleIncidenciaError = (err) => {
    setError(err.message);
    setTimeout(() => { setError(null); }, 5000);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-secondary">Bitácora Diaria de Campaña: {campanaNombre}</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="shadow-sm p-3 mb-4">
        <Form.Group as={Row} className="align-items-center">
          <Form.Label column sm={3}>Seleccionar Fecha:</Form.Label>
          <Col sm={9}>
            <Form.Control type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} />
          </Col>
        </Form.Group>
      </Card>

      {displayedComment && (
        <Card className="mb-4 bg-light shadow-sm">
            <Card.Header as="h5">Comentario General del Día</Card.Header>
            <Card.Body>
                <blockquote className="blockquote mb-0">
                    <p>{displayedComment}</p>
                </blockquote>
            </Card.Body>
        </Card>
      )}

      {canManageGeneralComment && (
        <Card className="shadow-sm p-4 mb-4">
          <h4 className="mb-4 text-primary">Comentario General de la Bitácora</h4>
          <Form onSubmit={handleGeneralCommentSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="generalComment">Editar Comentario:</Form.Label>
              <Form.Control as="textarea" id="generalComment" rows={3} value={commentInput} onChange={(e) => setCommentInput(e.target.value)} disabled={submittingComment} />
            </Form.Group>
            <Button type="submit" variant="info" disabled={submittingComment}>
              {submittingComment ? <Spinner as="span" animation="border" size="sm" /> : 'Guardar Comentario General'}
            </Button>
          </Form>
        </Card>
      )}

      <Card className="shadow-sm p-4 mb-4">
        <h4 className="mb-4 text-primary">Registrar Observaciones de franja</h4>
        <Form onSubmit={handleNewEntrySubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryHour">Hora:</Form.Label>
            <Form.Select id="newEntryHour" value={newEntryHour} onChange={(e) => setNewEntryHour(e.target.value)} required disabled={submittingEntry}>
              <option value="">Selecciona una hora</option>
              {generarOpcionesHorario().map((hora) => (<option key={hora} value={hora}>{hora}</option>))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryComment">Comentario de la Observación:</Form.Label>
            <Form.Control as="textarea" id="newEntryComment" rows={3} value={newEntryComment} onChange={(e) => setNewEntryComment(e.target.value)} required disabled={submittingEntry} />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100 mt-3" disabled={submittingEntry}>
            {submittingEntry ? <Spinner as="span" animation="border" size="sm" /> : 'Añadir Observación'}
          </Button>
        </Form>
      </Card>

      {user && (
        <RegistroIncidenciaForm campanaId={campanaId} onSuccess={handleIncidenciaSuccess} onError={handleIncidenciaError} />
      )}

      <Card className="shadow-sm p-4">
        <h4 className="mb-4 text-secondary">Entradas de Bitácora para {currentDate}</h4>
        {bitacoraEntries.length === 0 ? (
          <Alert variant="info">No hay entradas de bitácora para esta fecha.</Alert>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Comentario</th>
                <th>Comentario Incidencia</th>
              </tr>
            </thead>
            <tbody>
              {bitacoraEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.hora}</td>
                  <td>
                    {entry.es_incidencia ? (<Badge bg="danger">{entry.tipo_incidencia || 'Incidencia'}</Badge>) : (<Badge bg="primary">Observación</Badge>)}
                  </td>
                  <td>{entry.comentario || 'N/A'}</td>
                  <td>{entry.comentario_incidencia || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default BitacoraCampana;

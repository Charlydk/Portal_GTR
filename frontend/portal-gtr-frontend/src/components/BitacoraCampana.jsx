// src/components/BitacoraCampana.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Form, Button, Alert, Spinner, Table, Badge, Row, Col } from 'react-bootstrap';
import RegistroIncidenciaForm from './RegistroIncidenciaForm'; // Importa el nuevo componente de formulario

const BitacoraCampana = ({ campanaId, campanaNombre }) => {
  const { user, authToken, loading: authLoading } = useAuth();
  const [bitacoraEntries, setBitacoraEntries] = useState([]);
  const [generalComment, setGeneralComment] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]); // Fecha actual en YYYY-MM-DD
  const [newEntryComment, setNewEntryComment] = useState('');
  const [newEntryHour, setNewEntryHour] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Generar opciones de horario cada 30 minutos
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

  const isSupervisorOrResponsable = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

  // Fetch Bitacora Entries for the selected date
  const fetchBitacoraEntries = useCallback(async () => {
    if (!authToken || !campanaId || !currentDate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  }, [authToken, campanaId, currentDate]);

  // Fetch General Comment
  const fetchGeneralComment = useCallback(async () => {
    if (!authToken || !campanaId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora_general_comment`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // ¡CORRECCIÓN AQUÍ! Verificar si data no es null antes de acceder a .comentario
        if (data) { 
          setGeneralComment(data.comentario || '');
        } else {
          setGeneralComment(''); // Si data es null (no hay comentario), establecerlo como cadena vacía
        }
      } else if (response.status === 404) {
        setGeneralComment(''); // No hay comentario general aún
      } else {
        const errorData = await response.json();
        console.error("Error fetching general comment:", errorData.detail || response.statusText);
        setError(errorData.detail || "No se pudo cargar el comentario general.");
      }
    } catch (err) {
      console.error("Error fetching general comment:", err);
      setError(err.message || "No se pudo cargar el comentario general.");
    }
  }, [authToken, campanaId]);

  useEffect(() => {
    if (!authLoading && user && campanaId) {
      fetchBitacoraEntries();
      fetchGeneralComment();
    }
  }, [authLoading, user, campanaId, fetchBitacoraEntries, fetchGeneralComment]);

  // Handle new bitacora entry submission
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
      es_incidencia: false, // Por defecto, no es una incidencia desde este formulario
      tipo_incidencia: null,
      comentario_incidencia: null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/bitacora_entries/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al añadir entrada de bitácora: ${response.statusText}`);
      }

      setSuccess('Entrada de bitácora añadida con éxito!');
      setNewEntryComment('');
      setNewEntryHour('');
      fetchBitacoraEntries(); // Refresh entries
    } catch (err) {
      console.error('Error adding bitacora entry:', err);
      setError(err.message || 'Hubo un error al añadir la entrada de bitácora.');
    } finally {
      setSubmittingEntry(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    }
  };

  // Handle general comment update
  const handleGeneralCommentSubmit = async (e) => {
    e.preventDefault();
    setSubmittingComment(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora_general_comment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ comentario: generalComment }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al actualizar comentario general: ${response.statusText}`);
      }

      setSuccess('Comentario general actualizado con éxito!');
      fetchGeneralComment(); // Refresh comment
    } catch (err) {
      console.error('Error updating general comment:', err);
      setError(err.message || 'Hubo un error al actualizar el comentario general.');
    } finally {
      setSubmittingComment(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    }
  };

  // Callback para cuando se registra una incidencia desde el formulario
  const handleIncidenciaSuccess = (data) => {
    setSuccess('Incidencia registrada con éxito en la bitácora!');
    fetchBitacoraEntries(); // Refrescar las entradas de bitácora para incluir la nueva incidencia
    setTimeout(() => { setSuccess(null); }, 5000);
  };

  const handleIncidenciaError = (err) => {
    setError(err.message || 'Hubo un error al registrar la incidencia.');
    setTimeout(() => { setError(null); }, 5000);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando bitácora...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-secondary">Bitácora Diaria de Campaña: {campanaNombre}</h3>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Selector de Fecha */}
      <Card className="shadow-sm p-3 mb-4">
        <Form.Group as={Row} className="align-items-center">
          <Form.Label column sm="3">Seleccionar Fecha:</Form.Label>
          <Col sm="9">
            <Form.Control
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
            />
          </Col>
        </Form.Group>
      </Card>

      {/* Formulario para Comentario General (Solo para Supervisor/Responsable) */}
      {isSupervisorOrResponsable && (
        <Card className="shadow-sm p-4 mb-4">
          <h4 className="mb-4 text-primary">Comentario General de la Bitácora</h4>
          <Form onSubmit={handleGeneralCommentSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="generalComment">Comentario General:</Form.Label>
              <Form.Control
                as="textarea"
                id="generalComment"
                rows="3"
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                disabled={submittingComment}
              />
            </Form.Group>
            <Button
              type="submit"
              variant="info"
              disabled={submittingComment}
            >
              {submittingComment ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Guardar Comentario General'}
            </Button>
          </Form>
        </Card>
      )}

      {/* Formulario para Registrar Nueva Entrada de Bitácora (no incidencia) */}
      <Card className="shadow-sm p-4 mb-4">
        <h4 className="mb-4 text-primary">Añadir Nueva Entrada a la Bitácora</h4>
        <Form onSubmit={handleNewEntrySubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryHour">Hora:</Form.Label>
            <Form.Select
              id="newEntryHour"
              value={newEntryHour}
              onChange={(e) => setNewEntryHour(e.target.value)}
              required
              disabled={submittingEntry}
            >
              <option value="">Selecciona una hora</option>
              {generarOpcionesHorario().map((hora) => (
                <option key={hora} value={hora}>{hora}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryComment">Comentario de la Entrada:</Form.Label>
            <Form.Control
              as="textarea"
              id="newEntryComment"
              rows="3"
              value={newEntryComment}
              onChange={(e) => setNewEntryComment(e.target.value)}
              required
              disabled={submittingEntry}
            />
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100 mt-3"
            disabled={submittingEntry}
          >
            {submittingEntry ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Añadir Entrada'}
          </Button>
        </Form>
      </Card>

      {/* Formulario para Registrar Incidencia (usando el nuevo componente) */}
      {/* Solo mostramos el formulario de incidencia si el usuario tiene permisos */}
      {user && (user.role === 'ANALISTA' || isSupervisorOrResponsable) && (
        <RegistroIncidenciaForm
          campanaId={campanaId}
          onSuccess={handleIncidenciaSuccess}
          onError={handleIncidenciaError}
        />
      )}

      {/* Tabla de Entradas de Bitácora */}
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
                <th>Fecha Creación</th>
              </tr>
            </thead>
            <tbody>
              {bitacoraEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.hora}</td>
                  <td>
                    {entry.es_incidencia ? (
                      <Badge bg="danger">{entry.tipo_incidencia || 'Incidencia'}</Badge>
                    ) : (
                      <Badge bg="primary">Normal</Badge>
                    )}
                  </td>
                  <td>{entry.comentario || 'N/A'}</td>
                  <td>{entry.comentario_incidencia || 'N/A'}</td>
                  <td>{new Date(entry.fecha_creacion).toLocaleTimeString()}</td>
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

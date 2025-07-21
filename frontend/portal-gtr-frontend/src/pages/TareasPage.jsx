// src/pages/TareasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

function TareasPage() {
  const { user, authToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [submittingTaskId, setSubmittingTaskId] = useState(null); // Para deshabilitar el botón mientras se actualiza

  const fetchAllTasks = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let campaignTasks = [];
      let generatedTasks = [];

      // Fetch Campaign Tasks (filtered by user role)
      let campaignTasksUrl = `${API_BASE_URL}/tareas/`;
      if (user.role === 'ANALISTA') {
        campaignTasksUrl += `?analista_id=${user.id}`;
      }
      const campaignTasksResponse = await fetch(campaignTasksUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!campaignTasksResponse.ok) {
        const errorData = await campaignTasksResponse.json();
        throw new Error(errorData.detail || `Error al cargar tareas de campaña: ${campaignTasksResponse.statusText}`);
      }
      campaignTasks = await campaignTasksResponse.json();
      // Add a 'type' property to distinguish campaign tasks
      campaignTasks = campaignTasks.map(task => ({ ...task, type: 'campaign' }));

      // Fetch Generated Tasks (always filtered by current user for ANALISTA)
      let generatedTasksUrl = `${API_BASE_URL}/tareas_generadas_por_avisos/`;
      if (user.role === 'ANALISTA') {
        generatedTasksUrl += `?analista_id=${user.id}`;
      }
      const generatedTasksResponse = await fetch(generatedTasksUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!generatedTasksResponse.ok) {
        const errorData = await generatedTasksResponse.json();
        throw new Error(errorData.detail || `Error al cargar tareas generadas por avisos: ${generatedTasksResponse.statusText}`);
      }
      generatedTasks = await generatedTasksResponse.json();
      // Add a 'type' property to distinguish generated tasks
      generatedTasks = generatedTasks.map(task => ({ ...task, type: 'generated' }));

      // Combine and sort all tasks by creation date (newest first)
      const combinedTasks = [...campaignTasks, ...generatedTasks].sort((a, b) => {
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      });

      setAllTasks(combinedTasks);

    } catch (err) {
      console.error("Error fetching all tasks:", err);
      setError(err.message || "No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, [authToken, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchAllTasks();
    }
  }, [authLoading, user, fetchAllTasks]);

  const handleMarcarCompletada = async (taskId, taskType) => {
    if (!authToken || !user) {
      setError("Necesita iniciar sesión para realizar esta acción.");
      return;
    }
    setSubmittingTaskId(taskId); // Set the ID of the task being submitted
    setError(null);
    setSuccessMessage(null);

    try {
      const url = taskType === 'generated' 
        ? `${API_BASE_URL}/tareas_generadas_por_avisos/${taskId}`
        : `${API_BASE_URL}/tareas/${taskId}`; // Fallback, though campaign tasks are managed differently

      const payload = { progreso: 'COMPLETADA' };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al marcar como completada: ${response.statusText}`);
      }

      setSuccessMessage(`Tarea ${taskId} marcada como COMPLETADA con éxito!`);
      fetchAllTasks(); // Recargar todas las tareas para reflejar el cambio
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error al marcar tarea como completada:", err);
      setError(err.message || "No se pudo marcar la tarea como completada.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmittingTaskId(null); // Clear the submitting task ID
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando Tareas...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando todas las tareas...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error al cargar las Tareas</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => navigate('/dashboard')}>Volver al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  // Ahora, cualquier rol que pueda crear tareas (Analista, Supervisor, Responsable)
  const canCreateTask = user && (user.role === 'ANALISTA' || user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

  return (
    <Container className="py-5">
      <h1 className="mb-4 text-center text-primary">Mis Tareas</h1>
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {canCreateTask && ( // Mostrar el botón si el usuario puede crear tareas
        <div className="d-flex justify-content-end mb-3">
          <Button variant="primary" onClick={() => navigate('/tareas/crear')}>
            Crear Nueva Tarea
          </Button>
        </div>
      )}

      {allTasks.length > 0 ? (
        <ListGroup variant="flush">
          {allTasks.map(tarea => {
            // Determinar si el usuario actual puede editar esta tarea específica
            const canEditThisTask = user && (
              user.role === 'SUPERVISOR' ||
              user.role === 'RESPONSABLE' ||
              (user.role === 'ANALISTA' && (tarea.analista_id === user.id || tarea.analista_asignado?.id === user.id))
            );

            return (
              <ListGroup.Item key={`${tarea.type}-${tarea.id}`} className="d-flex justify-content-between align-items-center mb-2 shadow-sm rounded">
                <div>
                  <h5>
                    {tarea.titulo}
                    <Badge bg={tarea.type === 'campaign' ? 'primary' : 'info'} className="ms-2">
                      {tarea.type === 'campaign' ? 'Campaña' : 'Aviso'}
                    </Badge>
                  </h5>
                  <p className="mb-1 text-muted">{tarea.descripcion}</p>
                  <small>
                    Asignado a: {tarea.analista?.nombre || tarea.analista_asignado?.nombre} {tarea.analista?.apellido || tarea.analista_asignado?.apellido}
                    {tarea.campana && ` | Campaña: ${tarea.campana.nombre}`}
                  </small>
                  <br/>
                  <small>
                    Estado: <Badge bg={tarea.progreso === 'PENDIENTE' ? 'danger' : 'success'}>{tarea.progreso}</Badge>
                    {tarea.fecha_vencimiento && (
                      <span className="ms-2 text-danger">Vence: {formatDateTime(tarea.fecha_vencimiento)}</span>
                    )}
                  </small>
                </div>
                <div className="d-flex flex-column align-items-end">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => navigate(tarea.type === 'campaign' ? `/tareas/${tarea.id}` : `/tareas-generadas/${tarea.id}`)}
                    className="mb-2"
                  >
                    Ver Detalles
                  </Button>
                  {canEditThisTask && ( // Mostrar el botón de editar si tiene permisos
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => navigate(tarea.type === 'campaign' ? `/tareas/editar/${tarea.id}` : `/tareas-generadas/editar/${tarea.id}`)}
                      className="mb-2"
                    >
                      Editar
                    </Button>
                  )}
                  {tarea.type === 'generated' && tarea.progreso === 'PENDIENTE' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleMarcarCompletada(tarea.id, tarea.type)}
                      disabled={submittingTaskId === tarea.id}
                    >
                      {submittingTaskId === tarea.id ? (
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                      ) : (
                        'Marcar Completada'
                      )}
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      ) : (
        <Alert variant="info">No tienes tareas asignadas en este momento.</Alert>
      )}
    </Container>
  );
}

export default TareasPage;

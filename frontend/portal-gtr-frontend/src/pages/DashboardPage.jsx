// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ListGroup, Spinner, Alert } from 'react-bootstrap';

function DashboardPage() {
  const { user, authToken, loading: authLoading } = useAuth(); // Obtiene la información del usuario y el token
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Función para cargar las tareas del usuario
  const fetchData = useCallback(async () => {
    if (!user || !authToken) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setError(null);

    try {
      // 1. Obtener tareas del usuario actual
      // El endpoint /tareas/ ya filtra por analista_id en el backend si el rol es ANALISTA
      const tasksResponse = await fetch(`${API_BASE_URL}/tareas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!tasksResponse.ok) {
        throw new Error(`Error al cargar tareas: ${tasksResponse.statusText}`);
      }
      const tasksData = await tasksResponse.json();
      setTasks(tasksData);

    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
      setError(err.message || "No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoadingData(false);
    }
  }, [user, authToken]);

  useEffect(() => {
    if (!authLoading && user) { // Solo si la autenticación ha terminado y hay un usuario
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  if (authLoading || loadingData) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos del dashboard...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-danger-subtle">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>¡Error!</Alert.Heading>
          <p>{error}</p>
        </Alert>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <p className="text-muted">Por favor, <Link to="/login">inicie sesión</Link> para ver su dashboard.</p>
      </Container>
    );
  }

  // Filtrar tareas según las campañas asignadas al analista
  const assignedCampaignIds = user.campanas_asignadas ? user.campanas_asignadas.map(c => c.id) : [];
  const relevantTasks = user.role === 'ANALISTA'
    ? tasks.filter(task => assignedCampaignIds.includes(task.campana_id))
    : tasks; // Supervisores/Responsables ven todas las tareas

  const pendingTasks = relevantTasks.filter(task => task.progreso !== 'COMPLETADA');
  const completedTasks = relevantTasks.filter(task => task.progreso === 'COMPLETADA');

  return (
    <Container className="py-5">
      <h2 className="text-center mb-4 text-primary">Dashboard de {user.nombre} {user.apellido} ({user.role})</h2>

      <Row className="mb-4">
        <Col md={12} className="text-center">
          <Link
            to="/incidencias/registrar"
            className="btn btn-lg btn-primary shadow-sm" // Estilo Bootstrap para un botón grande y azul
            style={{ padding: '15px 30px', fontSize: '1.2rem' }} // Estilos inline para ajuste fino
          >
            <i className="bi bi-pencil-square me-2"></i> {/* Opcional: Ícono de Bootstrap Icons si los tienes configurados */}
            Registrar Nueva Incidencia
          </Link>
        </Col>
      </Row>

      {user.role === 'ANALISTA' && (
        <Row>
          <Col md={12} className="mb-4">
            <Card className="shadow-sm border-info">
              <Card.Header as="h4" className="bg-info text-white">Campañas Asignadas a Mí ({user.campanas_asignadas?.length || 0})</Card.Header>
              <Card.Body>
                {user.campanas_asignadas && user.campanas_asignadas.length > 0 ? (
                  <ListGroup variant="flush">
                    {user.campanas_asignadas.map(campaign => (
                      <ListGroup.Item key={campaign.id}>
                        <Link to={`/campanas/${campaign.id}`} className="text-decoration-none text-dark">
                          <strong>{campaign.nombre}</strong>: {campaign.descripcion || 'Sin descripción.'}
                        </Link>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <p className="text-muted fst-italic">No tienes campañas asignadas directamente. Puedes asignarte en la sección de gestión de campañas.</p>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} className="mb-4">
            <Card className="shadow-sm border-warning">
              <Card.Header as="h4" className="bg-warning text-white">Tareas Pendientes en mis Campañas ({pendingTasks.length})</Card.Header>
              <ListGroup variant="flush">
                {pendingTasks.length > 0 ? (
                  pendingTasks.map(task => (
                    <ListGroup.Item key={task.id} className="d-flex justify-content-between align-items-center">
                      <Link to={`/tareas/${task.id}`} className="text-decoration-none text-dark">
                        {task.titulo} - Campaña: {user.campanas_asignadas.find(c => c.id === task.campana_id)?.nombre || 'N/A'}
                      </Link>
                      <span className={`badge bg-${task.progreso === 'PENDIENTE' ? 'secondary' : 'info'}`}>
                        {task.progreso}
                      </span>
                    </ListGroup.Item>
                  ))
                ) : (
                  <ListGroup.Item className="text-muted fst-italic">No tienes tareas pendientes en tus campañas asignadas. ¡Excelente!</ListGroup.Item>
                )}
              </ListGroup>
            </Card>
          </Col>

          <Col md={6} className="mb-4">
            <Card className="shadow-sm border-success">
              <Card.Header as="h4" className="bg-success text-white">Tareas Completadas en mis Campañas ({completedTasks.length})</Card.Header>
              <ListGroup variant="flush">
                {completedTasks.length > 0 ? (
                  completedTasks.map(task => (
                    <ListGroup.Item key={task.id} className="d-flex justify-content-between align-items-center">
                      <Link to={`/tareas/${task.id}`} className="text-decoration-none text-dark">
                        {task.titulo} - Campaña: {user.campanas_asignadas.find(c => c.id === task.campana_id)?.nombre || 'N/A'}
                      </Link>
                      <span className="badge bg-success">COMPLETADA</span>
                    </ListGroup.Item>
                  ))
                ) : (
                  <ListGroup.Item className="text-muted fst-italic">No has completado ninguna tarea en tus campañas asignadas aún.</ListGroup.Item>
                )}
              </ListGroup>
            </Card>
          </Col>
        </Row>
      )}

      {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Row>
          <Col md={12} className="mb-4">
            <Card className="shadow-sm border-secondary">
              <Card.Header as="h4" className="bg-secondary text-white">Resumen General del Sistema</Card.Header>
              <Card.Body>
                <p>Como <span className="fw-bold">{user.role}</span>, tienes una vista general de la plataforma.</p>
                <p>Total de Tareas en el sistema: <span className="fw-bold">{tasks.length}</span></p>
                <p>Tareas Pendientes Globales: <span className="fw-bold">{tasks.filter(t => t.progreso !== 'COMPLETADA').length}</span></p>
                <p>Tareas Completadas Globales: <span className="fw-bold">{tasks.filter(t => t.progreso === 'COMPLETADA').length}</span></p>
                <p>Total de Campañas en el sistema: <span className="fw-bold">{user.campanas_asignadas?.length || 0}</span></p>
                <hr/>
                <p>Puedes navegar a las secciones de <Link to="/analistas">Analistas</Link>, <Link to="/campanas">Campañas</Link>, <Link to="/tareas">Tareas</Link> y <Link to="/avisos">Avisos</Link> para una gestión detallada.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default DashboardPage;

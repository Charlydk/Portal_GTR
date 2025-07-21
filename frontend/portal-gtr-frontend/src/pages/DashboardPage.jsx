// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const { user, authToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [avisosPendientes, setAvisosPendientes] = useState([]);
  const [tareasGeneradas, setTareasGeneradas] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar datos del dashboard: ${response.statusText}`);
      }
      const data = await response.json();
      setDashboardData(data);

      // Filtrar avisos pendientes de acusar recibo
      const allAvisosResponse = await fetch(`${API_BASE_URL}/avisos/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!allAvisosResponse.ok) {
        const errorData = await allAvisosResponse.json();
        throw new Error(errorData.detail || `Error al cargar todos los avisos: ${allAvisosResponse.statusText}`);
      }
      const allAvisos = await allAvisosResponse.json();

      const acusesReciboResponse = await fetch(`${API_BASE_URL}/analistas/${user.id}/acuses_recibo_avisos`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!acusesReciboResponse.ok) {
        const errorData = await acusesReciboResponse.json();
        throw new Error(errorData.detail || `Error al cargar acuses de recibo: ${acusesReciboResponse.statusText}`);
      }
      const acusesRecibo = await acusesReciboResponse.json();
      
      // --- CORRECCIÓN DEL FILTRO DE AVISOS PENDIENTES ---
      // Acceder a 'ar.aviso.id' en lugar de 'ar.aviso_id'
      const acusadosIds = new Set(acusesRecibo.map(ar => ar.aviso.id)); 
      
      console.log("Todos los Avisos (allAvisos):", allAvisos);
      console.log("Acuses de Recibo del Analista (acusesRecibo):", acusesRecibo);
      console.log("IDs de Avisos Acusados (acusadosIds Set FINAL):", acusadosIds);

      const pendientes = allAvisos.filter(aviso => !acusadosIds.has(aviso.id));
      setAvisosPendientes(pendientes);
      // --- FIN CORRECCIÓN DEL FILTRO ---

      // Cargar tareas generadas por avisos para el analista actual
      const tareasGeneradasResponse = await fetch(`${API_BASE_URL}/tareas_generadas_por_avisos/?analista_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!tareasGeneradasResponse.ok) {
        const errorData = await tareasGeneradasResponse.json();
        throw new Error(errorData.detail || `Error al cargar tareas generadas por avisos: ${tareasGeneradasResponse.statusText}`);
      }
      const tareasGenData = await tareasGeneradasResponse.json();
      setTareasGeneradas(tareasGenData);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message || "No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authToken, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user, fetchDashboardData]);

  const handleAcuseRecibo = async (avisoId) => {
    if (!authToken || !user) {
      setError("Necesita iniciar sesión para realizar esta acción.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}/acuse_recibo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ analista_id: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al acusar recibo: ${response.statusText}`);
      }

      setSuccessMessage("Acuse de recibo registrado con éxito y tarea generada si aplica!");
      fetchDashboardData(); // Recargar datos del dashboard para actualizar avisos y tareas
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error al acusar recibo:", err);
      setError(err.message || "No se pudo registrar el acuse de recibo.");
      setTimeout(() => setError(null), 5000);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString(); // Formato legible local
  };

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando Dashboard...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos del dashboard...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error al cargar el Dashboard</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => navigate('/')}>Volver al Inicio</Button>
        </Alert>
      </Container>
    );
  }

  if (!user || !dashboardData) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          <Alert.Heading>No se pudo cargar la información del usuario.</Alert.Heading>
          <p>Por favor, intente iniciar sesión nuevamente.</p>
          <Button onClick={() => navigate('/login')}>Ir a Iniciar Sesión</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h1 className="mb-4 text-center text-primary">Dashboard de {user.role}</h1>
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="mb-4">
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title className="text-secondary">Información del Usuario</Card.Title>
              <ListGroup variant="flush">
                <ListGroup.Item><strong>Nombre:</strong> {dashboardData.nombre} {dashboardData.apellido}</ListGroup.Item>
                <ListGroup.Item><strong>Email:</strong> {dashboardData.email}</ListGroup.Item>
                <ListGroup.Item><strong>BMS ID:</strong> {dashboardData.bms_id}</ListGroup.Item>
                <ListGroup.Item><strong>Rol:</strong> <Badge bg="info">{dashboardData.role}</Badge></ListGroup.Item>
                <ListGroup.Item><strong>Activo:</strong> {dashboardData.esta_activo ? 'Sí' : 'No'}</ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title className="text-secondary">Campañas Asignadas</Card.Title>
              {dashboardData.campanas_asignadas && dashboardData.campanas_asignadas.length > 0 ? (
                <ListGroup variant="flush">
                  {dashboardData.campanas_asignadas.map(campana => (
                    <ListGroup.Item key={campana.id}>
                      <a href={`/campanas/${campana.id}`} className="text-decoration-none">
                        {campana.nombre}
                      </a>
                      <br />
                      <small className="text-muted">
                        Inicio: {formatDateTime(campana.fecha_inicio)} | Fin: {formatDateTime(campana.fecha_fin)}
                      </small>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="info">No tienes campañas asignadas.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sección para Avisos Pendientes de Acusar Recibo */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="text-secondary">Avisos Pendientes de Acusar Recibo</Card.Title>
              {avisosPendientes.length > 0 ? (
                <ListGroup variant="flush">
                  {avisosPendientes.map(aviso => (
                    <ListGroup.Item key={aviso.id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{aviso.titulo}</strong>
                        <p className="mb-1 text-muted">{aviso.contenido}</p>
                        <small>Creador: {aviso.creador?.nombre} {aviso.creador?.apellido} | Campaña: {aviso.campana?.nombre || 'General'}</small>
                        {aviso.requiere_tarea && (
                          <div className="mt-1">
                            <Badge bg="warning" text="dark">Requiere Tarea</Badge>
                            {aviso.fecha_vencimiento_tarea && (
                              <small className="ms-2 text-danger">Vence Tarea: {formatDateTime(aviso.fecha_vencimiento_tarea)}</small>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleAcuseRecibo(aviso.id)}
                      >
                        Acusar Recibo
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="success">No tienes avisos pendientes de acusar recibo.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sección para Tareas Generadas por Avisos */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="text-secondary">Mis Tareas Generadas por Avisos</Card.Title>
              {tareasGeneradas.length > 0 ? (
                <ListGroup variant="flush">
                  {tareasGeneradas.map(tarea => (
                    <ListGroup.Item key={tarea.id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{tarea.titulo}</strong>
                        <p className="mb-1 text-muted">{tarea.descripcion}</p>
                        <small>
                          Estado: <Badge bg={tarea.progreso === 'PENDIENTE' ? 'danger' : 'success'}>{tarea.progreso}</Badge>
                          {tarea.fecha_vencimiento && (
                            <span className="ms-2 text-danger">Vence: {formatDateTime(tarea.fecha_vencimiento)}</span>
                          )}
                        </small>
                      </div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => navigate(`/tareas-generadas/${tarea.id}`)}
                      >
                        Ver/Gestionar
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="info">No tienes tareas generadas por avisos pendientes.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sección para Tareas de Campaña (ya existente) */}
      <Row>
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="text-secondary">Mis Tareas de Campaña</Card.Title>
              {dashboardData.tareas && dashboardData.tareas.length > 0 ? (
                <ListGroup variant="flush">
                  {dashboardData.tareas.map(tarea => (
                    <ListGroup.Item key={tarea.id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{tarea.titulo}</strong>
                        <p className="mb-1 text-muted">Progreso: <Badge bg={tarea.progreso === 'PENDIENTE' ? 'warning' : 'info'}>{tarea.progreso}</Badge></p>
                        <small>Vencimiento: {formatDateTime(tarea.fecha_vencimiento)}</small>
                      </div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => navigate(`/tareas/${tarea.id}`)}
                      >
                        Ver Detalles
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="info">No tienes tareas de campaña asignadas.</Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DashboardPage;

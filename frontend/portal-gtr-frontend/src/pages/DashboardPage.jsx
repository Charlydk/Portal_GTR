// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api';
import { useNavigate, Link } from 'react-router-dom';

function DashboardPage() {
  const { user, authToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [campanasAsignadas, setCampanasAsignadas] = useState([]);
  const [avisosPendientes, setAvisosPendientes] = useState([]);
  
  const [misTareasActivas, setMisTareasActivas] = useState([]);
  const [tareasDisponibles, setTareasDisponibles] = useState([]);

  const [successMessage, setSuccessMessage] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [
        userMeRes,
        allAvisosRes,
        acusesReciboRes,
        tareasDisponiblesRes,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/users/me/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE_URL}/avisos/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE_URL}/analistas/${user.id}/acuses_recibo_avisos`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE_URL}/campanas/tareas_disponibles/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      ]);

      if (!userMeRes.ok) throw new Error('Error al cargar datos del usuario.');
      const userMeData = await userMeRes.json();
      setCampanasAsignadas(userMeData.campanas_asignadas || []);
      
      // Añadimos una propiedad 'type' para diferenciar las tareas
      const tareasDeCampana = (userMeData.tareas || []).map(t => ({ ...t, type: 'campaign' }));
      const tareasGeneradas = (userMeData.tareas_generadas_por_avisos || []).map(t => ({ ...t, type: 'generated' }));

      const todasMisTareas = [...tareasDeCampana, ...tareasGeneradas].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
      setMisTareasActivas(todasMisTareas);

      if (!allAvisosRes.ok) throw new Error('Error al cargar avisos.');
      if (!acusesReciboRes.ok) throw new Error('Error al cargar acuses de recibo.');
      const allAvisos = await allAvisosRes.json();
      const acusesRecibo = await acusesReciboRes.json();
      const acusadosIds = new Set(acusesRecibo.map(ar => ar.aviso.id));
      setAvisosPendientes(allAvisos.filter(aviso => !acusadosIds.has(aviso.id)));
      
      if (!tareasDisponiblesRes.ok) throw new Error('Error al cargar tareas disponibles.');
      setTareasDisponibles(await tareasDisponiblesRes.json());

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
      fetchDashboardData();
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
    return date.toLocaleString('es-AR');
  };

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner animation="border" role="status" />
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

  if (!user) {
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
      
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title className="text-secondary">Mis Campañas Asignadas</Card.Title>
              {campanasAsignadas.length > 0 ? (
                <ListGroup variant="flush">
                  {campanasAsignadas.map(campana => (
                    <ListGroup.Item key={campana.id}>
                      <Link to={`/campanas/${campana.id}`} className="text-decoration-none">{campana.nombre}</Link>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : ( <Alert variant="info">No tienes campañas asignadas.</Alert> )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="text-secondary">Avisos Pendientes de Acusar Recibo</Card.Title>
              {avisosPendientes.length > 0 ? (
                <ListGroup variant="flush">
                  {avisosPendientes.map(aviso => (
                    <ListGroup.Item key={aviso.id} className="d-flex justify-content-between align-items-center flex-wrap">
                      <div>
                        <strong>{aviso.titulo}</strong>
                        <p className="mb-1 text-muted small">{aviso.contenido}</p>
                        <small>Creador: {aviso.creador?.nombre} {aviso.creador?.apellido} | Campaña: {aviso.campana?.nombre || 'General'}</small>
                        {aviso.requiere_tarea && (
                          <div className="mt-1">
                            <Badge bg="warning" text="dark">Requiere Tarea</Badge>
                          </div>
                        )}
                      </div>
                      <Button variant="success" size="sm" onClick={() => handleAcuseRecibo(aviso.id)}>
                        Acusar Recibo
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : ( <Alert variant="success">No tienes avisos pendientes de acusar recibo.</Alert> )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={6} className="mb-4">
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title className="text-secondary">Mis Tareas Activas</Card.Title>
              {misTareasActivas.length > 0 ? (
                <ListGroup variant="flush">
                  {misTareasActivas.map(tarea => (
                    <ListGroup.Item key={`${tarea.type}-${tarea.id}`}>
                      <Link to={tarea.type === 'campaign' ? `/tareas/${tarea.id}` : `/tareas-generadas/${tarea.id}`} className="text-decoration-none d-block">
                        <strong>{tarea.titulo}</strong>
                        <div>
                          <Badge bg={tarea.type === 'campaign' ? 'primary' : 'info'}>
                            {tarea.type === 'campaign' ? 'Campaña' : 'Aviso'}
                          </Badge>
                          <small className="ms-2 text-muted">Vence: {formatDateTime(tarea.fecha_vencimiento)}</small>
                        </div>
                      </Link>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : ( <Alert variant="info">No tienes tareas activas.</Alert> )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} className="mb-4">
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title className="text-secondary">Tareas de Campaña Disponibles</Card.Title>
              {tareasDisponibles.length > 0 ? (
                <ListGroup variant="flush">
                  {tareasDisponibles.map(tarea => (
                    <ListGroup.Item key={tarea.id}>
                      <Link to={`/tareas/${tarea.id}`} className="text-decoration-none d-block">
                        <strong>{tarea.titulo}</strong>
                        <div>
                          <small className="text-muted">Campaña: {tarea.campana.nombre}</small>
                        </div>
                      </Link>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : ( <Alert variant="success">¡No hay tareas pendientes en tus campañas!</Alert> )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DashboardPage;

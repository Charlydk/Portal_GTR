// src/pages/ListaIncidenciasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, Table, Spinner, Alert, Form, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function ListaIncidenciasPage() {
  const { user, authToken, loading: authLoading } = useAuth();
  const [incidencias, setIncidencias] = useState([]); // Ahora son BitacoraEntry con es_incidencia=true
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);
  const [filterCampanaId, setFilterCampanaId] = useState(''); // Filtro por campaña
  const [filterTipoIncidencia, setFilterTipoIncidencia] = useState('');
  const [filterDate, setFilterDate] = useState(''); // Nuevo filtro por fecha
  const [campanas, setCampanas] = useState([]); // Para el selector de campañas

  const isSupervisorOrResponsable = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

  // Función para cargar las incidencias (ahora entradas de bitácora filtradas)
  const fetchIncidencias = useCallback(async () => {
    if (!authToken || !user) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setError(null);

    let url = `${API_BASE_URL}/incidencias/`; // Nuevo endpoint para incidencias filtradas
    const params = new URLSearchParams();

    if (filterCampanaId) {
      params.append('campana_id', filterCampanaId);
    }
    if (filterTipoIncidencia) {
      params.append('tipo_incidencia', filterTipoIncidencia);
    }
    if (filterDate) {
      params.append('fecha', filterDate);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar incidencias: ${response.statusText}`);
      }
      const data = await response.json();
      setIncidencias(data);
    } catch (err) {
      console.error("Error al cargar incidencias:", err);
      setError(err.message || "No se pudieron cargar las incidencias.");
    } finally {
      setLoadingData(false);
    }
  }, [authToken, user, filterCampanaId, filterTipoIncidencia, filterDate]);

  // Función para cargar la lista de campañas (para el filtro)
  const fetchCampanas = useCallback(async () => {
    if (!authToken) return; // No necesitamos user.role aquí, el backend ya filtra si es ANALISTA
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        throw new Error(`Error al cargar campañas: ${response.statusText}`);
      }
      const data = await response.json();
      // Si el usuario es analista, solo mostrar sus campañas asignadas
      if (user.role === 'ANALISTA') {
        const assignedCampaignIds = user.campanas_asignadas ? user.campanas_asignadas.map(c => c.id) : [];
        setCampanas(data.filter(campana => assignedCampaignIds.includes(campana.id)));
      } else {
        setCampanas(data);
      }
    } catch (err) {
      console.error("Error al cargar campañas:", err);
    }
  }, [authToken, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchIncidencias();
      fetchCampanas(); // Cargar campañas para el filtro
    }
  }, [authLoading, user, fetchIncidencias, fetchCampanas]);

  if (authLoading || loadingData) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando incidencias...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando incidencias...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>¡Error!</Alert.Heading>
          <p>{error}</p>
          {!authToken && (
            <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
          )}
        </Alert>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <p className="text-muted">Por favor, <Link to="/login">inicie sesión</Link> para ver las incidencias.</p>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h2 className="text-center mb-4 text-primary">Lista de Incidencias</h2>

      <Card className="mb-4 shadow-sm">
        <Card.Header as="h5">Filtros de Incidencias</Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Filtrar por Campaña:</Form.Label>
                <Form.Select
                  value={filterCampanaId}
                  onChange={(e) => setFilterCampanaId(e.target.value)}
                >
                  <option value="">Todas las Campañas</option>
                  {campanas.map(campana => (
                    <option key={campana.id} value={campana.id}>
                      {campana.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Filtrar por Tipo de Incidencia:</Form.Label>
                <Form.Select
                  value={filterTipoIncidencia}
                  onChange={(e) => setFilterTipoIncidencia(e.target.value)}
                >
                  <option value="">Todos los Tipos</option>
                  <option value="tecnica">Técnica</option>
                  <option value="operativa">Operativa</option>
                  <option value="otra">Otra</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Filtrar por Fecha:</Form.Label>
                <Form.Control
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Button onClick={fetchIncidencias} variant="info">Aplicar Filtros</Button>
        </Card.Body>
      </Card>

      {incidencias.length === 0 ? (
        <Alert variant="info" className="text-center">
          No se encontraron incidencias con los filtros aplicados.
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Body>
            <Table striped bordered hover responsive className="mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Campaña</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo Incidencia</th>
                  <th>Comentario Incidencia</th>
                  <th>Comentario General</th>
                  <th>Fecha Registro</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.map((incidencia) => (
                  <tr key={incidencia.id}>
                    <td>{incidencia.id}</td>
                    <td>{incidencia.campana?.nombre || 'N/A'}</td> {/* Acceder a campana.nombre */}
                    <td>{incidencia.fecha}</td>
                    <td>{incidencia.hora}</td>
                    <td><Badge bg="danger">{incidencia.tipo_incidencia || 'Incidencia'}</Badge></td>
                    <td>{incidencia.comentario_incidencia || 'N/A'}</td>
                    <td>{incidencia.comentario || 'N/A'}</td>
                    <td>{new Date(incidencia.fecha_creacion).toLocaleDateString()} {new Date(incidencia.fecha_creacion).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default ListaIncidenciasPage;

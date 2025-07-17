// frontend/portal-gtr-frontend/src/pages/ListaIncidenciasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, Table, Spinner, Alert, Form, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function ListaIncidenciasPage() {
  const { user, authToken, loading: authLoading } = useAuth();
  const [incidencias, setIncidencias] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);
  const [filterAnalistaId, setFilterAnalistaId] = useState('');
  const [filterTipoIncidencia, setFilterTipoIncidencia] = useState('');
  const [analistas, setAnalistas] = useState([]); // Para el selector de analistas

  const isSupervisorOrResponsable = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

  // Función para cargar las incidencias
  const fetchIncidencias = useCallback(async () => {
    if (!authToken || !user) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setError(null);

    let url = `${API_BASE_URL}/incidencias/`;
    const params = new URLSearchParams();

    // Si es analista, solo puede ver sus propias incidencias (backend ya lo filtra)
    // Si es supervisor/responsable, aplica los filtros
    if (isSupervisorOrResponsable) {
      if (filterAnalistaId) {
        params.append('analista_id', filterAnalistaId);
      }
      if (filterTipoIncidencia) {
        params.append('tipo_incidencia', filterTipoIncidencia);
      }
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
  }, [authToken, user, filterAnalistaId, filterTipoIncidencia, isSupervisorOrResponsable]);

  // Función para cargar la lista de analistas (solo para Supervisor/Responsable)
  const fetchAnalistas = useCallback(async () => {
    if (!authToken || !isSupervisorOrResponsable) return;
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        throw new Error(`Error al cargar analistas: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalistas(data);
    } catch (err) {
      console.error("Error al cargar analistas:", err);
      // No establecer error global para no bloquear la página si solo fallan los analistas
    }
  }, [authToken, isSupervisorOrResponsable]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchIncidencias();
      if (isSupervisorOrResponsable) {
        fetchAnalistas();
      }
    }
  }, [authLoading, user, fetchIncidencias, fetchAnalistas, isSupervisorOrResponsable]);

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

      {isSupervisorOrResponsable && (
        <Card className="mb-4 shadow-sm">
          <Card.Header as="h5">Filtros de Incidencias</Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Filtrar por Analista:</Form.Label>
                  <Form.Select
                    value={filterAnalistaId}
                    onChange={(e) => setFilterAnalistaId(e.target.value)}
                  >
                    <option value="">Todos los Analistas</option>
                    {analistas.map(analista => (
                      <option key={analista.id} value={analista.id}>
                        {analista.nombre} {analista.apellido} ({analista.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
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
            </Row>
            <Button onClick={fetchIncidencias} variant="info">Aplicar Filtros</Button>
          </Card.Body>
        </Card>
      )}

      {incidencias.length === 0 ? (
        <Alert variant="info" className="text-center">
          No se encontraron incidencias.
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Body>
            <Table striped bordered hover responsive className="mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Analista</th>
                  <th>Comentario</th>
                  <th>Horario</th>
                  <th>Tipo</th>
                  <th>Fecha Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.map((incidencia) => (
                  <tr key={incidencia.id}>
                    <td>{incidencia.id}</td>
                    <td>{incidencia.analista.nombre} {incidencia.analista.apellido}</td>
                    <td>{incidencia.comentario || 'N/A'}</td>
                    <td>{incidencia.horario}</td>
                    <td>{incidencia.tipo_incidencia}</td>
                    <td>{new Date(incidencia.fecha_registro).toLocaleDateString()}</td>
                    <td>
                      {/* Puedes añadir una ruta para ver el detalle de una incidencia específica si lo necesitas */}
                      {/* <Link to={`/incidencias/${incidencia.id}`} className="btn btn-sm btn-info">Ver Detalle</Link> */}
                      {/* Por ahora, no hay página de detalle de incidencia, así que no se enlaza */}
                    </td>
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

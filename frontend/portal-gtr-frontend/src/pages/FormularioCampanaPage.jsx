// src/pages/DetalleCampanaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, ListGroup, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';

function DetalleCampanaPage() {
    const { id } = useParams(); // Obtiene el ID de la campana de la URL
    const navigate = useNavigate();
    const { authToken, user } = useAuth(); // Obtiene el token y el usuario logueado

    const [campana, setCampana] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false); // Para deshabilitar botones durante la operación

    // Función para cargar los detalles de la campana
    const fetchCampanaDetails = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            setError("Necesita iniciar sesión para ver los detalles de la campana.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/campanas/${id}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("No autorizado. Por favor, inicie sesión.");
                }
                if (response.status === 403) {
                    throw new Error("Acceso denegado. No tiene los permisos necesarios para ver esta campana.");
                }
                throw new Error(`Error al cargar la campana: ${response.statusText}`);
            }
            const data = await response.json();
            setCampana(data);
            console.log("Datos de la campana recibidos en el frontend:", data);
        } catch (err) {
            console.error("Error al obtener detalles de la campana:", err);
            setError(err.message || "No se pudo cargar la información de la campana.");
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        fetchCampanaDetails();
    }, [fetchCampanaDetails]);

    // Lógica para asignar/desasignar al analista actual
    const handleAssignUnassign = async (action) => {
        if (!user || !authToken || isProcessing) return;

        setIsProcessing(true);
        setError(null);

        const endpoint = `${API_BASE_URL}/analistas/${user.id}/campanas/${campana.id}`;
        const method = action === 'assign' ? 'POST' : 'DELETE';

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al ${action === 'assign' ? 'asignarse' : 'desasignarse'} de la campaña: ${response.statusText}`);
            }

            // Si la operación fue exitosa, volvemos a cargar los detalles de la campaña
            // para que la UI se actualice con la nueva lista de analistas asignados
            await fetchCampanaDetails();
            // Opcional: Mostrar un mensaje de éxito
            // alert(`Campaña ${action === 'assign' ? 'asignada' : 'desasignada'} con éxito.`);

        } catch (err) {
            console.error(`Error al ${action === 'assign' ? 'asignarse' : 'desasignarse'}:`, err);
            setError(err.message || `No se pudo ${action === 'assign' ? 'asignar' : 'desasignar'} la campaña.`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Cargando detalles de la campana...</span>
                </Spinner>
                <p className="ms-3 text-muted">Cargando detalles de la campana...</p>
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
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="ms-2">Volver a Campanas</Button>
                </Alert>
            </Container>
        );
    }

    if (!campana) {
        return (
            <Container className="mt-4">
                <Alert variant="info">
                    <Alert.Heading>Campana no encontrada</Alert.Heading>
                    <p>La campana que buscas no existe o no tienes permiso para verla.</p>
                    <Button variant="primary" onClick={() => navigate('/campanas')}>Volver a Campanas</Button>
                </Alert>
            </Container>
        );
    }

    // Determinar si el usuario es Supervisor o Responsable (para edición completa de campaña)
    const canManageCampana = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    // Determinar si el usuario actual es un analista y está asignado a esta campaña
    const isAnalyst = user && user.role === 'ANALISTA';
    const isAssignedToThisCampana = isAnalyst && campana.analistas_asignados?.some(analyst => analyst.id === user.id);

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-primary text-white text-center">
                    Detalles de la Campana: {campana.nombre}
                </Card.Header>
                <Card.Body>
                    <Row className="mb-3">
                        <Col md={6}>
                            <p><strong>Descripción:</strong> {campana.descripcion || 'Sin descripción'}</p>
                            <p><strong>Fecha de Inicio:</strong> {campana.fecha_inicio ? new Date(campana.fecha_inicio).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Fecha de Fin:</strong> {campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {new Date(campana.fecha_creacion).toLocaleString()}</p>
                        </Col>
                        <Col md={6} className="d-flex align-items-center justify-content-end">
                            {isAnalyst && ( // Solo mostrar botones si el usuario es un analista
                                isAssignedToThisCampana ? (
                                    <Button
                                        variant="danger"
                                        onClick={() => handleAssignUnassign('unassign')}
                                        disabled={isProcessing}
                                        className="me-2"
                                    >
                                        {isProcessing ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Desasignarme de esta Campana'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="success"
                                        onClick={() => handleAssignUnassign('assign')}
                                        disabled={isProcessing}
                                        className="me-2"
                                    >
                                        {isProcessing ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Asignarme a esta Campana'}
                                    </Button>
                                )
                            )}
                        </Col>
                    </Row>

                    <hr />

                    {/* Sección de Analistas Asignados */}
                    <h4>Analistas Asignados ({campana.analistas_asignados?.length || 0})</h4>
                    {campana.analistas_asignados && campana.analistas_asignados.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campana.analistas_asignados.map(analyst => (
                                <ListGroup.Item key={analyst.id}>
                                    <Link to={`/analistas/${analyst.id}`} className="text-decoration-none text-dark">
                                        {analyst.nombre} {analyst.apellido} ({analyst.email})
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay analistas asignados a esta campana.</p>
                    )}

                    <hr />

                    {/* Sección de Tareas de la Campana */}
                    <h4>Tareas de la Campana ({campana.tareas?.length || 0})</h4>
                    {campana.tareas && campana.tareas.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campana.tareas.map(task => (
                                <ListGroup.Item key={task.id}>
                                    <Link to={`/tareas/${task.id}`} className="text-decoration-none text-dark">
                                        <strong>{task.titulo}</strong> - Progreso: {task.progreso}
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay tareas asociadas a esta campana.</p>
                    )}

                    <hr />

                    {/* Sección de Avisos de la Campana */}
                    <h4>Avisos de la Campana ({campana.avisos?.length || 0})</h4>
                    {campana.avisos && campana.avisos.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campana.avisos.map(notice => (
                                <ListGroup.Item key={notice.id}>
                                    <Link to={`/avisos/${notice.id}`} className="text-decoration-none text-dark">
                                        <strong>{notice.titulo}</strong> - Creado: {new Date(notice.fecha_creacion).toLocaleDateString()}
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay avisos asociados a esta campana.</p>
                    )}

                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="me-2">
                        Volver a Campanas
                    </Button>
                    {canManageCampana && (
                        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">
                            Editar Campana
                        </Link>
                    )}
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default DetalleCampanaPage;

// src/pages/DetalleCampañaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, ListGroup, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';

function DetalleCampañaPage() {
    const { id } = useParams(); // Obtiene el ID de la campaña de la URL
    const navigate = useNavigate();
    const { authToken, user } = useAuth(); // Obtiene el token y el usuario logueado

    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Función para cargar los detalles de la campaña
    const fetchCampaignDetails = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            setError("Necesita iniciar sesión para ver los detalles de la campaña.");
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
                    throw new Error("Acceso denegado. No tiene los permisos necesarios para ver esta campaña.");
                }
                throw new Error(`Error al cargar la campaña: ${response.statusText}`);
            }
            const data = await response.json();
            setCampaign(data);
        } catch (err) {
            console.error("Error al obtener detalles de la campaña:", err);
            setError(err.message || "No se pudo cargar la información de la campaña.");
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        fetchCampaignDetails();
    }, [fetchCampaignDetails]);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Cargando detalles de la campaña...</span>
                </Spinner>
                <p className="ms-3 text-muted">Cargando detalles de la campaña...</p>
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
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="ms-2">Volver a Campañas</Button>
                </Alert>
            </Container>
        );
    }

    if (!campaign) {
        return (
            <Container className="mt-4">
                <Alert variant="info">
                    <Alert.Heading>Campaña no encontrada</Alert.Heading>
                    <p>La campaña que buscas no existe o no tienes permiso para verla.</p>
                    <Button variant="primary" onClick={() => navigate('/campanas')}>Volver a Campañas</Button>
                </Alert>
            </Container>
        );
    }

    // Determinar si el usuario es Supervisor o Responsable (para edición)
    const canManageCampaign = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-primary text-white text-center">
                    Detalles de la Campaña: {campaign.nombre}
                </Card.Header>
                <Card.Body>
                    <Row className="mb-3">
                        <Col md={6}>
                            <p><strong>Descripción:</strong> {campaign.descripcion || 'Sin descripción'}</p>
                            <p><strong>Fecha de Inicio:</strong> {campaign.fecha_inicio ? new Date(campaign.fecha_inicio).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Fecha de Fin:</strong> {campaign.fecha_fin ? new Date(campaign.fecha_fin).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {new Date(campaign.fecha_creacion).toLocaleString()}</p>
                        </Col>
                    </Row>

                    <hr />

                    {/* Sección de Analistas Asignados */}
                    <h4>Analistas Asignados ({campaign.analistas_asignados?.length || 0})</h4>
                    {campaign.analistas_asignados && campaign.analistas_asignados.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campaign.analistas_asignados.map(analyst => (
                                <ListGroup.Item key={analyst.id}>
                                    <Link to={`/analistas/${analyst.id}`} className="text-decoration-none text-dark">
                                        {analyst.nombre} {analyst.apellido} ({analyst.email})
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay analistas asignados a esta campaña.</p>
                    )}

                    <hr />

                    {/* Sección de Tareas de la Campaña */}
                    <h4>Tareas de la Campaña ({campaign.tareas?.length || 0})</h4>
                    {campaign.tareas && campaign.tareas.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campaign.tareas.map(task => (
                                <ListGroup.Item key={task.id}>
                                    <Link to={`/tareas/${task.id}`} className="text-decoration-none text-dark">
                                        <strong>{task.titulo}</strong> - Progreso: {task.progreso}
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay tareas asociadas a esta campaña.</p>
                    )}

                    <hr />

                    {/* Sección de Avisos de la Campaña */}
                    <h4>Avisos de la Campaña ({campaign.avisos?.length || 0})</h4>
                    {campaign.avisos && campaign.avisos.length > 0 ? (
                        <ListGroup variant="flush" className="mb-4">
                            {campaign.avisos.map(notice => (
                                <ListGroup.Item key={notice.id}>
                                    <Link to={`/avisos/${notice.id}`} className="text-decoration-none text-dark">
                                        <strong>{notice.titulo}</strong> - Creado: {new Date(notice.fecha_creacion).toLocaleDateString()}
                                    </Link>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic mb-4">No hay avisos asociados a esta campaña.</p>
                    )}

                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="me-2">
                        Volver a Campañas
                    </Button>
                    {canManageCampaign && (
                        <Link to={`/campanas/editar/${campaign.id}`} className="btn btn-warning">
                            Editar Campaña
                        </Link>
                    )}
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default DetalleCampañaPage;

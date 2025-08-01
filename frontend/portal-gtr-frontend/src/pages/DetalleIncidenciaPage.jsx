// src/pages/DetalleIncidenciaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, Spinner, Alert, ListGroup, Badge, Form, Button, Row, Col } from 'react-bootstrap';

function DetalleIncidenciaPage() {
    const { id } = useParams();
    const { authToken, user } = useAuth();
    const [incidencia, setIncidencia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nuevoComentario, setNuevoComentario] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formatDateTime = (isoString) => {
        if (!isoString) return 'N/A';
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(isoString).toLocaleDateString('es-ES', options);
    };

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    const fetchIncidencia = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error('No se pudo cargar la incidencia.');
            const data = await response.json();
            setIncidencia(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        if (authToken) {
            fetchIncidencia();
        }
    }, [authToken, fetchIncidencia]);
    
    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!nuevoComentario.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}/actualizaciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ comentario: nuevoComentario }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo añadir la actualización.');
            }
            setNuevoComentario('');
            fetchIncidencia(); // Recargar datos
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (nuevoEstado) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}/estado`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo cambiar el estado.');
            }
            fetchIncidencia(); // Recargar datos
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    if (!incidencia) return <Container className="mt-4"><Alert variant="info">Incidencia no encontrada.</Alert></Container>;

    // --- LÓGICA DE PERMISOS SIMPLIFICADA ---
    // La sección de gestión es visible para CUALQUIER usuario logueado.
    const canManageStatus = !!user;

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                    <span>Incidencia: {incidencia.titulo}</span>
                    <Badge bg={getStatusVariant(incidencia.estado)}>{incidencia.estado}</Badge>
                </Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6}>
                            <p><strong>Campaña:</strong> <Link to={`/campanas/${incidencia.campana.id}`}>{incidencia.campana.nombre}</Link></p>
                            <p><strong>Creador:</strong> {incidencia.creador.nombre} {incidencia.creador.apellido}</p>
                            <p><strong>Tipo:</strong> {incidencia.tipo}</p>
                        </Col>
                        <Col md={6}>
                            <p><strong>Herramienta Afectada:</strong> {incidencia.herramienta_afectada || 'N/A'}</p>
                            <p><strong>Indicador Afectado:</strong> {incidencia.indicador_afectado || 'N/A'}</p>
                            <p><strong>Fecha Apertura:</strong> {formatDateTime(incidencia.fecha_apertura)}</p>
                            <p><strong>Fecha Cierre:</strong> {formatDateTime(incidencia.fecha_cierre)}</p>
                        </Col>
                    </Row>
                    <hr />
                    <h5>Descripción Inicial</h5>
                    <p>{incidencia.descripcion_inicial}</p>
                </Card.Body>
            </Card>

            <Card className="shadow-lg mt-4">
                <Card.Header as="h4">Historial de Actualizaciones</Card.Header>
                <Card.Body>
                    <ListGroup variant="flush">
                        {incidencia.actualizaciones.length > 0 ? (
                            incidencia.actualizaciones.map(act => (
                                <ListGroup.Item key={act.id} className="px-0">
                                    <p className="mb-1">{act.comentario}</p>
                                    <small className="text-muted">
                                        Por {act.autor.nombre} {act.autor.apellido} el {formatDateTime(act.fecha_actualizacion)}
                                    </small>
                                </ListGroup.Item>
                            ))
                        ) : (
                            <p className="text-muted">No hay actualizaciones para esta incidencia.</p>
                        )}
                    </ListGroup>
                    <hr />
                    <Form onSubmit={handleAddUpdate}>
                        <Form.Group className="mb-3">
                            <Form.Label>Añadir Actualización</Form.Label>
                            <Form.Control as="textarea" rows={3} value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} required disabled={isSubmitting} />
                        </Form.Group>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner size="sm" /> : "Publicar Actualización"}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            {/* CAMBIO: La sección de gestión ahora es visible para todos los usuarios logueados */}
            {canManageStatus && (
                <Card className="shadow-lg mt-4">
                    <Card.Header as="h4">Gestionar Incidencia</Card.Header>
                    <Card.Body className="text-center">
                        <p>Cambiar estado de la incidencia:</p>
                        
                        <Button variant="warning" onClick={() => handleStatusChange('EN_PROGRESO')} disabled={isSubmitting || incidencia.estado === 'EN_PROGRESO'} className="me-2">
                            Marcar como "En Progreso"
                        </Button>

                        <Button variant="success" onClick={() => handleStatusChange('CERRADA')} disabled={isSubmitting || incidencia.estado === 'CERRADA'} className="me-2">
                            Cerrar Incidencia
                        </Button>
                        
                        {incidencia.estado !== 'ABIERTA' && (
                             <Button variant="danger" onClick={() => handleStatusChange('ABIERTA')} disabled={isSubmitting}>
                                Reabrir Incidencia
                            </Button>
                        )}
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
}

export default DetalleIncidenciaPage;

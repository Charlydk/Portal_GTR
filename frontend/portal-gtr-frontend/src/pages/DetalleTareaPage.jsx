// src/pages/DetalleTareaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Container, Card, ListGroup, Button, Spinner, Alert, Form, Row, Col } from 'react-bootstrap';

function DetalleTareaPage() {
    const { id } = useParams(); // ID de la tarea
    const navigate = useNavigate();
    const { authToken, user } = useAuth(); // Obtiene el token y el usuario logueado

    const [tarea, setTarea] = useState(null);
    const [checklistItems, setChecklistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false); // Para deshabilitar botones durante la actualización

    // Función para cargar los datos de la tarea y sus checklist items
    const fetchTareaDetails = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            setError("Necesita iniciar sesión para ver los detalles de la tarea.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/tareas/${id}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("No autorizado. Por favor, inicie sesión.");
                }
                if (response.status === 403) {
                    throw new Error("Acceso denegado. No tiene los permisos necesarios para ver esta tarea.");
                }
                throw new Error(`Error al cargar la tarea: ${response.statusText}`);
            }
            const data = await response.json();
            setTarea(data);
            setChecklistItems(data.checklist_items || []); // Asegurarse de que sea un array

        } catch (err) {
            console.error("Error al obtener detalles de la tarea:", err);
            setError(err.message || "No se pudo cargar la información de la tarea.");
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        fetchTareaDetails();
    }, [fetchTareaDetails]);

    // Función para manejar el cambio de progreso de la tarea
    const handleProgresoChange = async (e) => {
        const newProgreso = e.target.value;
        setIsUpdating(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/tareas/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                // Solo enviamos los campos que el analista puede modificar
                body: JSON.stringify({ progreso: newProgreso }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al actualizar el progreso: ${response.statusText}`);
            }

            const updatedTarea = await response.json();
            setTarea(updatedTarea); // Actualiza el estado de la tarea con la respuesta del backend
            // Opcional: Mostrar un mensaje de éxito
            // alert('Progreso de tarea actualizado con éxito.');
        } catch (err) {
            console.error("Error al actualizar progreso de tarea:", err);
            setError(err.message || "No se pudo actualizar el progreso de la tarea.");
        } finally {
            setIsUpdating(false);
        }
    };

    // Función para manejar el toggle de un checklist item
    const handleChecklistItemToggle = async (itemId, currentStatus) => {
        setIsUpdating(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/checklist_items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                // Solo enviamos el estado 'completado'
                body: JSON.stringify({ completado: !currentStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al actualizar el ítem de checklist: ${response.statusText}`);
            }

            const updatedItem = await response.json();
            // Actualiza el estado de los checklist items en el frontend
            setChecklistItems(prevItems =>
                prevItems.map(item => (item.id === itemId ? updatedItem : item))
            );
            // Opcional: Mostrar un mensaje de éxito
            // alert('Ítem de checklist actualizado con éxito.');
        } catch (err) {
            console.error("Error al actualizar ítem de checklist:", err);
            setError(err.message || "No se pudo actualizar el ítem de checklist.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Cargando detalles de la tarea...</span>
                </Spinner>
                <p className="ms-3 text-muted">Cargando detalles de la tarea...</p>
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
                    <Button variant="secondary" onClick={() => navigate('/tareas')} className="ms-2">Volver a Tareas</Button>
                </Alert>
            </Container>
        );
    }

    if (!tarea) {
        return (
            <Container className="mt-4">
                <Alert variant="info">
                    <Alert.Heading>Tarea no encontrada</Alert.Heading>
                    <p>La tarea que buscas no existe o no tienes permiso para verla.</p>
                    <Button variant="primary" onClick={() => navigate('/tareas')}>Volver a Tareas</Button>
                </Alert>
            </Container>
        );
    }

    // Determinar si el usuario actual es el analista asignado a esta tarea
    const isAssignedAnalyst = user && tarea.analista_id === user.id && user.role === 'ANALISTA';
    // Determinar si el usuario es Supervisor o Responsable (para edición completa)
    const canManageTask = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-primary text-white text-center">
                    Detalles de la Tarea: {tarea.titulo}
                </Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Row className="mb-3">
                        <Col md={6}>
                            <p><strong>Descripción:</strong> {tarea.descripcion || 'N/A'}</p>
                            <p><strong>Fecha de Vencimiento:</strong> {tarea.fecha_vencimiento ? new Date(tarea.fecha_vencimiento).toLocaleString() : 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {new Date(tarea.fecha_creacion).toLocaleString()}</p>
                        </Col>
                        <Col md={6}>
                            <p><strong>Analista Asignado:</strong> {tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido}` : 'N/A'}</p>
                            <p><strong>Campaña Asociada:</strong> {tarea.campana ? <Link to={`/campanas/${tarea.campana.id}`}>{tarea.campana.nombre}</Link> : 'N/A'}</p>
                            
                            {/* Selector de Progreso para Analistas, Supervisores y Responsables */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>Progreso:</strong></Form.Label>
                                <Form.Select
                                    name="progreso"
                                    value={tarea.progreso}
                                    onChange={handleProgresoChange}
                                    disabled={isUpdating || (!isAssignedAnalyst && !canManageTask)} // Deshabilita si no es el analista asignado ni supervisor/responsable
                                    className="rounded-md"
                                >
                                    <option value="PENDIENTE">PENDIENTE</option>
                                    <option value="EN_PROGRESO">EN_PROGRESO</option>
                                    <option value="COMPLETADA">COMPLETADA</option>
                                    <option value="BLOQUEADA">BLOQUEADA</option>
                                </Form.Select>
                                {isAssignedAnalyst && <Form.Text className="text-muted">Puedes actualizar el progreso de tu tarea.</Form.Text>}
                                {!isAssignedAnalyst && !canManageTask && <Form.Text className="text-muted">Solo el analista asignado, un Responsable o Supervisor pueden cambiar el progreso.</Form.Text>}
                            </Form.Group>
                        </Col>
                    </Row>

                    <hr />

                    <h4>Checklist de la Tarea ({checklistItems.length})</h4>
                    {checklistItems.length > 0 ? (
                        <ListGroup variant="flush">
                            {checklistItems.map(item => (
                                <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center">
                                        {/* Checkbox para el analista asignado o roles de gestión */}
                                        {(isAssignedAnalyst || canManageTask) && (
                                            <Form.Check
                                                type="checkbox"
                                                id={`item-${item.id}`}
                                                checked={item.completado}
                                                onChange={() => handleChecklistItemToggle(item.id, item.completado)}
                                                disabled={isUpdating}
                                                className="me-2 rounded-md"
                                            />
                                        )}
                                        <span className={item.completado ? 'text-decoration-line-through text-muted' : ''}>
                                            {item.descripcion}
                                        </span>
                                    </div>
                                    <div>
                                        {/* Botones de edición y eliminación para Supervisores/Responsables */}
                                        {canManageTask && (
                                            <>
                                                <Link to={`/tareas/${tarea.id}/checklist_items/editar/${item.id}`} className="btn btn-warning btn-sm me-2">
                                                    Editar
                                                </Link>
                                                {/* Aquí iría un botón de eliminar si tuvieras la función */}
                                                {/* <Button variant="danger" size="sm">Eliminar</Button> */}
                                            </>
                                        )}
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-muted fst-italic">No hay ítems en el checklist para esta tarea.</p>
                    )}
                    {canManageTask && (
                        <div className="mt-3">
                            <Link to={`/tareas/${tarea.id}/checklist_items/crear`} className="btn btn-success">
                                Añadir Ítem al Checklist
                            </Link>
                        </div>
                    )}
                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/tareas')} className="me-2">
                        Volver a Tareas
                    </Button>
                    {(canManageTask) && (
                        <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-warning">
                            Editar Tarea
                        </Link>
                    )}
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default DetalleTareaPage;

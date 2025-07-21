// src/pages/FormularioChecklistItemPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

function FormularioChecklistItemPage() {
  const { id, tareaId } = useParams(); // 'id' para editar, 'tareaId' para crear desde una tarea
  const navigate = useNavigate();
  const { user, authToken, loading: authLoading } = useAuth();
  const isEditing = !!id; // Si hay 'id' en los params, estamos editando

  const [formData, setFormData] = useState({
    descripcion: '',
    completado: false,
    tarea_id: tareaId || '' // Pre-rellenar si viene de la URL
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tareas, setTareas] = useState([]); // Para la lista de tareas a seleccionar

  const fetchInitialData = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      // Fetch tasks based on user role
      let tasksUrl = `${API_BASE_URL}/tareas/`;
      if (user.role === 'ANALISTA') {
        tasksUrl += `?analista_id=${user.id}`; // Analistas solo ven sus propias tareas
      }
      const tasksResponse = await fetch(tasksUrl, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!tasksResponse.ok) throw new Error('Error al cargar tareas.');
      setTareas(await tasksResponse.json());

      // If editing, fetch checklist item data
      if (isEditing) {
        const itemResponse = await fetch(`${API_BASE_URL}/checklist_items/${id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!itemResponse.ok) throw new Error('Error al cargar el checklist item.');
        const itemData = await itemResponse.json();
        setFormData({
          descripcion: itemData.descripcion,
          completado: itemData.completado,
          tarea_id: itemData.tarea_id // Asegurarse de cargar la tarea_id
        });
      } else if (tareaId) {
        // If creating from a specific task, ensure that task is valid for the user
        const specificTaskResponse = await fetch(`${API_BASE_URL}/tareas/${tareaId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!specificTaskResponse.ok) {
          throw new Error('La tarea especificada no existe o no tienes permiso para crear items en ella.');
        }
        // No necesitamos la data, solo confirmamos que existe y es accesible
        setFormData(prev => ({ ...prev, tarea_id: tareaId }));
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError(err.message || "No se pudo cargar la información inicial.");
    } finally {
      setLoading(false);
    }
  }, [authToken, user, id, isEditing, tareaId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInitialData();
    }
  }, [authLoading, user, fetchInitialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...formData,
        tarea_id: parseInt(formData.tarea_id), // Asegurarse de que sea un número
      };

      const url = isEditing ? `${API_BASE_URL}/checklist_items/${id}` : `${API_BASE_URL}/checklist_items/`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} el checklist item.`);
      }

      setSuccess(`Checklist Item ${isEditing ? 'actualizado' : 'creado'} con éxito!`);
      setTimeout(() => {
        setSuccess(null);
        // Redirigir a la página de detalles de la tarea
        navigate(`/tareas/${formData.tarea_id}`); 
      }, 2000);
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.message || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el checklist item.`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando formulario de checklist item...</p>
      </Container>
    );
  }

  // Permisos: Analistas solo pueden crear/editar ítems para sus propias tareas
  // Supervisores/Responsables pueden para cualquier tarea
  const canAccessForm = user && (
    user.role === 'SUPERVISOR' ||
    user.role === 'RESPONSABLE' ||
    (user.role === 'ANALISTA' && (
      // Si estamos creando y la tareaId está presente, verificar que la tarea pertenece al analista
      (!isEditing && tareaId && tareas.some(t => t.id === parseInt(tareaId) && t.analista_id === user.id)) ||
      // Si estamos editando, verificar que el item pertenece a una tarea del analista
      (isEditing && formData.tarea_id && tareas.some(t => t.id === parseInt(formData.tarea_id) && t.analista_id === user.id))
    ))
  );

  if (!canAccessForm) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para acceder a este formulario de checklist item.</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">{isEditing ? 'Editar Checklist Item' : 'Crear Nuevo Checklist Item'}</h2>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="tarea_id">
            <Form.Label>Tarea Asociada</Form.Label>
            <Form.Select
              name="tarea_id"
              value={formData.tarea_id}
              onChange={handleChange}
              required
              disabled={!!tareaId || isEditing} // Deshabilitar si viene de URL o si estamos editando
            >
              <option value="">Seleccionar Tarea</option>
              {tareas.map(tarea => (
                <option key={tarea.id} value={tarea.id}>
                  {tarea.titulo} (ID: {tarea.id})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3" controlId="descripcion">
            <Form.Label>Descripción</Form.Label>
            <Form.Control
              type="text"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="completado">
            <Form.Check
              type="checkbox"
              label="Completado"
              name="completado"
              checked={formData.completado}
              onChange={handleChange}
              disabled={user.role === 'ANALISTA' && !isEditing} // Analistas solo pueden cambiar completado al editar
            />
          </Form.Group>

          <div className="d-grid gap-2 mt-4">
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  {' '}
                  Guardando...
                </>
              ) : (
                isEditing ? 'Actualizar Item' : 'Crear Item'
              )}
            </Button>
            <Button variant="secondary" onClick={() => navigate(formData.tarea_id ? `/tareas/${formData.tarea_id}` : '/tareas')} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Card>
    </Container>
  );
}

export default FormularioChecklistItemPage;

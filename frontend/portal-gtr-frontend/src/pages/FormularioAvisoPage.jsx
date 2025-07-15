// src/pages/FormularioAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

function FormularioAvisoPage() {
  const { id } = useParams(); // Para saber si estamos editando (id existe) o creando
  const navigate = useNavigate();
  const { authToken, user } = useAuth(); // Obtenemos el token y el usuario logueado

  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    fecha_vencimiento: '',
    creador_id: '',
    campana_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [analistas, setAnalistas] = useState([]);
  const [campanas, setCampanas] = useState([]);

  const isEditing = Boolean(id);

  // Función para cargar datos de analistas y campañas para los selectores
  const fetchSelectData = useCallback(async () => {
    if (!authToken) return;
    try {
      const [analistasRes, campanasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analistas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      ]);

      if (!analistasRes.ok) {
        const errorData = await analistasRes.json();
        throw new Error(errorData.detail || `Error al cargar analistas: ${analistasRes.statusText}`);
      }
      if (!campanasRes.ok) {
        const errorData = await campanasRes.json();
        throw new Error(errorData.detail || `Error al cargar campañas: ${campanasRes.statusText}`);
      }

      const analistasData = await analistasRes.json();
      const campanasData = await campanasRes.json();

      setAnalistas(analistasData);
      setCampanas(campanasData);

    } catch (err) {
      console.error("Error fetching select data:", err);
      setError(`Error al cargar datos para selectores: ${err.message}`);
    }
  }, [authToken]);

  // Función para cargar los datos del aviso si estamos editando
  const fetchAvisoData = useCallback(async () => {
    if (!id || !authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}`, {
        method: 'GET', // Aseguramos que es un GET
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar aviso: ${response.statusText}`);
      }
      const data = await response.json();
      setFormData({
        titulo: data.titulo,
        contenido: data.contenido,
        // Formatear la fecha para el input type="datetime-local"
        fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento).toISOString().slice(0, 16) : '',
        creador_id: data.creador_id,
        campana_id: data.campana_id || '', // Puede ser null, lo convertimos a string vacío para el select
      });
    } catch (err) {
      console.error("Error fetching aviso data:", err);
      setError(`Error al cargar los datos del aviso: ${err.message}`);
    }
  }, [id, authToken]);

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      if (!authToken) {
        setLoading(false);
        setError("No autenticado. Por favor, inicie sesión.");
        return;
      }

      await fetchSelectData(); // Cargar datos para selectores siempre

      if (isEditing) {
        await fetchAvisoData(); // Si edita, cargar datos del aviso
      } else if (user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE')) {
        // Si es creando y el usuario es Supervisor o Responsable, establecer creador_id por defecto
        setFormData(prev => ({ ...prev, creador_id: user.id }));
      }
      setLoading(false);
    };

    loadPageData();
  }, [authToken, isEditing, user, fetchSelectData, fetchAvisoData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Usamos 'loading' también para el estado de envío
    setError(null);
    setSuccessMessage(null);

    // Validaciones básicas
    if (!formData.titulo || !formData.contenido || !formData.creador_id) {
      setError("Título, contenido y creador son campos obligatorios.");
      setLoading(false);
      return;
    }

    // Preparar los datos para la API
    const payload = {
      ...formData,
      creador_id: parseInt(formData.creador_id),
      campana_id: formData.campana_id ? parseInt(formData.campana_id) : null,
      // Convertir fecha_vencimiento a formato ISO si existe, o a null
      fecha_vencimiento: formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento).toISOString() : null,
    };

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `${API_BASE_URL}/avisos/${id}` : `${API_BASE_URL}/avisos/`;

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend Error Response:", errorData); // Log detallado del error del backend
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} aviso: ${response.statusText}`);
      }

      setSuccessMessage(`Aviso ${isEditing ? 'actualizado' : 'creado'} exitosamente.`);
      setTimeout(() => {
        navigate('/avisos'); // Redirigir a la lista de avisos
      }, 1500);

    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.message || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el aviso.`);
    } finally {
      setLoading(false);
    }
  };

  // Determinar si el campo creador_id debe ser editable
  // Solo un SUPERVISOR puede cambiar el creador de un aviso existente
  const isCreadorEditable = user && user.role === 'SUPERVISOR';

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos del formulario...</p>
      </Container>
    );
  }

  if (error && !successMessage) { // Mostrar error solo si no hay mensaje de éxito
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>¡Error!</Alert.Heading>
          <p>{error}</p>
          <Button variant="primary" onClick={() => navigate('/avisos')}>Volver a Avisos</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-sm">
        <Card.Header as="h2" className="bg-primary text-white text-center">
          {isEditing ? 'Editar Aviso' : 'Crear Nuevo Aviso'}
        </Card.Header>
        <Card.Body>
          {successMessage && <Alert variant="success">{successMessage}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formTitulo">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Ingrese el título del aviso"
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formContenido">
              <Form.Label>Contenido</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                name="contenido"
                value={formData.contenido}
                onChange={handleChange}
                placeholder="Ingrese el contenido del aviso"
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formFechaVencimiento">
              <Form.Label>Fecha de Vencimiento (Opcional)</Form.Label>
              <Form.Control
                type="datetime-local"
                name="fecha_vencimiento"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formCreadorId">
              <Form.Label>Creador</Form.Label>
              <Form.Select
                name="creador_id"
                value={formData.creador_id}
                onChange={handleChange}
                required
                // Solo Supervisor puede cambiar el creador. En creación, se preselecciona para Responsable/Analista.
                disabled={loading || (!isCreadorEditable && isEditing)} 
              >
                <option value="">Seleccione un creador</option>
                {analistas.map(analista => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre} {analista.apellido} (BMS ID: {analista.bms_id})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {user && user.role === 'ANALISTA' && !isEditing && `Por defecto: ${user.nombre} ${user.apellido}`}
                {user && !isCreadorEditable && isEditing && `Solo un SUPERVISOR puede cambiar el creador de un aviso existente.`}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formCampanaId">
              <Form.Label>Campaña (Opcional)</Form.Label>
              <Form.Select
                name="campana_id"
                value={formData.campana_id}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Ninguna Campaña</option>
                {campanas.map(campana => (
                  <option key={campana.id} value={campana.id}>
                    {campana.nombre}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Asocie este aviso a una campaña específica.
              </Form.Text>
            </Form.Group>

            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                ) : (
                  isEditing ? 'Actualizar Aviso' : 'Crear Aviso'
                )}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/avisos')} disabled={loading}>
                Cancelar
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default FormularioAvisoPage;

// frontend/portal-gtr-frontend/src/pages/RegistroIncidenciaPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Importa la URL base de la API
import { useAuth } from '../context/AuthContext'; // Importa el contexto de autenticación
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap'; // Importa componentes de Bootstrap

const RegistroIncidenciaPage = () => {
  const { user, authToken } = useAuth(); // Obtiene el usuario y el token del contexto
  const navigate = useNavigate();

  const [comentario, setComentario] = useState('');
  const [horario, setHorario] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('tecnica');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Función para generar las opciones de horario (cada 30 minutos)
  const generarOpcionesHorario = () => {
    const opciones = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hora = String(h).padStart(2, '0');
        const minuto = String(m).padStart(2, '0');
        opciones.push(`${hora}:${minuto}`);
      }
    }
    return opciones;
  };

  // Manejador del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    if (!user || !authToken) {
      setError("No estás autenticado. Por favor, inicia sesión.");
      setIsSubmitting(false);
      return;
    }

    const newIncidencia = {
      comentario: comentario,
      horario: horario,
      tipo_incidencia: tipoIncidencia,
      analista_id: user.id, // Usamos el ID del usuario autenticado
    };

    console.log('Datos de la incidencia a enviar:', newIncidencia);

    try {
      const response = await fetch(`${API_BASE_URL}/incidencias/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newIncidencia),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al registrar incidencia: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Incidencia registrada con éxito:', data);
      setSuccessMessage('Incidencia registrada con éxito!');

      // Limpiar formulario
      setComentario('');
      setHorario('');
      setTipoIncidencia('tecnica');

      // Opcional: Redirigir a la lista de incidencias después de un breve retraso
      setTimeout(() => {
        navigate('/incidencias'); // Asumiendo que /incidencias será la página de lista
      }, 2000);

    } catch (err) {
      console.error('Error al registrar incidencia:', err);
      setError(err.message || 'Hubo un error al registrar la incidencia.');
    } finally {
      setIsSubmitting(false);
      // Limpiar mensajes de éxito/error después de un tiempo si no se redirige
      if (!successMessage) { // Solo si no hay un mensaje de éxito que provoque redirección
        setTimeout(() => { setError(null); }, 5000);
      }
    }
  };

  return (
    <Container className="py-5">
      <div className="registro-incidencia-container p-4 border rounded shadow-sm bg-white">
        <h2 className="text-center mb-4 text-primary">Registrar Nueva Incidencia</h2>

        {error && <Alert variant="danger">{error}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="comentario">Comentario Breve:</Form.Label>
            <Form.Control
              as="textarea"
              id="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              required
              rows="4"
              disabled={isSubmitting}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="horario">Horario:</Form.Label>
            <Form.Select
              id="horario"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              required
              disabled={isSubmitting}
            >
              <option value="">Selecciona un horario</option>
              {generarOpcionesHorario().map((hora) => (
                <option key={hora} value={hora}>{hora}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="tipoIncidencia">Tipo de Incidencia:</Form.Label>
            <Form.Select
              id="tipoIncidencia"
              value={tipoIncidencia}
              onChange={(e) => setTipoIncidencia(e.target.value)}
              required
              disabled={isSubmitting}
            >
              <option value="tecnica">Técnica</option>
              <option value="operativa">Operativa</option>
              <option value="otra">Otra</option>
            </Form.Select>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100 mt-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Registrar Incidencia'}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default RegistroIncidenciaPage;

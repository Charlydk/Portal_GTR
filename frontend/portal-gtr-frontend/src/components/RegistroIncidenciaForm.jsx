// src/components/RegistroIncidenciaForm.jsx
import React, { useState } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Alert, Spinner, Card } from 'react-bootstrap';

// Este componente ahora es un formulario reutilizable, no una página completa.
// Recibe campanaId, y callbacks para éxito y error.
const RegistroIncidenciaForm = ({ campanaId, onSuccess, onError }) => {
  const { user, authToken } = useAuth();

  const [comentario, setComentario] = useState('');
  const [horario, setHorario] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('tecnica');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

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
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    if (!user || !authToken) {
      setFormError("No estás autenticado. Por favor, inicia sesión.");
      setIsSubmitting(false);
      return;
    }
    if (!campanaId) {
      setFormError("ID de campaña no proporcionado. No se puede registrar la incidencia.");
      setIsSubmitting(false);
      return;
    }

    // Obtener la fecha actual en formato YYYY-MM-DD
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const newBitacoraEntry = {
      campana_id: campanaId,
      fecha: formattedDate,
      hora: horario,
      comentario: comentario, // El comentario general de la bitácora
      es_incidencia: true, // ¡Marcamos esta entrada como una incidencia!
      tipo_incidencia: tipoIncidencia,
      comentario_incidencia: comentario, // Usamos el mismo comentario para la incidencia por simplicidad
                                        // Podrías tener un campo separado si la incidencia requiere un comentario distinto
    };

    console.log('Datos de la entrada de bitácora (incidencia) a enviar:', newBitacoraEntry);

    try {
      const response = await fetch(`${API_BASE_URL}/bitacora_entries/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newBitacoraEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al registrar incidencia: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Incidencia registrada con éxito como entrada de bitácora:', data);
      setFormSuccess('Incidencia registrada con éxito!');

      // Limpiar formulario
      setComentario('');
      setHorario('');
      setTipoIncidencia('tecnica');

      // Llamar al callback de éxito si se proporciona
      if (onSuccess) {
        onSuccess(data);
      }

    } catch (err) {
      console.error('Error al registrar incidencia:', err);
      setFormError(err.message || 'Hubo un error al registrar la incidencia.');
      // Llamar al callback de error si se proporciona
      if (onError) {
        onError(err);
      }
    } finally {
      setIsSubmitting(false);
      // Limpiar mensajes de éxito/error después de un tiempo
      setTimeout(() => { setFormError(null); setFormSuccess(null); }, 5000);
    }
  };

  return (
    <Card className="shadow-sm p-4 mb-4">
      <h4 className="mb-4 text-primary">Registrar Nueva Incidencia</h4>

      {formError && <Alert variant="danger">{formError}</Alert>}
      {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label htmlFor="comentario">Comentario Breve de la Incidencia:</Form.Label>
          <Form.Control
            as="textarea"
            id="comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            required
            rows="3"
            disabled={isSubmitting}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="horario">Horario de la Incidencia:</Form.Label>
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
          variant="danger" // Usamos danger para incidencias, para destacarlas
          className="w-100 mt-3"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Registrar Incidencia'}
        </Button>
      </Form>
    </Card>
  );
};

export default RegistroIncidenciaForm;

// src/pages/FormularioChecklistItemPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import FormularioChecklistItem from '../components/FormularioChecklistItem'; // Importamos el componente presentacional

function FormularioChecklistItemPage() {
  // El 'id' puede ser el ID del checklist item (para editar) o 'crear' (para nuevo)
  const { id, tareaId } = useParams(); // También necesitamos el ID de la tarea
  const navigate = useNavigate(); // Para redirigir después de guardar

  const [loading, setLoading] = useState(true); // Estado de carga para la edición
  const [error, setError] = useState(null); // Estado para errores de carga o envío
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para el envío del formulario
  const [tarea, setTarea] = useState(null); // Para mostrar el título de la tarea asociada

  // Estado para los datos del formulario
  const [formData, setFormData] = useState({
    descripcion: '',
    completado: false,
    tarea_id: parseInt(tareaId) || null // Aseguramos que tarea_id sea un número, o null si no está presente
  });

  // Efecto para cargar datos del checklist item si estamos editando
  useEffect(() => {
    const fetchItemAndTask = async () => {
      setLoading(true);
      setError(null);
      try {
        // Primero, cargar la tarea asociada (si tareaId está presente)
        if (tareaId) {
          const parsedTareaId = parseInt(tareaId);
          if (isNaN(parsedTareaId)) {
            throw new Error("ID de tarea inválido.");
          }
          const taskResponse = await fetch(`${API_BASE_URL}/tareas/${parsedTareaId}`);
          if (!taskResponse.ok) {
            throw new Error(`Error al cargar la tarea asociada: ${taskResponse.statusText}`);
          }
          const taskData = await taskResponse.json();
          setTarea(taskData);
          setFormData(prev => ({ ...prev, tarea_id: parsedTareaId }));
        } else {
          throw new Error("ID de tarea no especificado para el ítem de checklist.");
        }

        // Si estamos en modo edición (id es un número y no 'crear')
        if (id && id !== 'crear') {
          const itemId = parseInt(id);
          if (isNaN(itemId)) {
            throw new Error("ID de ítem de checklist inválido para edición.");
          }
          const itemResponse = await fetch(`${API_BASE_URL}/checklist_items/${itemId}`);
          if (!itemResponse.ok) {
            if (itemResponse.status === 404) {
              throw new Error("Ítem de checklist no encontrado para edición.");
            }
            throw new Error(`Error al cargar el ítem de checklist: ${itemResponse.statusText}`);
          }
          const itemData = await itemResponse.json();
          setFormData({
            descripcion: itemData.descripcion,
            completado: itemData.completado,
            tarea_id: itemData.tarea_id // Aseguramos que el tarea_id del form sea el del item cargado
          });
        }
      } catch (err) {
        console.error("Error en FormularioChecklistItemPage:", err);
        setError(err.message || "No se pudo cargar el formulario.");
      } finally {
        setLoading(false);
      }
    };

    fetchItemAndTask();
  }, [id, tareaId]); // Se ejecuta cuando cambia el ID del item o el ID de la tarea

  // Manejador de cambios en los campos del formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Manejador de envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario
    setIsSubmitting(true); // Indicamos que el envío ha comenzado
    setError(null);       // Limpiamos errores previos

    const method = (id && id !== 'crear') ? 'PUT' : 'POST';
    const url = (id && id !== 'crear') ? `${API_BASE_URL}/checklist_items/${id}` : `${API_BASE_URL}/checklist_items/`;

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData), // Envía los datos del formulario en formato JSON
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al guardar el ítem de checklist: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`Ítem de checklist ${method === 'PUT' ? 'actualizado' : 'creado'} con éxito.`);
      // Redirigir de vuelta a la página de detalle de la tarea
      navigate(`/tareas/${formData.tarea_id}`); 
    } catch (err) {
      console.error("Error al guardar el ítem de checklist:", err);
      setError(err.message || "No se pudo guardar el ítem de checklist. Intente de nuevo.");
    } finally {
      setIsSubmitting(false); // Indicamos que el envío ha finalizado
    }
  };

  // Renderizado condicional para el estado de carga
  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando formulario...</span>
        </div>
        <p>Cargando datos del ítem de checklist...</p>
      </div>
    );
  }

  // Renderizado condicional para errores
  if (error && !isSubmitting) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to={tareaId ? `/tareas/${tareaId}` : "/tareas"} className="btn btn-secondary mt-3">Volver</Link>
      </div>
    );
  }

  // Determinar si estamos en modo edición
  const isEditMode = !!id && id !== 'crear';

  return (
    <div className="container mt-4">
      <h3>{isEditMode ? 'Editar Ítem de Checklist' : 'Crear Nuevo Ítem de Checklist'}</h3>
      {tarea && <p className="text-muted">Para la tarea: <strong>{tarea.titulo}</strong></p>}
      <hr />
      {error && isSubmitting && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <FormularioChecklistItem
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
      />
    </div>
  );
}

export default FormularioChecklistItemPage;

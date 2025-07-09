// src/pages/DetalleTareaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import ListaChecklistItems from '../components/ListaChecklistItems'; // Importamos el nuevo componente

function DetalleTareaPage() {
  const { id } = useParams(); // Obtiene el ID de la tarea de la URL
  const [tarea, setTarea] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]); // Nuevo estado para los ítems de checklist
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para obtener la tarea y sus ítems de checklist
  const fetchTareaAndChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tareaId = parseInt(id); // Aseguramos que el ID sea numérico
      if (isNaN(tareaId)) {
        throw new Error("ID de tarea inválido.");
      }

      // 1. Obtener los detalles de la tarea
      const tareaResponse = await fetch(`${API_BASE_URL}/tareas/${tareaId}`);
      if (!tareaResponse.ok) {
        if (tareaResponse.status === 404) {
          throw new Error("Tarea no encontrada.");
        }
        throw new Error(`Error al cargar la tarea: ${tareaResponse.statusText}`);
      }
      const tareaData = await tareaResponse.json();
      setTarea(tareaData);

      // 2. Obtener los ítems de checklist asociados a esta tarea
      const checklistResponse = await fetch(`${API_BASE_URL}/checklist_items/?tarea_id=${tareaId}`);
      if (!checklistResponse.ok) {
        throw new Error(`Error al cargar los ítems de checklist: ${checklistResponse.statusText}`);
      }
      const checklistData = await checklistResponse.json();
      setChecklistItems(checklistData);

    } catch (err) {
      console.error("Error al cargar la tarea o ítems de checklist:", err);
      setError(err.message || "No se pudo cargar la tarea o sus ítems de checklist.");
    } finally {
      setLoading(false);
    }
  }, [id]); // Dependencia del ID de la URL

  // Efecto para cargar los datos al montar el componente o cuando cambia el ID
  useEffect(() => {
    if (id) {
      fetchTareaAndChecklist();
    } else {
      setLoading(false);
      setError("No se especificó un ID de tarea.");
    }
  }, [id, fetchTareaAndChecklist]);

  // Manejar la eliminación de un ítem de checklist
  const handleDeleteChecklistItem = async (itemId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este ítem de checklist?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/checklist_items/${itemId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      alert('Ítem de checklist eliminado con éxito.');
      fetchTareaAndChecklist(); // Volver a cargar la tarea y los ítems para actualizar la lista
    } catch (err) {
      console.error("Error al eliminar el ítem de checklist:", err);
      setError(err.message || "No se pudo eliminar el ítem de checklist. Intente de nuevo.");
    }
  };

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando tarea...</span>
        </div>
        <p>Cargando detalles de la tarea y sus ítems de checklist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/tareas" className="btn btn-secondary mt-3">Volver a Tareas</Link>
      </div>
    );
  }

  if (!tarea) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          La tarea no pudo ser cargada o no existe.
        </div>
        <Link to="/tareas" className="btn btn-secondary mt-3">Volver a Tareas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles de la Tarea: {tarea.titulo}</h3>
      <hr />
      <p><strong>ID:</strong> {tarea.id}</p>
      <p><strong>Título:</strong> {tarea.titulo}</p>
      <p><strong>Descripción:</strong> {tarea.descripcion || 'N/A'}</p>
      <p><strong>Fecha de Vencimiento:</strong> {formatDateTime(tarea.fecha_vencimiento)}</p>
      <p><strong>Progreso:</strong> {tarea.progreso}</p>
      <p><strong>Analista Asignado:</strong> {tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido}` : 'N/A'}</p>
      <p><strong>Campaña Asociada:</strong> {tarea.campana ? tarea.campana.nombre : 'N/A'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(tarea.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/tareas" className="btn btn-secondary me-2">Volver a la lista de Tareas</Link>
        <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-warning">Editar Tarea</Link>
      </div>

      {/* Sección de Checklist Items */}
      <h4 className="mt-5">Ítems de Checklist</h4>
      <hr />
      <Link to={`/tareas/${tarea.id}/checklist-items/crear`} className="btn btn-success btn-sm mb-3">
        Agregar Nuevo Ítem de Checklist
      </Link>
      <ListaChecklistItems 
        checklistItems={checklistItems} 
        onDeleteItem={handleDeleteChecklistItem} // Pasamos la función de eliminar
      />
    </div>
  );
}

export default DetalleTareaPage;

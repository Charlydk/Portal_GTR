// src/pages/DetalleTareaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

function DetalleTareaPage() {
  const { id } = useParams(); // Obtiene el ID de la tarea de la URL
  const navigate = useNavigate();
  const [tarea, setTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener los detalles de la tarea
  const fetchTarea = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tareaId = parseInt(id); // Asegura que el ID sea numérico
      if (isNaN(tareaId)) {
        throw new Error("ID de tarea inválido.");
      }

      const response = await fetch(`${API_BASE_URL}/tareas/${tareaId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Tarea no encontrada.");
        }
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
    } catch (err) {
      console.error("Error al obtener tarea:", err);
      setError(err.message || "No se pudo cargar la información de la tarea.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]); // Vuelve a ejecutar cuando el ID o el token cambien

  // Efecto para cargar los datos al montar el componente o cuando el ID/token cambia
  useEffect(() => {
    if (id && authToken) {
      fetchTarea();
    } else if (!authToken) {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los detalles de la tarea.");
    } else {
      setLoading(false);
      setError("No se especificó un ID de tarea.");
    }
  }, [id, authToken, fetchTarea]);

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  // Función para manejar la eliminación de una tarea
  const handleEliminarTarea = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta tarea? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${tarea.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para eliminar tareas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para eliminar tareas.");
        }
        throw new Error(`Error al eliminar tarea: ${response.statusText}`);
      }

      alert('Tarea eliminada con éxito.');
      navigate('/tareas'); // Redirige a la lista de tareas
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
      setError(err.message || "No se pudo eliminar la tarea.");
    }
  };

  // Función para manejar la eliminación de un ítem de checklist
  const handleEliminarChecklistItem = async (itemId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este ítem de checklist?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/checklist_items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para eliminar ítems de checklist. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para eliminar ítems de checklist.");
        }
        throw new Error(`Error al eliminar ítem de checklist: ${response.statusText}`);
      }

      alert('Ítem de checklist eliminado con éxito.');
      fetchTarea(); // Recargar la tarea para actualizar la lista de ítems
    } catch (err) {
      console.error("Error al eliminar ítem de checklist:", err);
      setError(err.message || "No se pudo eliminar el ítem de checklist.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando tarea...</span>
        </div>
        <p>Cargando detalles de la tarea...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
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
      <p><strong>Progreso:</strong> {tarea.progreso}</p>
      <p><strong>Fecha de Vencimiento:</strong> {formatDateTime(tarea.fecha_vencimiento)}</p>
      <p><strong>Analista Asignado:</strong> {tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido}` : 'N/A'}</p>
      <p><strong>Campaña Asociada:</strong> {tarea.campana ? tarea.campana.nombre : 'N/A'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(tarea.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/tareas" className="btn btn-secondary me-2">Volver a la lista de Tareas</Link>
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-warning me-2">Editar Tarea</Link>
        )}
        {user && user.role === 'SUPERVISOR' && (
          <button onClick={handleEliminarTarea} className="btn btn-danger">Eliminar Tarea</button>
        )}
      </div>

      {/* Sección de Checklist Items */}
      <div className="mt-5">
        <h4>Ítems de Checklist</h4>
        <hr />
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/tareas/${tarea.id}/checklist_items/crear`} className="btn btn-success mb-3">
            Crear Nuevo Ítem de Checklist
          </Link>
        )}

        {tarea.checklist_items && tarea.checklist_items.length > 0 ? (
          <ul className="list-group">
            {tarea.checklist_items.map(item => (
              <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <input
                    type="checkbox"
                    checked={item.completado}
                    readOnly // Solo para visualización, la edición se hace en el formulario
                    className="form-check-input me-2"
                  />
                  <span className={item.completado ? 'text-muted text-decoration-line-through' : ''}>
                    {item.descripcion}
                  </span>
                </div>
                <div>
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/tareas/${tarea.id}/checklist_items/editar/${item.id}`} className="btn btn-sm btn-outline-warning me-2">
                      Editar
                    </Link>
                  )}
                  {user && user.role === 'SUPERVISOR' && (
                    <button
                      onClick={() => handleEliminarChecklistItem(item.id)}
                      className="btn btn-sm btn-outline-danger"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No hay ítems de checklist para esta tarea.</p>
        )}
      </div>
    </div>
  );
}

export default DetalleTareaPage;

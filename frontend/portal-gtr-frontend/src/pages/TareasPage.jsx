// src/pages/TareasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

function TareasPage() {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener las tareas
  const fetchTareas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver las tareas.");
        }
        throw new Error(`Error al cargar tareas: ${response.statusText}`);
      }
      const data = await response.json();
      setTareas(data);
    } catch (err) {
      console.error("Error al obtener tareas:", err);
      setError(err.message || "No se pudo cargar la lista de tareas.");
    } finally {
      setLoading(false);
    }
  }, [authToken]); // Vuelve a ejecutar cuando el token cambie

  // Efecto para cargar las tareas al montar el componente o cuando el token cambia
  useEffect(() => {
    if (authToken) {
      fetchTareas();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para ver las tareas.");
    }
  }, [authToken, fetchTareas]);

  // Función para manejar la eliminación de una tarea
  const handleEliminarTarea = async (tareaId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta tarea? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${tareaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
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
      fetchTareas(); // Recargar la lista de tareas
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
      setError(err.message || "No se pudo eliminar la tarea.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando tareas...</span>
        </div>
        <p>Cargando lista de tareas...</p>
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
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Tareas</h2>
      {/* Solo permite crear tareas si el usuario actual es Supervisor o Responsable */}
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/tareas/crear" className="btn btn-primary mb-3">
          Crear Nueva Tarea
        </Link>
      )}
      
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Analista</th>
              <th>Campaña</th>
              <th>Progreso</th>
              <th>Fecha Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tareas.map((tarea) => (
              <tr key={tarea.id}>
                <td>{tarea.id}</td>
                <td>{tarea.titulo}</td>
                <td>{tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido}` : 'N/A'}</td>
                <td>{tarea.campana ? tarea.campana.nombre : 'N/A'}</td>
                <td>{tarea.progreso}</td>
                <td>{tarea.fecha_vencimiento ? new Date(tarea.fecha_vencimiento).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <Link to={`/tareas/${tarea.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                  {/* Solo permite editar si el usuario actual es Supervisor o Responsable */}
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                  )}
                  {/* Solo permite eliminar si el usuario actual es Supervisor */}
                  {user && user.role === 'SUPERVISOR' && (
                    <button
                      onClick={() => handleEliminarTarea(tarea.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TareasPage;

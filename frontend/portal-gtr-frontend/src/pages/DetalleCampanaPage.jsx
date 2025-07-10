// src/pages/DetalleCampanaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

function DetalleCampanaPage() {
  const { id } = useParams(); // Obtiene el ID de la campaña de la URL
  const navigate = useNavigate();
  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener los detalles de la campaña
  const fetchCampana = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const campanaId = parseInt(id); // Asegura que el ID sea numérico
      if (isNaN(campanaId)) {
        throw new Error("ID de campaña inválido.");
      }

      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Campaña no encontrada.");
        }
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios.");
        }
        throw new Error(`Error al cargar la campaña: ${response.statusText}`);
      }
      const data = await response.json();
      setCampana(data);
    } catch (err) {
      console.error("Error al obtener campaña:", err);
      setError(err.message || "No se pudo cargar la información de la campaña.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]); // Vuelve a ejecutar cuando el ID o el token cambien

  // Efecto para cargar los datos al montar el componente o cuando el ID/token cambia
  useEffect(() => {
    if (id && authToken) {
      fetchCampana();
    } else if (!authToken) {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los detalles de la campaña.");
    } else {
      setLoading(false);
      setError("No se especificó un ID de campaña.");
    }
  }, [id, authToken, fetchCampana]);

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  // Función para manejar la eliminación de una campaña
  const handleEliminarCampana = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta campaña? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campana.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para eliminar campañas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para eliminar campañas.");
        }
        throw new Error(`Error al eliminar campaña: ${response.statusText}`);
      }

      alert('Campaña eliminada con éxito.');
      navigate('/campanas'); // Redirige a la lista de campañas
    } catch (err) {
      console.error("Error al eliminar campaña:", err);
      setError(err.message || "No se pudo eliminar la campaña.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando campaña...</span>
        </div>
        <p>Cargando detalles de la campaña...</p>
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
        <Link to="/campanas" className="btn btn-secondary mt-3">Volver a Campañas</Link>
      </div>
    );
  }

  if (!campana) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          La campaña no pudo ser cargada o no existe.
        </div>
        <Link to="/campanas" className="btn btn-secondary mt-3">Volver a Campañas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles de la Campaña: {campana.nombre}</h3>
      <hr />
      <p><strong>ID:</strong> {campana.id}</p>
      <p><strong>Nombre:</strong> {campana.nombre}</p>
      <p><strong>Descripción:</strong> {campana.descripcion || 'N/A'}</p>
      <p><strong>Fecha de Inicio:</strong> {formatDateTime(campana.fecha_inicio)}</p>
      <p><strong>Fecha de Fin:</strong> {formatDateTime(campana.fecha_fin)}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(campana.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/campanas" className="btn btn-secondary me-2">Volver a la lista de Campañas</Link>
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning me-2">Editar Campaña</Link>
        )}
        {user && user.role === 'SUPERVISOR' && (
          <button onClick={handleEliminarCampana} className="btn btn-danger">Eliminar Campaña</button>
        )}
      </div>
    </div>
  );
}

export default DetalleCampanaPage;

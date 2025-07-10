// src/pages/DetalleAnalistaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // ¡NUEVO! Importa useAuth

function DetalleAnalistaPage() {
  const { id } = useParams(); // Obtiene el ID del analista de la URL
  const navigate = useNavigate();
  const [analista, setAnalista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener los detalles del analista
  const fetchAnalista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const analistaId = parseInt(id); // Asegura que el ID sea numérico
      if (isNaN(analistaId)) {
        throw new Error("ID de analista inválido.");
      }

      const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Analista no encontrado.");
        }
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver este analista.");
        }
        throw new Error(`Error al cargar el analista: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalista(data);
    } catch (err) {
      console.error("Error al obtener analista:", err);
      setError(err.message || "No se pudo cargar la información del analista.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]); // Vuelve a ejecutar cuando el ID o el token cambien

  // Efecto para cargar los datos al montar el componente o cuando el ID/token cambia
  useEffect(() => {
    if (id && authToken) {
      fetchAnalista();
    } else if (!authToken) {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los detalles del analista.");
    } else {
      setLoading(false);
      setError("No se especificó un ID de analista.");
    }
  }, [id, authToken, fetchAnalista]);

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  // Función para manejar la desactivación de un analista
  const handleDesactivarAnalista = async () => {
    if (!window.confirm('¿Está seguro de que desea desactivar este analista?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analista.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para desactivar analistas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para desactivar analistas.");
        }
        throw new Error(`Error al desactivar analista: ${response.statusText}`);
      }

      alert('Analista desactivado con éxito.');
      navigate('/analistas'); // Redirige a la lista de analistas
    } catch (err) {
      console.error("Error al desactivar analista:", err);
      setError(err.message || "No se pudo desactivar el analista.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando analista...</span>
        </div>
        <p>Cargando detalles del analista...</p>
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
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  if (!analista) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          El analista no pudo ser cargado o no existe.
        </div>
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles del Analista: {analista.nombre} {analista.apellido}</h3>
      <hr />
      <p><strong>ID:</strong> {analista.id}</p>
      <p><strong>Nombre:</strong> {analista.nombre}</p>
      <p><strong>Apellido:</strong> {analista.apellido}</p>
      <p><strong>Email:</strong> {analista.email}</p>
      <p><strong>BMS ID:</strong> {analista.bms_id}</p>
      <p><strong>Rol:</strong> {analista.role}</p>
      <p><strong>Activo:</strong> {analista.esta_activo ? 'Sí' : 'No'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(analista.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/analistas" className="btn btn-secondary me-2">Volver a la lista de Analistas</Link>
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/analistas/editar/${analista.id}`} className="btn btn-warning me-2">Editar Analista</Link>
        )}
        {user && user.role === 'SUPERVISOR' && analista.esta_activo && (
          <button onClick={handleDesactivarAnalista} className="btn btn-danger">Desactivar Analista</button>
        )}
      </div>
    </div>
  );
}

export default DetalleAnalistaPage;

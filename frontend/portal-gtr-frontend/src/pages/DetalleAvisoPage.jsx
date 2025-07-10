// src/pages/DetalleAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

function DetalleAvisoPage() {
  const { id } = useParams(); // Obtiene el ID del aviso de la URL
  const navigate = useNavigate();
  const [aviso, setAviso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener los detalles del aviso
  const fetchAviso = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const avisoId = parseInt(id); // Asegura que el ID sea numérico
      if (isNaN(avisoId)) {
        throw new Error("ID de aviso inválido.");
      }

      const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Aviso no encontrado.");
        }
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver este aviso.");
        }
        throw new Error(`Error al cargar el aviso: ${response.statusText}`);
      }
      const data = await response.json();
      setAviso(data);
    } catch (err) {
      console.error("Error al obtener aviso:", err);
      setError(err.message || "No se pudo cargar la información del aviso.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]); // Vuelve a ejecutar cuando el ID o el token cambien

  // Efecto para cargar los datos al montar el componente o cuando el ID/token cambia
  useEffect(() => {
    if (id && authToken) {
      fetchAviso();
    } else if (!authToken) {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los detalles del aviso.");
    } else {
      setLoading(false);
      setError("No se especificó un ID de aviso.");
    }
  }, [id, authToken, fetchAviso]);

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  // Función para manejar la eliminación de un aviso
  const handleEliminarAviso = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar este aviso? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${aviso.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para eliminar avisos. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para eliminar avisos.");
        }
        throw new Error(`Error al eliminar aviso: ${response.statusText}`);
      }

      alert('Aviso eliminado con éxito.');
      navigate('/avisos'); // Redirige a la lista de avisos
    } catch (err) {
      console.error("Error al eliminar aviso:", err);
      setError(err.message || "No se pudo eliminar el aviso.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando aviso...</span>
        </div>
        <p>Cargando detalles del aviso...</p>
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
        <Link to="/avisos" className="btn btn-secondary mt-3">Volver a Avisos</Link>
      </div>
    );
  }

  if (!aviso) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          El aviso no pudo ser cargado o no existe.
        </div>
        <Link to="/avisos" className="btn btn-secondary mt-3">Volver a Avisos</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles del Aviso: {aviso.titulo}</h3>
      <hr />
      <p><strong>ID:</strong> {aviso.id}</p>
      <p><strong>Título:</strong> {aviso.titulo}</p>
      <p><strong>Contenido:</strong> {aviso.contenido || 'N/A'}</p>
      <p><strong>Creador ID:</strong> {aviso.creador_id}</p>
      <p><strong>Campaña ID:</strong> {aviso.campana_id || 'N/A'}</p>
      <p><strong>Fecha de Vencimiento:</strong> {formatDateTime(aviso.fecha_vencimiento)}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(aviso.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/avisos" className="btn btn-secondary me-2">Volver a la lista de Avisos</Link>
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning me-2">Editar Aviso</Link>
        )}
        {user && user.role === 'SUPERVISOR' && (
          <button onClick={handleEliminarAviso} className="btn btn-danger">Eliminar Aviso</button>
        )}
      </div>
    </div>
  );
}

export default DetalleAvisoPage;

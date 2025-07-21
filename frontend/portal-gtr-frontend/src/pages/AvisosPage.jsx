// src/pages/AvisosPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth
import { Button, Spinner, Alert, Table } from 'react-bootstrap'; // Importa componentes de react-bootstrap

function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener los avisos
  const fetchAvisos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver los avisos.");
        }
        throw new Error(`Error al cargar avisos: ${response.statusText}`);
      }
      const data = await response.json();
      setAvisos(data);
    } catch (err) {
      console.error("Error al obtener avisos:", err);
      setError(err.message || "No se pudo cargar la lista de avisos.");
    } finally {
      setLoading(false);
    }
  }, [authToken]); // Vuelve a ejecutar cuando el token cambie

  // Efecto para cargar los avisos al montar el componente o cuando el token cambia
  useEffect(() => {
    if (authToken) {
      fetchAvisos();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los avisos.");
    }
  }, [authToken, fetchAvisos]);

  // Función para manejar la eliminación de un aviso
  const handleEliminarAviso = async (avisoId) => {
    // Usar un modal personalizado en lugar de window.confirm
    const confirmed = window.confirm('¿Está seguro de que desea eliminar este aviso? Esta acción es irreversible.');
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
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

      // Usar un modal personalizado en lugar de alert
      alert('Aviso eliminado con éxito.'); // Considerar reemplazar con un componente de notificación
      fetchAvisos(); // Recargar la lista de avisos
    } catch (err) {
      console.error("Error al eliminar aviso:", err);
      alert(err.message || "No se pudo eliminar el aviso."); // Considerar reemplazar con un componente de notificación
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
        <Spinner animation="border" role="status" className="text-primary">
          <span className="visually-hidden">Cargando avisos...</span>
        </Spinner>
        <p>Cargando lista de avisos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <Alert variant="danger">
          {error}
        </Alert>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Avisos</h2>
      {/* Solo permite crear avisos si el usuario actual es Supervisor o Responsable */}
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/avisos/crear" className="btn btn-primary mb-3">
          Crear Nuevo Aviso
        </Link>
      )}
      
      <div className="table-responsive">
        {/* Aquí la corrección: <thead> va justo después de <Table> sin saltos de línea ni espacios */}
        <Table striped bordered hover><thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Contenido</th>
              <th>Creador</th>
              <th>Campaña</th>
              <th>Fecha Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {avisos.map((aviso) => (
              <tr key={aviso.id}>
                <td>{aviso.id}</td>
                <td>{aviso.titulo}</td>
                <td>{aviso.contenido.substring(0, 50)}{aviso.contenido.length > 50 ? '...' : ''}</td>
                {/* Mostrar nombre del creador y campaña si están disponibles */}
                <td>{aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : aviso.creador_id || 'N/A'}</td>
                <td>{aviso.campana ? aviso.campana.nombre : aviso.campana_id || 'N/A'}</td>
                <td>{aviso.fecha_vencimiento ? formatDateTime(aviso.fecha_vencimiento) : 'N/A'}</td>
                <td>
                  <Link to={`/avisos/${aviso.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                  {/* Solo permite editar si el usuario actual es Supervisor o Responsable */}
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                  )}
                  {user && user.role === 'SUPERVISOR' && (
                    <Button
                      onClick={() => handleEliminarAviso(aviso.id)}
                      variant="danger" // Usando variant de Button de React-Bootstrap
                      size="sm"
                    >
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default AvisosPage;

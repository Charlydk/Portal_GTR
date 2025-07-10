// src/pages/AvisosPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Asegúrate de que tu archivo api.js esté correcto

// Importamos el componente presentacional ListaAvisos
import ListaAvisos from '../components/ListaAvisos'; 

function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para obtener los avisos de la API
  const fetchAvisos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/`);
      
      if (!response.ok) {
        throw new Error(`Error al cargar avisos: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAvisos(data);
    } catch (err) {
      console.error("Error al obtener avisos:", err);
      setError(err.message || "No se pudieron cargar los avisos.");
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar los avisos al montar el componente
  useEffect(() => {
    fetchAvisos();
  }, []); // El array vacío asegura que se ejecute solo una vez al montar

  // Manejo de la eliminación de un aviso
  const handleDeleteAviso = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este aviso?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        // Si el backend devuelve un mensaje de error, intenta leerlo
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      // Si la eliminación es exitosa (código 204 No Content), actualiza la lista
      setAvisos(prevAvisos => prevAvisos.filter(aviso => aviso.id !== id));
      alert('Aviso eliminado con éxito.');
    } catch (err) {
      console.error("Error al eliminar el aviso:", err);
      setError(err.message || "No se pudo eliminar el aviso. Intente de nuevo.");
    }
  };


  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando avisos...</span>
        </div>
        <p>Cargando lista de avisos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/" className="btn btn-secondary mt-3">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2>Lista de Avisos</h2>
      {/* Link para crear un nuevo aviso */}
      <Link to="/avisos/crear" className="btn btn-primary mb-3">
        Crear Nuevo Aviso
      </Link>
      {avisos.length === 0 ? (
        <div className="alert alert-info" role="alert">
          No hay avisos registrados.
        </div>
      ) : (
        // Pasamos los avisos y la función de eliminar al componente presentacional
        <ListaAvisos avisos={avisos} onDelete={handleDeleteAviso} />
      )}
    </div>
  );
}

export default AvisosPage;

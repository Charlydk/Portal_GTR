// src/pages/AnalistasPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Asegúrate de tener tu archivo api.js con API_BASE_URL

// IMPORTANTE: Importamos el componente presentacional ListaAnalistas desde components
import ListaAnalistas from '../components/ListaAnalistas'; 

function AnalistasPage() { // Renombramos el componente a AnalistasPage
  const [analistas, setAnalistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalistas = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/analistas/`);
        
        if (!response.ok) {
          throw new Error(`Error al cargar analistas: ${response.statusText}`);
        }
        
        const data = await response.json();
        setAnalistas(data);
      } catch (err) {
        console.error("Error al obtener analistas:", err);
        setError(err.message || "No se pudieron cargar los analistas.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalistas();
  }, []);

  // Manejo de la eliminación de un analista (lo implementaremos después)
  const handleDeleteAnalista = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este analista?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setAnalistas(prevAnalistas => prevAnalistas.filter(analista => analista.id !== id));
      alert('Analista eliminado con éxito.');
    } catch (err) {
      console.error("Error al eliminar el analista:", err);
      setError("No se pudo eliminar el analista. Intente de nuevo.");
    }
  };


  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando analistas...</span>
        </div>
        <p>Cargando lista de analistas...</p>
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

  // Pasamos los analistas y la función de eliminar al componente presentacional
  return (
    <div className="container mt-4">
      <h2>Lista de Analistas</h2>
      <Link to="/analistas/nuevo" className="btn btn-primary mb-3">
        Crear Nuevo Analista
      </Link>
      {analistas.length === 0 ? (
        <div className="alert alert-info" role="alert">
          No hay analistas registrados.
        </div>
      ) : (
        <ListaAnalistas analistas={analistas} onDelete={handleDeleteAnalista} />
      )}
    </div>
  );
}

export default AnalistasPage;
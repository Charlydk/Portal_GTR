// src/pages/CampanasPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Asegúrate de que tu archivo api.js esté correcto

// Importamos el componente presentacional ListaCampanas
import ListaCampanas from '../components/ListaCampanas'; 

function CampanasPage() {
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para obtener las campañas de la API
  const fetchCampanas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/`);
      
      if (!response.ok) {
        throw new Error(`Error al cargar campañas: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCampanas(data);
    } catch (err) {
      console.error("Error al obtener campañas:", err);
      setError(err.message || "No se pudieron cargar las campañas.");
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar las campañas al montar el componente
  useEffect(() => {
    fetchCampanas();
  }, []); // El array vacío asegura que se ejecute solo una vez al montar

  // NOTA: La función handleDeleteCampana y su lógica han sido ELIMINADAS
  // ya que no tendremos un botón de eliminación para usuarios comunes.

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando campañas...</span>
        </div>
        <p>Cargando lista de campañas...</p>
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
      <h2>Lista de Campañas</h2>
      {/* Link para crear una nueva campaña */}
      <Link to="/campanas/crear" className="btn btn-primary mb-3">
        Crear Nueva Campaña
      </Link>
      {campanas.length === 0 ? (
        <div className="alert alert-info" role="alert">
          No hay campañas registradas.
        </div>
      ) : (
        // Pasamos solo las campañas al componente presentacional (sin la función de eliminar)
        <ListaCampanas campanas={campanas} />
      )}
    </div>
  );
}

export default CampanasPage;

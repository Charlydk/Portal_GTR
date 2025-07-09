// src/pages/DetalleCampanaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import DetalleCampana from '../components/DetalleCampana'; // Importamos el componente presentacional

function DetalleCampanaPage() {
  const { id } = useParams(); // Obtiene el ID de la campaña de la URL
  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCampana = async () => {
      setLoading(true);
      setError(null);
      try {
        const campanaId = parseInt(id); // Aseguramos que el ID sea numérico
        if (isNaN(campanaId)) {
          throw new Error("ID de campaña inválido.");
        }

        const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Campaña no encontrada.");
          }
          throw new Error(`Error al cargar la campaña: ${response.statusText}`);
        }
        const data = await response.json();
        setCampana(data);
      } catch (err) {
        console.error("Error al cargar la campaña:", err);
        setError(err.message || "No se pudo cargar la campaña.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCampana();
    } else {
      setLoading(false);
      setError("No se especificó un ID de campaña.");
    }
  }, [id]); // Se ejecuta cada vez que el ID de la URL cambia

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

  // Pasamos la campaña cargada al componente presentacional DetalleCampana
  return <DetalleCampana campana={campana} />;
}

export default DetalleCampanaPage;

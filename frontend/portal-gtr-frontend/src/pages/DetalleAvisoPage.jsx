// src/pages/DetalleAvisoPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Your API base URL
import DetalleAviso from '../components/DetalleAviso'; // Import the presentational component

function DetalleAvisoPage() {
  const { id } = useParams(); // Get notice ID from URL
  const [aviso, setAviso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAviso = async () => {
      setLoading(true);
      setError(null);
      try {
        const avisoId = parseInt(id); // Ensure ID is numeric
        if (isNaN(avisoId)) {
          throw new Error("ID de aviso inválido.");
        }

        const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Aviso no encontrado.");
          }
          throw new Error(`Error al cargar el aviso: ${response.statusText}`);
        }
        const data = await response.json();
        setAviso(data);
      } catch (err) {
        console.error("Error al cargar el aviso:", err);
        setError(err.message || "No se pudo cargar el aviso.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAviso();
    } else {
      setLoading(false);
      setError("No se especificó un ID de aviso.");
    }
  }, [id]); // Effect runs when ID changes

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

  // Pass the loaded notice to the presentational DetalleAviso component
  return <DetalleAviso aviso={aviso} />;
}

export default DetalleAvisoPage;

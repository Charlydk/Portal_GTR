// src/pages/DetalleAnalistaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import DetalleAnalista from '../components/DetalleAnalista'; // Importamos el componente presentacional

function DetalleAnalistaPage() {
  const { id } = useParams(); // Obtiene el ID del analista de la URL
  const [analista, setAnalista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // --- ¡AQUÍ ESTÁ LA LÓGICA CLAVE ACTUALIZADA! ---
    // Si el ID es 'crear', significa que estamos en la ruta de creación
    // y este componente (DetalleAnalistaPage) no debe intentar cargar un analista.
    if (id === 'crear') { // ¡Cambiado de 'nueva' a 'crear'!
      setLoading(false);
      setError("Ruta de creación detectada. No se carga el detalle de un analista existente aquí."); 
      return; // Sal de la función useEffect para evitar el fetch
    }
    // --- FIN DE LA LÓGICA ACTUALIZADA ---

    const fetchAnalista = async () => {
      setLoading(true);
      setError(null);
      try {
        const analistaId = parseInt(id); // Aseguramos que el ID sea numérico
        if (isNaN(analistaId)) {
          throw new Error("ID de analista inválido.");
        }

        // Al cargar el detalle, también deberíamos considerar si el analista está activo.
        // Aunque el backend ya filtra por activo por defecto, es bueno tener en cuenta.
        const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}`); 
        if (!response.ok) {
          if (response.status === 404) {
            // El backend ahora devuelve 404 si el analista no existe o está inactivo.
            throw new Error("Analista no encontrado o inactivo."); 
          }
          throw new Error(`Error al cargar el analista: ${response.statusText}`);
        }
        const data = await response.json();
        setAnalista(data);
      } catch (err) {
        console.error("Error al cargar el analista:", err);
        setError(err.message || "No se pudo cargar el analista.");
      } finally {
        setLoading(false);
      }
    };

    // Solo intentamos cargar si hay un ID y no es 'crear'
    if (id) {
      fetchAnalista();
    } else {
      setLoading(false);
      setError("No se especificó un ID de analista.");
    }
  }, [id]); // Se ejecuta cada vez que el ID de la URL cambia

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
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  if (!analista) {
    // Si no hay analista y no estamos en modo "crear" (porque ya lo manejamos arriba),
    // y no hay un error específico, mostramos este mensaje.
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          El analista no pudo ser cargado o no existe.
        </div>
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  // Pasamos el analista cargado al componente presentacional DetalleAnalista
  return <DetalleAnalista analista={analista} />;
}

export default DetalleAnalistaPage;
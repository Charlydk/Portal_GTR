// src/pages/DetalleTareaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
// IMPORTANTE: Asegúrate que esta ruta sea correcta para tu componente presentacional
import DetalleTarea from '../components/DetalleTarea'; 
import { API_BASE_URL } from '../api'; // Importamos la URL base

function DetalleTareaPage() { // ¡Este es el nombre del componente de la página!
  const { id } = useParams(); // Obtiene el ID de la URL
  const [tarea, setTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTarea = async () => {
      setLoading(true);
      setError(null);
      try {
        // Aseguramos que el ID sea numérico
        const tareaId = parseInt(id);
        if (isNaN(tareaId)) {
          throw new Error("ID de tarea inválido.");
        }

        const response = await fetch(`${API_BASE_URL}/tareas/${tareaId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Tarea no encontrada.");
          }
          throw new Error(`Error al cargar la tarea: ${response.statusText}`);
        }
        const data = await response.json();
        setTarea(data);
      } catch (err) {
        console.error("Error al cargar la tarea:", err);
        setError(err.message || "No se pudo cargar la tarea.");
      } finally {
        setLoading(false);
      }
    };

    if (id) { // Solo intentamos cargar si hay un ID en la URL
      fetchTarea();
    } else {
      setLoading(false);
      setError("No se especificó un ID de tarea.");
    }
  }, [id]); // Dependencia del ID para recargar si cambia

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando tarea...</span>
        </div>
        <p>Cargando detalles de la tarea...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/tareas" className="btn btn-secondary mt-3">Volver a Tareas</Link>
      </div>
    );
  }

  if (!tarea) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          La tarea no pudo ser cargada o no existe.
        </div>
        <Link to="/tareas" className="btn btn-secondary mt-3">Volver a Tareas</Link>
      </div>
    );
  }

  // Pasamos la tarea cargada de la API al componente presentacional
  return <DetalleTarea tarea={tarea} />;
}

export default DetalleTareaPage;
// src/pages/FormularioTareaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Importamos useNavigate
import FormularioTarea from '../components/FormularioTarea';
import { API_BASE_URL } from '../api'; // Importamos la URL base

function FormularioTareaPage() {
  const { id } = useParams(); // Obtiene el ID si estamos en /tareas/editar/:id
  const navigate = useNavigate(); // Hook para la navegación programática
  const [tareaAEditar, setTareaAEditar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analistasDisponibles, setAnalistasDisponibles] = useState([]);
  const [campanasDisponibles, setCampanasDisponibles] = useState([]);

  // --- Carga de Analistas y Campañas para los selects ---
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [analistasRes, campanasRes] = await Promise.all([
          fetch(`${API_BASE_URL}/analistas/`),
          fetch(`${API_BASE_URL}/campanas/`)
        ]);

        if (!analistasRes.ok) throw new Error(`Error al cargar analistas: ${analistasRes.statusText}`);
        if (!campanasRes.ok) throw new Error(`Error al cargar campañas: ${campanasRes.statusText}`);

        const analistasData = await analistasRes.json();
        const campanasData = await campanasRes.json();

        setAnalistasDisponibles(analistasData);
        setCampanasDisponibles(campanasData);

      } catch (err) {
        console.error("Error al cargar dependencias:", err);
        setError("No se pudieron cargar los analistas o campañas.");
      }
    };
    fetchDependencies();
  }, []);


  // --- Carga de la Tarea para Editar ---
  useEffect(() => {
    const fetchTareaParaEditar = async () => {
      setLoading(true);
      setError(null);
      try {
        const tareaId = parseInt(id);
        if (isNaN(tareaId)) {
          throw new Error("ID de tarea inválido para editar.");
        }

        const response = await fetch(`${API_BASE_URL}/tareas/${tareaId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Tarea no encontrada para editar.");
          }
          throw new Error(`Error al cargar la tarea: ${response.statusText}`);
        }
        const data = await response.json();
        setTareaAEditar(data);
      } catch (err) {
        console.error("Error al cargar la tarea para editar:", err);
        setError(err.message || "No se pudo cargar la tarea para editar.");
      } finally {
        setLoading(false);
      }
    };

    if (id) { // Si hay un ID en la URL, estamos en modo edición
      fetchTareaParaEditar();
    } else { // Si no hay ID, estamos creando una nueva tarea
      setTareaAEditar(null); // Aseguramos que el formulario esté vacío
      setLoading(false);
    }
  }, [id]); // Este efecto se ejecuta cada vez que el ID de la URL cambia


  // --- Manejo del Envío del Formulario (Crear/Editar) ---
  const handleSaveTarea = async (tareaData) => {
    setLoading(true); // Podríamos tener un estado de loading específico para "guardar"
    setError(null);
    try {
      let response;
      if (tareaAEditar) { // Si estamos editando
        response = await fetch(`${API_BASE_URL}/tareas/${tareaAEditar.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tareaData),
        });
      } else { // Si estamos creando
        response = await fetch(`${API_BASE_URL}/tareas/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tareaData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json(); // Intentar leer el error del backend
        throw new Error(errorData.detail || `Error al guardar la tarea: ${response.statusText}`);
      }

      const savedTarea = await response.json();
      alert(`Tarea ${tareaAEditar ? 'actualizada' : 'creada'} con éxito: ${savedTarea.titulo}`);
      navigate(`/tareas/${savedTarea.id}`); // Redirige al detalle de la tarea guardada
    } catch (err) {
      console.error("Error al guardar la tarea:", err);
      setError(err.message || "Ocurrió un error al guardar la tarea.");
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando formulario...</span>
        </div>
        <p>Cargando formulario...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button className="btn btn-secondary mt-3" onClick={() => navigate('/tareas')}>Volver a Tareas</button>
      </div>
    );
  }

  return (
    <FormularioTarea
      tareaInicial={tareaAEditar} // Pasa null para crear, o la tarea para editar
      onSave={handleSaveTarea} // Pasa la función para guardar
      analistas={analistasDisponibles} // Pasa los analistas cargados de la API
      campanas={campanasDisponibles} // Pasa las campañas cargadas de la API
    />
  );
}

export default FormularioTareaPage;
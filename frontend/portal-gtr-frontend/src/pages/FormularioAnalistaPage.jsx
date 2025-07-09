// src/pages/FormularioAnalistaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Asegúrate de importar Link
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import FormularioAnalista from '../components/FormularioAnalista'; // Importamos el componente presentacional

function FormularioAnalistaPage() {
  const { id } = useParams(); // Obtiene el ID si estamos en modo edición
  const navigate = useNavigate(); // Para redirigir después de guardar
  
  const [analista, setAnalista] = useState(null); // Para cargar datos si estamos editando
  const [loading, setLoading] = useState(true); // Estado de carga para la edición
  const [error, setError] = useState(null); // Estado para errores de carga o envío
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para el envío del formulario

  // Estado para los datos del formulario (para crear o editar)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    bms_id: ''
  });

  // Efecto para cargar datos del analista si estamos editando
  useEffect(() => {
    // Si hay un ID en la URL Y NO es "crear", entonces intentamos cargar el analista para edición
    if (id && id !== 'crear') { 
      const fetchAnalista = async () => {
        setLoading(true);
        setError(null);
        try {
          const analistaId = parseInt(id);
          if (isNaN(analistaId)) {
            throw new Error("ID de analista inválido para edición."); 
          }
          const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}`);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Analista no encontrado para edición.");
            }
            throw new Error(`Error al cargar el analista para edición: ${response.statusText}`);
          }
          const data = await response.json();
          setAnalista(data); // Guarda el analista original
          setFormData({ // Carga los datos en el formulario
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            bms_id: data.bms_id || '' // Asegura que bms_id no sea undefined
          });
        } catch (err) {
          console.error("Error al cargar el analista para edición:", err);
          setError(err.message || "No se pudo cargar el analista para edición.");
        } finally {
          setLoading(false);
        }
      };
      fetchAnalista();
    } else { // Si no hay ID o el ID es "crear", estamos creando uno nuevo
      setLoading(false); // No hay nada que cargar
    }
  }, [id]);

  // Manejador de cambios en los campos del formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Manejador de envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario (recargar la página)
    setIsSubmitting(true); // Indicamos que el envío ha comenzado
    setError(null);       // Limpiamos errores previos

    const method = (id && id !== 'crear') ? 'PUT' : 'POST'; // Si hay ID y NO es 'crear', es PUT (editar), si no, es POST (crear)
    const url = (id && id !== 'crear') ? `${API_BASE_URL}/analistas/${id}` : `${API_BASE_URL}/analistas/`;

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData), // Envía los datos del formulario en formato JSON
      });

      if (!response.ok) {
        const errorData = await response.json(); // Intenta leer el mensaje de error del backend
        throw new Error(errorData.detail || `Error al guardar el analista: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`Analista ${method === 'PUT' ? 'actualizado' : 'creado'} con éxito: ${result.nombre}`);
      navigate('/analistas'); // Redirige a la lista de analistas después de guardar
    } catch (err) {
      console.error("Error al guardar el analista:", err);
      setError(err.message || "No se pudo guardar el analista. Intente de nuevo.");
    } finally {
      setIsSubmitting(false); // Indicamos que el envío ha finalizado
    }
  };

  // Renderizado condicional para el estado de carga (solo si estamos cargando un analista existente)
  if (loading && (id && id !== 'crear')) { 
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando analista...</span>
        </div>
        <p>Cargando datos del analista para edición...</p>
      </div>
    );
  }

  // Renderizado condicional para errores de carga o envío
  if (error && !isSubmitting) { 
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>{ (id && id !== 'crear') ? 'Editar Analista' : 'Crear Nuevo Analista'}</h3> 
      <hr />
      {error && isSubmitting && ( // Muestra error si hubo un problema al enviar el formulario
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <FormularioAnalista
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode={!!id && id !== 'crear'} // Le indicamos al componente presentacional si es modo edición
      />
    </div>
  );
}

export default FormularioAnalistaPage;

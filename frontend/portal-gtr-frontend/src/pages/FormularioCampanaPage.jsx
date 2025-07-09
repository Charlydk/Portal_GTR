// src/pages/FormularioCampanaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import FormularioCampana from '../components/FormularioCampana'; // Importamos el componente presentacional

function FormularioCampanaPage() {
  const { id } = useParams(); // Obtiene el ID si estamos en modo edición
  const navigate = useNavigate(); // Para redirigir después de guardar

  const [loading, setLoading] = useState(true); // Estado de carga para la edición
  const [error, setError] = useState(null); // Estado para errores de carga o envío
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para el envío del formulario

  // Estado para los datos del formulario (para crear o editar)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fecha_inicio: '', // Formato YYYY-MM-DDTHH:mm para datetime-local
    fecha_fin: ''     // Formato YYYY-MM-DDTHH:mm para datetime-local
  });

  // Efecto para cargar datos de la campaña si estamos editando
  useEffect(() => {
    // Si hay un ID en la URL Y NO es "crear", entonces intentamos cargar la campaña para edición
    if (id && id !== 'crear') { 
      const fetchCampana = async () => {
        setLoading(true);
        setError(null);
        try {
          const campanaId = parseInt(id);
          if (isNaN(campanaId)) {
            throw new Error("ID de campaña inválido para edición."); 
          }
          const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}`);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Campaña no encontrada para edición.");
            }
            throw new Error(`Error al cargar la campaña para edición: ${response.statusText}`);
          }
          const data = await response.json();
          
          // Formatear las fechas para el input datetime-local
          // La API devuelve ISO 8601 (ej. "2023-10-26T10:00:00.000Z")
          // El input datetime-local espera "YYYY-MM-DDTHH:mm"
          const formatDateTimeForInput = (isoString) => {
            if (!isoString) return '';
            const dt = new Date(isoString);
            // Asegurarse de que los componentes de la fecha y hora tengan dos dígitos
            const year = dt.getFullYear();
            const month = (dt.getMonth() + 1).toString().padStart(2, '0');
            const day = dt.getDate().toString().padStart(2, '0');
            const hours = dt.getHours().toString().padStart(2, '0');
            const minutes = dt.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          };

          setFormData({
            nombre: data.nombre,
            descripcion: data.descripcion || '',
            fecha_inicio: formatDateTimeForInput(data.fecha_inicio),
            fecha_fin: formatDateTimeForInput(data.fecha_fin)
          });
        } catch (err) {
          console.error("Error al cargar la campaña para edición:", err);
          setError(err.message || "No se pudo cargar la campaña para edición.");
        } finally {
          setLoading(false);
        }
      };
      fetchCampana();
    } else { // Si no hay ID o el ID es "crear", estamos creando una nueva
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
    const url = (id && id !== 'crear') ? `${API_BASE_URL}/campanas/${id}` : `${API_BASE_URL}/campanas/`;

    // Preparar los datos para el envío
    // Asegurarse de que las fechas sean objetos Date válidos o null
    const dataToSend = {
      ...formData,
      fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
      fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
    };

    // Eliminar campos vacíos si es PUT para que model_dump(exclude_unset=True) funcione en FastAPI
    // Esto es importante para que FastAPI solo actualice los campos que realmente se modificaron
    if (method === 'PUT') {
      for (const key in dataToSend) {
        if (dataToSend[key] === null || dataToSend[key] === '') {
          delete dataToSend[key];
        }
      }
    }
    
    // Si fecha_fin es una cadena vacía, asegúrate de que sea null para la API
    if (dataToSend.fecha_fin === '') {
      dataToSend.fecha_fin = null;
    }


    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend), // Envía los datos del formulario en formato JSON
      });

      if (!response.ok) {
        const errorData = await response.json(); // Intenta leer el mensaje de error del backend
        throw new Error(errorData.detail || `Error al guardar la campaña: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`Campaña ${method === 'PUT' ? 'actualizada' : 'creada'} con éxito: ${result.nombre}`);
      navigate('/campanas'); // Redirige a la lista de campañas después de guardar
    } catch (err) {
      console.error("Error al guardar la campaña:", err);
      setError(err.message || "No se pudo guardar la campaña. Intente de nuevo.");
    } finally {
      setIsSubmitting(false); // Indicamos que el envío ha finalizado
    }
  };

  // Renderizado condicional para el estado de carga (solo si estamos cargando una campaña existente)
  if (loading && (id && id !== 'crear')) { 
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando campaña...</span>
        </div>
        <p>Cargando datos de la campaña para edición...</p>
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
        <Link to="/campanas" className="btn btn-secondary mt-3">Volver a Campañas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>{ (id && id !== 'crear') ? 'Editar Campaña' : 'Crear Nueva Campaña'}</h3> 
      <hr />
      {error && isSubmitting && ( // Muestra error si hubo un problema al enviar el formulario
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <FormularioCampana
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode={!!id && id !== 'crear'} // Le indicamos al componente presentacional si es modo edición
      />
    </div>
  );
}

export default FormularioCampanaPage;

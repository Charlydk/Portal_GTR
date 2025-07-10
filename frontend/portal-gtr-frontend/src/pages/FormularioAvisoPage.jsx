// src/pages/FormularioAvisoPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Your API base URL
import FormularioAviso from '../components/FormularioAviso'; // Import the presentational component

function FormularioAvisoPage() {
  const { id } = useParams(); // Get ID if in edit mode
  const navigate = useNavigate(); // For redirection after saving

  const [loading, setLoading] = useState(true); // Loading state for edit mode
  const [error, setError] = useState(null); // State for loading or submission errors
  const [isSubmitting, setIsSubmitting] = useState(false); // State for form submission

  const [analistas, setAnalistas] = useState([]); // List of analysts for dropdown
  const [campanas, setCampanas] = useState([]);   // List of campaigns for dropdown

  // Form data state
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    fecha_vencimiento: '', // Format YYYY-MM-DDTHH:mm for datetime-local
    creador_id: '',
    campana_id: '' // Optional, can be empty string
  });

  // Effect to load notice data if in edit mode, and fetch analysts/campaigns
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch analysts
        const analistasResponse = await fetch(`${API_BASE_URL}/analistas/`);
        if (!analistasResponse.ok) {
          throw new Error(`Error al cargar analistas: ${analistasResponse.statusText}`);
        }
        const analistasData = await analistasResponse.json();
        setAnalistas(analistasData);

        // Fetch campaigns
        const campanasResponse = await fetch(`${API_BASE_URL}/campanas/`);
        if (!campanasResponse.ok) {
          throw new Error(`Error al cargar campañas: ${campanasResponse.statusText}`);
        }
        const campanasData = await campanasResponse.json();
        setCampanas(campanasData);

        // If in edit mode (id is a number and not 'crear')
        if (id && id !== 'crear') {
          const avisoId = parseInt(id);
          if (isNaN(avisoId)) {
            throw new Error("ID de aviso inválido para edición.");
          }
          const avisoResponse = await fetch(`${API_BASE_URL}/avisos/${avisoId}`);
          if (!avisoResponse.ok) {
            if (avisoResponse.status === 404) {
              throw new Error("Aviso no encontrado para edición.");
            }
            throw new Error(`Error al cargar el aviso para edición: ${avisoResponse.statusText}`);
          }
          const data = await avisoResponse.json();
          
          // Format dates for datetime-local input
          const formatDateTimeForInput = (isoString) => {
            if (!isoString) return '';
            const dt = new Date(isoString);
            const year = dt.getFullYear();
            const month = (dt.getMonth() + 1).toString().padStart(2, '0');
            const day = dt.getDate().toString().padStart(2, '0');
            const hours = dt.getHours().toString().padStart(2, '0');
            const minutes = dt.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          };

          setFormData({
            titulo: data.titulo,
            contenido: data.contenido,
            fecha_vencimiento: formatDateTimeForInput(data.fecha_vencimiento),
            creador_id: data.creador_id,
            campana_id: data.campana_id || '' // Ensure it's empty string if null
          });
        }
      } catch (err) {
        console.error("Error fetching data for FormularioAvisoPage:", err);
        setError(err.message || "No se pudo cargar los datos necesarios para el formulario.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setIsSubmitting(true); // Indicate submission started
    setError(null);       // Clear previous errors

    const method = (id && id !== 'crear') ? 'PUT' : 'POST'; // Determine HTTP method
    const url = (id && id !== 'crear') ? `${API_BASE_URL}/avisos/${id}` : `${API_BASE_URL}/avisos/`;

    // Prepare data for submission
    const dataToSend = {
      ...formData,
      creador_id: parseInt(formData.creador_id), // Ensure creator_id is integer
      campana_id: formData.campana_id ? parseInt(formData.campana_id) : null, // Ensure campaign_id is integer or null
      fecha_vencimiento: formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento).toISOString() : null,
    };

    // Remove empty fields for PUT requests to leverage FastAPI's exclude_unset
    if (method === 'PUT') {
      for (const key in dataToSend) {
        if (dataToSend[key] === null || dataToSend[key] === '') {
          delete dataToSend[key];
        }
      }
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend), // Send form data as JSON
      });

      if (!response.ok) {
        const errorData = await response.json(); // Try to read error message from backend
        if (response.status === 422 && errorData.detail) {
          const validationErrors = errorData.detail.map(err => {
            const field = err.loc[err.loc.length - 1];
            return `${field}: ${err.msg}`;
          }).join('\n');
          throw new Error(`Errores de validación:\n${validationErrors}`);
        }
        throw new Error(errorData.detail || `Error al guardar el aviso: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`Aviso ${method === 'PUT' ? 'actualizado' : 'creado'} con éxito: ${result.titulo}`);
      navigate('/avisos'); // Redirect to notices list after saving
    } catch (err) {
      console.error("Error al guardar el aviso:", err);
      setError(err.message || "No se pudo guardar el aviso. Intente de nuevo.");
    } finally {
      setIsSubmitting(false); // Indicate submission finished
    }
  };

  // Conditional rendering for loading state
  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando formulario...</span>
        </div>
        <p>Cargando datos necesarios para el aviso...</p>
      </div>
    );
  }

  // Conditional rendering for errors
  if (error && !isSubmitting) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/avisos" className="btn btn-secondary mt-3">Volver a Avisos</Link>
      </div>
    );
  }

  const isEditMode = !!id && id !== 'crear';

  return (
    <div className="container mt-4">
      <h3>{isEditMode ? 'Editar Aviso' : 'Crear Nuevo Aviso'}</h3>
      <hr />
      {error && isSubmitting && ( // Show error if there was a submission problem
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <FormularioAviso
        formData={formData}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        analistas={analistas}
        campanas={campanas}
      />
    </div>
  );
}

export default FormularioAvisoPage;

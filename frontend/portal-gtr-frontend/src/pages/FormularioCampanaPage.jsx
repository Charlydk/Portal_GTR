// src/pages/FormularioCampanaPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

function FormularioCampanaPage() {
  const { id } = useParams(); // Para saber si estamos editando
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { authToken } = useAuth(); // Obtiene authToken del contexto

  // Efecto para cargar los datos de la campaña si estamos editando
  useEffect(() => {
    const fetchCampana = async () => {
      if (!id) { // Si no hay ID, es una creación, no necesitamos cargar datos
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/campanas/${id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`, // Envía el token
          },
        });
        if (!response.ok) {
          throw new Error(`Error al cargar la campaña: ${response.statusText}`);
        }
        const data = await response.json();
        setFormData({
          nombre: data.nombre,
          descripcion: data.descripcion || '',
          // Formatear fechas para los inputs de tipo datetime-local
          fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio).toISOString().slice(0, 16) : '',
          fecha_fin: data.fecha_fin ? new Date(data.fecha_fin).toISOString().slice(0, 16) : ''
        });
      } catch (err) {
        console.error("Error al cargar la campaña:", err);
        setError(err.message || "No se pudo cargar la información de la campaña.");
      } finally {
        setLoading(false);
      }
    };

    if (authToken) { // Solo intenta cargar si hay token
      fetchCampana();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para gestionar campañas.");
    }
  }, [id, authToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `${API_BASE_URL}/campanas/${id}` : `${API_BASE_URL}/campanas/`;

      const dataToSend = {
        ...formData,
        // Convertir fechas de string a objetos Date si no están vacías
        fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
        fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 422 && errorData.detail) {
          const validationErrors = errorData.detail.map(err => {
            const field = err.loc[err.loc.length - 1];
            return `${field}: ${err.msg}`;
          }).join('\n');
          throw new Error(`Errores de validación:\n${validationErrors}`);
        }
        throw new Error(errorData.detail || `Error al ${id ? 'actualizar' : 'crear'} campaña: ${response.statusText}`);
      }

      alert(`Campaña ${id ? 'actualizada' : 'creada'} con éxito.`);
      navigate('/campanas'); // Redirige a la lista de campañas
    } catch (err) {
      console.error(`Error al ${id ? 'actualizar' : 'crear'} campaña:`, err);
      setError(err.message || `No se pudo ${id ? 'actualizar' : 'crear'} la campaña.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando formulario...</span>
        </div>
        <p>Cargando información de la campaña...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
        <button onClick={() => navigate('/campanas')} className="btn btn-secondary mt-3">Volver a Campañas</button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">{id ? 'Editar Campaña' : 'Crear Nueva Campaña'}</h2>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="nombreInput" className="form-label">Nombre:</label>
          <input
            type="text"
            className="form-control rounded-md"
            id="nombreInput"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="descripcionInput" className="form-label">Descripción:</label>
          <textarea
            className="form-control rounded-md"
            id="descripcionInput"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows="3"
            disabled={isSubmitting}
          ></textarea>
        </div>
        <div className="mb-3">
          <label htmlFor="fechaInicioInput" className="form-label">Fecha de Inicio:</label>
          <input
            type="datetime-local"
            className="form-control rounded-md"
            id="fechaInicioInput"
            name="fecha_inicio"
            value={formData.fecha_inicio}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="fechaFinInput" className="form-label">Fecha de Fin (Opcional):</label>
          <input
            type="datetime-local"
            className="form-control rounded-md"
            id="fechaFinInput"
            name="fecha_fin"
            value={formData.fecha_fin}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>
        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-primary rounded-md" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (id ? 'Actualizar Campaña' : 'Crear Campaña')}
          </button>
          <button type="button" onClick={() => navigate('/campanas')} className="btn btn-secondary rounded-md">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormularioCampanaPage;

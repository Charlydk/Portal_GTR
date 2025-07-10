// src/pages/FormularioAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext'; // Importa useAuth

function FormularioAvisoPage() {
  const { id } = useParams(); // Para saber si estamos editando
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    fecha_vencimiento: '',
    creador_id: '',
    campana_id: ''
  });
  const [analistas, setAnalistas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { authToken } = useAuth(); // Obtiene authToken del contexto

  const fetchDependencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Obtener analistas
      const analistasResponse = await fetch(`${API_BASE_URL}/analistas/`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!analistasResponse.ok) throw new Error(`Error al cargar analistas: ${analistasResponse.statusText}`);
      const analistasData = await analistasResponse.json();
      setAnalistas(analistasData);

      // Obtener campañas
      const campanasResponse = await fetch(`${API_BASE_URL}/campanas/`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!campanasResponse.ok) throw new Error(`Error al cargar campañas: ${campanasResponse.statusText}`);
      const campanasData = await campanasResponse.json();
      setCampanas(campanasData);

      // Si estamos editando, cargar datos del aviso
      if (id) {
        const avisoResponse = await fetch(`${API_BASE_URL}/avisos/${id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!avisoResponse.ok) throw new Error(`Error al cargar el aviso: ${avisoResponse.statusText}`);
        const avisoData = await avisoResponse.json();
        setFormData({
          titulo: avisoData.titulo,
          contenido: avisoData.contenido || '',
          fecha_vencimiento: avisoData.fecha_vencimiento ? new Date(avisoData.fecha_vencimiento).toISOString().slice(0, 16) : '',
          creador_id: avisoData.creador_id.toString(),
          campana_id: avisoData.campana_id ? avisoData.campana_id.toString() : '' // Puede ser opcional
        });
      }
    } catch (err) {
      console.error("Error al cargar dependencias de aviso:", err);
      setError(err.message || "No se pudieron cargar los datos necesarios.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]);

  useEffect(() => {
    if (authToken) {
      fetchDependencies();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para gestionar avisos.");
    }
  }, [authToken, fetchDependencies]);

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
      const url = id ? `${API_BASE_URL}/avisos/${id}` : `${API_BASE_URL}/avisos/`;

      const dataToSend = {
        ...formData,
        creador_id: parseInt(formData.creador_id),
        campana_id: formData.campana_id ? parseInt(formData.campana_id) : null, // Puede ser null
        fecha_vencimiento: formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento).toISOString() : null,
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
        throw new Error(errorData.detail || `Error al ${id ? 'actualizar' : 'crear'} aviso: ${response.statusText}`);
      }

      alert(`Aviso ${id ? 'actualizado' : 'creado'} con éxito.`);
      navigate('/avisos'); // Redirige a la lista de avisos
    } catch (err) {
      console.error(`Error al ${id ? 'actualizar' : 'crear'} aviso:`, err);
      setError(err.message || `No se pudo ${id ? 'actualizar' : 'crear'} el aviso.`);
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
        <p>Cargando información del aviso...</p>
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
        <button onClick={() => navigate('/avisos')} className="btn btn-secondary mt-3">Volver a Avisos</button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">{id ? 'Editar Aviso' : 'Crear Nuevo Aviso'}</h2>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="tituloInput" className="form-label">Título:</label>
          <input
            type="text"
            className="form-control rounded-md"
            id="tituloInput"
            name="titulo"
            value={formData.titulo}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="contenidoInput" className="form-label">Contenido:</label>
          <textarea
            className="form-control rounded-md"
            id="contenidoInput"
            name="contenido"
            value={formData.contenido}
            onChange={handleChange}
            rows="5"
            required
            disabled={isSubmitting}
          ></textarea>
        </div>
        <div className="mb-3">
          <label htmlFor="fechaVencimientoInput" className="form-label">Fecha de Vencimiento (Opcional):</label>
          <input
            type="datetime-local"
            className="form-control rounded-md"
            id="fechaVencimientoInput"
            name="fecha_vencimiento"
            value={formData.fecha_vencimiento}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="creadorSelect" className="form-label">Creador:</label>
          <select
            className="form-select rounded-md"
            id="creadorSelect"
            name="creador_id"
            value={formData.creador_id}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          >
            <option value="">Seleccione un creador</option>
            {analistas.map(analista => (
              <option key={analista.id} value={analista.id}>
                {analista.nombre} {analista.apellido} (BMS ID: {analista.bms_id})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="campanaSelect" className="form-label">Campaña Asociada (Opcional):</label>
          <select
            className="form-select rounded-md"
            id="campanaSelect"
            name="campana_id"
            value={formData.campana_id}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            <option value="">Ninguna</option>
            {campanas.map(campana => (
              <option key={campana.id} value={campana.id}>
                {campana.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-primary rounded-md" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (id ? 'Actualizar Aviso' : 'Crear Aviso')}
          </button>
          <button type="button" onClick={() => navigate('/avisos')} className="btn btn-secondary rounded-md">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormularioAvisoPage;

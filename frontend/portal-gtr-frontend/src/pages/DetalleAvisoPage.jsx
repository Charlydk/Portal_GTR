// src/pages/DetalleAvisoPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Your API base URL
import DetalleAviso from '../components/DetalleAviso'; // Import the presentational component
import ListaAcusesRecibo from '../components/ListaAcusesRecibo'; // Import the new component for acknowledgements

function DetalleAvisoPage() {
  const { id } = useParams(); // Get notice ID from URL
  const [aviso, setAviso] = useState(null);
  const [acusesRecibo, setAcusesRecibo] = useState([]); // New state for acknowledgements
  const [analistas, setAnalistas] = useState([]); // List of analysts for the acknowledgement dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingAcuse, setIsSubmittingAcuse] = useState(false); // For acknowledgement submission state

  // State for the new acknowledgement form
  const [newAcuseFormData, setNewAcuseFormData] = useState({
    analista_id: '' // Will be filled with the selected analyst's ID
  });

  // Función para obtener el aviso, sus acuses de recibo y la lista de analistas
  const fetchAvisoAndAcuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const avisoId = parseInt(id); // Aseguramos que el ID sea numérico
      if (isNaN(avisoId)) {
        throw new Error("ID de aviso inválido.");
      }

      // 1. Obtener los detalles del aviso
      const avisoResponse = await fetch(`${API_BASE_URL}/avisos/${avisoId}`);
      if (!avisoResponse.ok) {
        if (avisoResponse.status === 404) {
          throw new Error("Aviso no encontrado.");
        }
        throw new Error(`Error al cargar el aviso: ${avisoResponse.statusText}`);
      }
      const avisoData = await avisoResponse.json();
      setAviso(avisoData);

      // 2. Obtener los acuses de recibo para este aviso
      const acusesResponse = await fetch(`${API_BASE_URL}/avisos/${avisoId}/acuses_recibo`);
      if (!acusesResponse.ok) {
        throw new Error(`Error al cargar los acuses de recibo: ${acusesResponse.statusText}`);
      }
      const acusesData = await acusesResponse.json();
      setAcusesRecibo(acusesData);

      // 3. Obtener la lista de analistas (para el selector de acuses de recibo)
      const analistasResponse = await fetch(`${API_BASE_URL}/analistas/`);
      if (!analistasResponse.ok) {
        throw new Error(`Error al cargar los analistas: ${analistasResponse.statusText}`);
      }
      const analistasData = await analistasResponse.json();
      setAnalistas(analistasData);

    } catch (err) {
      console.error("Error al cargar el aviso o acuses de recibo:", err);
      setError(err.message || "No se pudo cargar la información del aviso.");
    } finally {
      setLoading(false);
    }
  }, [id]); // Dependencia del ID de la URL

  // Efecto para cargar los datos al montar el componente o cuando cambia el ID
  useEffect(() => {
    if (id) {
      fetchAvisoAndAcuses();
    } else {
      setLoading(false);
      setError("No se especificó un ID de aviso.");
    }
  }, [id, fetchAvisoAndAcuses]);

  // Manejador de cambios para el formulario de nuevo acuse de recibo
  const handleNewAcuseChange = (e) => {
    const { name, value } = e.target;
    setNewAcuseFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejador de envío para el formulario de nuevo acuse de recibo
  const handleNewAcuseSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingAcuse(true);
    setError(null);

    try {
      // Validar que el analista_id no esté vacío antes de enviar
      if (!newAcuseFormData.analista_id) {
        throw new Error("Por favor, seleccione un analista para el acuse de recibo.");
      }

      const dataToSend = {
        analista_id: parseInt(newAcuseFormData.analista_id), // Aseguramos que sea un entero
      };
      
      // Verificación adicional para asegurar que los IDs son números válidos
      if (isNaN(dataToSend.analista_id)) {
        throw new Error("ID de analista inválido. Por favor, seleccione un analista válido.");
      }

      // --- ¡DEBUGGING LOGS ! ---
      console.log("DEBUG: newAcuseFormData.analista_id (original):", newAcuseFormData.analista_id);
      console.log("DEBUG: dataToSend.analista_id (parseado):", dataToSend.analista_id);
      console.log("DEBUG: dataToSend (objeto completo a enviar):", dataToSend);
      // --- FIN DEBUGGING LOGS ---

      const response = await fetch(`${API_BASE_URL}/avisos/${id}/acuse_recibo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend), // Envía los datos del formulario en formato JSON
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
        throw new Error(errorData.detail || `Error al registrar acuse de recibo: ${response.statusText}`);
      }

      alert('Acuse de recibo registrado con éxito.');
      setNewAcuseFormData({ analista_id: '' }); // Limpiar formulario
      fetchAvisoAndAcuses(); // Recargar acuses de recibo para ver el nuevo
    } catch (err) {
      console.error("Error al registrar acuse de recibo:", err);
      setError(err.message || "No se pudo registrar el acuse de recibo. Intente de nuevo.");
    } finally {
      setIsSubmittingAcuse(false);
    }
  };

  // Función auxiliar para formatear fechas
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoString).toLocaleDateString('es-ES', options);
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando aviso...</span>
        </div>
        <p>Cargando detalles del aviso y sus acuses de recibo...</p>
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

  return (
    <div className="container mt-4">
      <h3>Detalles del Aviso: {aviso.titulo}</h3>
      <hr />
      <p><strong>ID:</strong> {aviso.id}</p>
      <p><strong>Título:</strong> {aviso.titulo}</p>
      <p><strong>Contenido:</strong> {aviso.contenido}</p>
      <p><strong>Fecha de Vencimiento:</strong> {formatDateTime(aviso.fecha_vencimiento)}</p>
      <p><strong>Creador:</strong> {aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : `ID: ${aviso.creador_id}`}</p>
      <p><strong>Campaña Asociada:</strong> {aviso.campana ? aviso.campana.nombre : 'N/A'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(aviso.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/avisos" className="btn btn-secondary me-2">Volver a la lista de Avisos</Link>
        <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning">Editar Aviso</Link>
      </div>

      {/* Sección de Acuses de Recibo */}
      <h4 className="mt-5">Acuses de Recibo</h4>
      <hr />
      {error && isSubmittingAcuse && ( // Show error if there was a submission problem
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleNewAcuseSubmit} className="mb-4">
        <div className="mb-3">
          <label htmlFor="analista_id_acuse" className="form-label">Acusar recibo como:</label>
          <select
            className="form-select"
            id="analista_id_acuse"
            name="analista_id"
            value={newAcuseFormData.analista_id}
            onChange={handleNewAcuseChange}
            required
          >
            <option value="">Seleccione un analista</option>
            {analistas.map((analista) => (
              <option key={analista.id} value={analista.id}>
                {analista.nombre} {analista.apellido} (BMS ID: {analista.bms_id})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-success" disabled={isSubmittingAcuse}>
          {isSubmittingAcuse ? 'Registrando...' : 'Registrar Acuse de Recibo'}
        </button>
      </form>

      <ListaAcusesRecibo acusesRecibo={acusesRecibo} />
    </div>
  );
}

export default DetalleAvisoPage;

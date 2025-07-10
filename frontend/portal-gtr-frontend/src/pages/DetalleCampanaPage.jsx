// src/pages/DetalleCampanaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Tu URL base de la API
import ListaComentariosCampana from '../components/ListaComentariosCampana'; // Importamos el componente para listar comentarios
import FormularioComentarioCampana from '../components/FormularioComentarioCampana'; // Importamos el formulario de comentarios

function DetalleCampanaPage() {
  const { id } = useParams(); // Obtiene el ID de la campaña de la URL
  const [campana, setCampana] = useState(null);
  const [comentarios, setComentarios] = useState([]); // Estado para los comentarios de la campaña
  const [analistas, setAnalistas] = useState([]); // Estado para la lista de analistas (para el selector)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false); // Para el estado de envío del formulario de comentario

  // Estado para el formulario de nuevo comentario
  const [newCommentFormData, setNewCommentFormData] = useState({
    contenido: '',
    analista_id: '' // Se llenará con el ID del analista seleccionado
  });

  // Función para obtener la campaña, sus comentarios y la lista de analistas
  const fetchCampanaAndComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const campanaId = parseInt(id); // Aseguramos que el ID sea numérico
      if (isNaN(campanaId)) {
        throw new Error("ID de campaña inválido.");
      }

      // 1. Obtener los detalles de la campaña
      const campanaResponse = await fetch(`${API_BASE_URL}/campanas/${campanaId}`);
      if (!campanaResponse.ok) {
        if (campanaResponse.status === 404) {
          throw new Error("Campaña no encontrada.");
        }
        throw new Error(`Error al cargar la campaña: ${campanaResponse.statusText}`);
      }
      const campanaData = await campanaResponse.json();
      setCampana(campanaData);

      // 2. Obtener los comentarios asociados a esta campaña
      const comentariosResponse = await fetch(`${API_BASE_URL}/comentarios_campana/?campana_id=${campanaId}`);
      if (!comentariosResponse.ok) {
        throw new Error(`Error al cargar los comentarios: ${comentariosResponse.statusText}`);
      }
      const comentariosData = await comentariosResponse.json();
      setComentarios(comentariosData);

      // 3. Obtener la lista de analistas (para el selector de comentarios)
      const analistasResponse = await fetch(`${API_BASE_URL}/analistas/`);
      if (!analistasResponse.ok) {
        throw new Error(`Error al cargar los analistas: ${analistasResponse.statusText}`);
      }
      const analistasData = await analistasResponse.json();
      setAnalistas(analistasData);

    } catch (err) {
      console.error("Error al cargar la campaña, comentarios o analistas:", err);
      setError(err.message || "No se pudo cargar la información de la campaña.");
    } finally {
      setLoading(false);
    }
  }, [id]); // Dependencia del ID de la URL

  // Efecto para cargar los datos al montar el componente o cuando cambia el ID
  useEffect(() => {
    if (id) {
      fetchCampanaAndComments();
    } else {
      setLoading(false);
      setError("No se especificó un ID de campaña.");
    }
  }, [id, fetchCampanaAndComments]);

  // Manejador de cambios para el formulario de nuevo comentario
  const handleNewCommentChange = (e) => {
    const { name, value } = e.target;
    setNewCommentFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejador de envío para el formulario de nuevo comentario
  const handleNewCommentSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingComment(true);
    setError(null);

    try {
      // Validar que el analista_id no esté vacío antes de enviar
      if (!newCommentFormData.analista_id) {
        throw new Error("Por favor, seleccione un analista para el comentario.");
      }

      // Construcción explícita del objeto a enviar
      const dataToSend = {
        contenido: newCommentFormData.contenido,
        analista_id: parseInt(newCommentFormData.analista_id), // Aseguramos que sea un entero
        campana_id: parseInt(id), // Aseguramos que sea un entero
      };
      
      // Verificación adicional para asegurar que los IDs son números válidos
      if (isNaN(dataToSend.analista_id)) {
        throw new Error("ID de analista inválido. Por favor, seleccione un analista válido.");
      }
      if (isNaN(dataToSend.campana_id)) {
        throw new Error("ID de campaña inválido. No se pudo asociar el comentario.");
      }

      const response = await fetch(`${API_BASE_URL}/comentarios_campana/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend), // Envía los datos del formulario en formato JSON
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Mejorar el mensaje de error para mostrar los detalles de validación de FastAPI
        if (response.status === 422 && errorData.detail) {
          const validationErrors = errorData.detail.map(err => {
            // err.loc es un array, el último elemento suele ser el nombre del campo
            const field = err.loc[err.loc.length - 1]; 
            return `${field}: ${err.msg}`;
          }).join('\n');
          throw new Error(`Errores de validación:\n${validationErrors}`);
        }
        throw new Error(errorData.detail || `Error al agregar comentario: ${response.statusText}`);
      }

      alert('Comentario agregado con éxito.');
      setNewCommentFormData({ contenido: '', analista_id: '' }); // Limpiar formulario
      fetchCampanaAndComments(); // Recargar comentarios para ver el nuevo
    } catch (err) {
      console.error("Error al agregar comentario:", err);
      setError(err.message || "No se pudo agregar el comentario. Intente de nuevo.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Manejar la eliminación de un comentario
  const handleDeleteComentario = async (comentarioId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/comentarios_campana/${comentarioId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      alert('Comentario eliminado con éxito.');
      fetchCampanaAndComments(); // Volver a cargar los comentarios para actualizar la lista
    } catch (err) {
      console.error("Error al eliminar el comentario:", err);
      setError(err.message || "No se pudo eliminar el comentario. Intente de nuevo.");
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
          <span className="visually-hidden">Cargando campaña...</span>
        </div>
        <p>Cargando detalles de la campaña y sus comentarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/campanas" className="btn btn-secondary mt-3">Volver a Campañas</Link>
      </div>
    );
  }

  if (!campana) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          La campaña no pudo ser cargada o no existe.
        </div>
        <Link to="/campanas" className="btn btn-secondary mt-3">Volver a Campañas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles de la Campaña: {campana.nombre}</h3>
      <hr />
      <p><strong>ID:</strong> {campana.id}</p>
      <p><strong>Nombre:</strong> {campana.nombre}</p>
      <p><strong>Descripción:</strong> {campana.descripcion || 'N/A'}</p>
      <p><strong>Fecha de Inicio:</strong> {formatDateTime(campana.fecha_inicio)}</p>
      <p><strong>Fecha de Fin:</strong> {formatDateTime(campana.fecha_fin)}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(campana.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/campanas" className="btn btn-secondary me-2">Volver a la lista de Campañas</Link>
        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">Editar Campaña</Link>
      </div>

      {/* Sección de Comentarios */}
      <h4 className="mt-5">Comentarios</h4>
      <hr />
      {error && isSubmittingComment && ( // Muestra error si hubo un problema al enviar el formulario
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <FormularioComentarioCampana
        formData={newCommentFormData}
        handleChange={handleNewCommentChange}
        handleSubmit={handleNewCommentSubmit}
        isSubmitting={isSubmittingComment}
        analistas={analistas} // Pasamos la lista de analistas para el selector
      />
      <ListaComentariosCampana
        comentarios={comentarios}
        onDeleteComentario={handleDeleteComentario}
      />
    </div>
  );
}

export default DetalleCampanaPage;

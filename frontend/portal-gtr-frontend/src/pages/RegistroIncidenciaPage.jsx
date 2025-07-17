// frontend/portal-gtr-frontend/src/pages/RegistroIncidenciaPage.jsx
import React, { useState } from 'react';
// Importa el hook useNavigate si quieres redirigir después de enviar
import { useNavigate } from 'react-router-dom'; 

const RegistroIncidenciaPage = () => {
  // Usamos useState para manejar el estado de cada campo del formulario
  const [comentario, setComentario] = useState('');
  const [horario, setHorario] = useState(''); // Estado para el horario seleccionado
  const [tipoIncidencia, setTipoIncidencia] = useState('tecnica'); // Valor por defecto
  const navigate = useNavigate(); // Para redirigir después de enviar

  // Función para generar las opciones de horario (cada 30 minutos)
  const generarOpcionesHorario = () => {
    const opciones = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hora = h.toString().padStart(2, '0'); // Asegura dos dígitos (ej. 01)
        const minuto = m.toString().padStart(2, '0'); // Asegura dos dígitos (ej. 00 o 30)
        opciones.push(`${hora}:${minuto}`);
      }
    }
    return opciones;
  };

  // Manejador del envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario (recargar la página)

    // Aquí iría la lógica para enviar los datos al backend
    const nuevaIncidencia = {
      comentario,
      horario,
      tipoIncidencia,
      // Podrías añadir fecha, usuario que registra, etc.
      fecha: new Date().toISOString().split('T')[0], // Ejemplo: "YYYY-MM-DD"
      registrador: 'UsuarioActual', // Esto vendría del contexto de autenticación
    };

    console.log('Datos de la incidencia a enviar:', nuevaIncidencia);

    // --- LÓGICA DE ENVÍO AL BACKEND (se implementará más adelante) ---
    // Ejemplo de fetch (no funcional sin backend):
    /*
    fetch('/api/incidencias', { // Asume que tu backend tiene este endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${tokenDeUsuario}`, // Si tienes autenticación
      },
      body: JSON.stringify(nuevaIncidencia),
    })
    .then(response => response.json())
    .then(data => {
      console.log('Incidencia registrada con éxito:', data);
      alert('Incidencia registrada con éxito!');
      // Redirigir o limpiar formulario
      navigate('/incidencias'); // O a otra página después de registrar
    })
    .catch(error => {
      console.error('Error al registrar incidencia:', error);
      alert('Hubo un error al registrar la incidencia.');
    });
    */
    // ------------------------------------------------------------------

    // Limpiar formulario (opcional, si no se redirige)
    setComentario('');
    setHorario('');
    setTipoIncidencia('tecnica');
  };

  return (
    <div className="registro-incidencia-container">
      <h2>Registrar Nueva Incidencia</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="comentario" style={{ display: 'block', marginBottom: '5px' }}>Comentario Breve:</label>
          <textarea
            id="comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            rows="4"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="horario" style={{ display: 'block', marginBottom: '5px' }}>Horario:</label>
          <select
            id="horario"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            <option value="">Selecciona un horario</option>
            {generarOpcionesHorario().map((hora) => (
              <option key={hora} value={hora}>{hora}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="tipoIncidencia" style={{ display: 'block', marginBottom: '5px' }}>Tipo de Incidencia:</label>
          <select
            id="tipoIncidencia"
            value={tipoIncidencia}
            onChange={(e) => setTipoIncidencia(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            <option value="tecnica">Técnica</option>
            <option value="operativa">Operativa</option>
            <option value="otra">Otra</option>
          </select>
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Registrar Incidencia
        </button>
      </form>
    </div>
  );
};

export default RegistroIncidenciaPage;
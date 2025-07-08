// src/components/FormularioTarea.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Para redirigir después de guardar

function FormularioTarea({ tareaInicial = null }) {
  const navigate = useNavigate();

  // Estados para los datos del formulario
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    analista_id: '',
    campana_id: '',
    progreso: 'PENDIENTE', // Valor por defecto
    fecha_vencimiento: '',
    checklist_items: [], // Array para los items del checklist
  });

  // Estados para los datos de prueba de los selects (Analistas, Campañas)
  const [analistas, setAnalistas] = useState([
    { id: 1, nombre: 'Juan Pérez' },
    { id: 2, nombre: 'María González' },
    { id: 3, nombre: 'Laura Martínez' },
  ]);

  const [campanas, setCampanas] = useState([
    { id: 1, nombre: 'Campaña General' },
    { id: 2, nombre: 'Campaña Leads' },
    { id: 3, nombre: 'Campaña Verano' },
    { id: 4, nombre: 'Campaña Redes' },
  ]);

  const [progresoOpciones] = useState([
    'PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA'
  ]);

  // Efecto para cargar los datos de la tarea si estamos editando
  useEffect(() => {
    if (tareaInicial) {
      setFormData({
        titulo: tareaInicial.titulo || '',
        descripcion: tareaInicial.descripcion || '',
        analista_id: tareaInicial.analista_id ? String(tareaInicial.analista_id) : '', // Convertir a string para select
        campana_id: tareaInicial.campana_id ? String(tareaInicial.campana_id) : '', // Convertir a string para select
        progreso: tareaInicial.progreso || 'PENDIENTE',
        fecha_vencimiento: tareaInicial.fecha_vencimiento || '',
        checklist_items: tareaInicial.checklist_items || [],
      });
    }
  }, [tareaInicial]);

  // Manejador de cambios para los campos de texto y selects
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Manejadores para los checklist items
  const handleChecklistItemChange = (index, e) => {
    const newChecklistItems = [...formData.checklist_items];
    newChecklistItems[index] = { ...newChecklistItems[index], descripcion: e.target.value };
    setFormData(prevData => ({
      ...prevData,
      checklist_items: newChecklistItems
    }));
  };

  const handleAddChecklistItem = () => {
    setFormData(prevData => ({
      ...prevData,
      checklist_items: [...prevData.checklist_items, { id: Date.now(), descripcion: '', completado: false }]
    }));
  };

  const handleRemoveChecklistItem = (idToRemove) => {
    setFormData(prevData => ({
      ...prevData,
      checklist_items: prevData.checklist_items.filter(item => item.id !== idToRemove)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Datos a enviar:', formData);
    // Aquí iría la lógica para enviar los datos a tu API (POST para crear, PUT para editar)

    // Simulación de guardado y redirección
    alert(`Tarea ${tareaInicial ? 'actualizada' : 'creada'} con éxito (simulado)!`);
    navigate('/tareas'); // Redirige de vuelta a la lista de tareas
  };

  return (
    <div className="container mt-4">
      <h3>{tareaInicial ? 'Editar Tarea' : 'Crear Nueva Tarea'}</h3>
      <div className="card p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="titulo" className="form-label">Título:</label>
            <input
              type="text"
              className="form-control"
              id="titulo"
              name="titulo"
              value={formData.titulo}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="descripcion" className="form-label">Descripción:</label>
            <textarea
              className="form-control"
              id="descripcion"
              name="descripcion"
              rows="3"
              value={formData.descripcion}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="analista_id" className="form-label">Analista Asignado:</label>
              <select
                className="form-select"
                id="analista_id"
                name="analista_id"
                value={formData.analista_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione un analista</option>
                {analistas.map(analista => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="campana_id" className="form-label">Campaña:</label>
              <select
                className="form-select"
                id="campana_id"
                name="campana_id"
                value={formData.campana_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione una campaña</option>
                {campanas.map(campana => (
                  <option key={campana.id} value={campana.id}>
                    {campana.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="progreso" className="form-label">Progreso:</label>
              <select
                className="form-select"
                id="progreso"
                name="progreso"
                value={formData.progreso}
                onChange={handleChange}
              >
                {progresoOpciones.map(opcion => (
                  <option key={opcion} value={opcion}>
                    {opcion.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="fecha_vencimiento" className="form-label">Fecha de Vencimiento:</label>
              <input
                type="date"
                className="form-control"
                id="fecha_vencimiento"
                name="fecha_vencimiento"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
              />
            </div>
          </div>

          <hr />

          <h5>Checklist Items:</h5>
          {formData.checklist_items.map((item, index) => (
            <div key={item.id} className="input-group mb-2">
              <input
                type="text"
                className="form-control"
                placeholder="Descripción del item"
                value={item.descripcion}
                onChange={(e) => handleChecklistItemChange(index, e)}
                required
              />
              <button
                className="btn btn-outline-danger"
                type="button"
                onClick={() => handleRemoveChecklistItem(item.id)}
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary mb-3"
            onClick={handleAddChecklistItem}
          >
            Agregar Item de Checklist
          </button>

          <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
            <button type="button" className="btn btn-secondary me-md-2" onClick={() => navigate('/tareas')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {tareaInicial ? 'Guardar Cambios' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioTarea;
// src/components/ListaTareas.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function ListaTareas() {
  // Datos de prueba (simulando lo que vendría de tu API)
  const [allTareas, setAllTareas] = useState([
    { id: 1, titulo: 'Revisar informe Q3', descripcion: 'Análisis de ventas del tercer trimestre.', progreso: 'EN_PROGRESO', fecha_vencimiento: '2025-07-15', analista_id: 1, analista_nombre: 'Juan Pérez', campana_id: 1, campana_nombre: 'Campaña General' },
    { id: 2, titulo: 'Actualizar base de datos de clientes', descripcion: 'Importar nuevos leads de la feria ExpoTech.', progreso: 'PENDIENTE', fecha_vencimiento: '2025-07-20', analista_id: 2, analista_nombre: 'María González', campana_id: 2, campana_nombre: 'Campaña Leads' },
    { id: 3, titulo: 'Planificar lanzamiento Campaña Verano', descripcion: 'Definir estrategia de marketing para la nueva temporada.', progreso: 'COMPLETADA', fecha_vencimiento: '2025-06-30', analista_id: 1, analista_nombre: 'Juan Pérez', campana_id: 3, campana_nombre: 'Campaña Verano' },
    { id: 4, titulo: 'Diseñar gráfica para aviso 001', descripcion: 'Diseño de banner para redes sociales.', progreso: 'BLOQUEADA', fecha_vencimiento: '2025-07-10', analista_id: 3, analista_nombre: 'Laura Martínez', campana_id: 4, campana_nombre: 'Campaña Redes' },
    { id: 5, titulo: 'Investigación de mercado Asia', descripcion: 'Análisis de competencia en el mercado asiático.', progreso: 'EN_PROGRESO', fecha_vencimiento: '2025-08-01', analista_id: 2, analista_nombre: 'María González', campana_id: 1, campana_nombre: 'Campaña General' },
  ]);

  // Datos de prueba para los selects de filtros (simulando lo que vendría de tu API)
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

  // Estados para guardar los valores seleccionados de los filtros
  const [filtroAnalista, setFiltroAnalista] = useState(''); // ID del analista, '' para "Todos"
  const [filtroCampana, setFiltroCampana] = useState('');   // ID de la campaña, '' para "Todas"
  const [filtroProgreso, setFiltroProgreso] = useState(''); // Estado de progreso, '' para "Todos"

  // Lógica de filtrado
  const tareasFiltradas = allTareas.filter(tarea => {
    const coincideAnalista = filtroAnalista ? tarea.analista_id === parseInt(filtroAnalista) : true;
    const coincideCampana = filtroCampana ? tarea.campana_id === parseInt(filtroCampana) : true;
    const coincideProgreso = filtroProgreso ? tarea.progreso === filtroProgreso : true;
    return coincideAnalista && coincideCampana && coincideProgreso;
  });

  return (
    <div className="container mt-4">
      <h3>Lista de Tareas</h3>

      {/* Sección de Filtros */}
      <div className="card mb-4 p-3 bg-light">
        <div className="row g-3">
          <div className="col-md-4">
            <label htmlFor="filtroAnalista" className="form-label">Analista:</label>
            <select
              id="filtroAnalista"
              className="form-select"
              value={filtroAnalista}
              onChange={(e) => setFiltroAnalista(e.target.value)}
            >
              <option value="">Todos</option>
              {analistas.map(analista => (
                <option key={analista.id} value={analista.id}>
                  {analista.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="filtroCampana" className="form-label">Campaña:</label>
            <select
              id="filtroCampana"
              className="form-select"
              value={filtroCampana}
              onChange={(e) => setFiltroCampana(e.target.value)}
            >
              <option value="">Todas</option>
              {campanas.map(campana => (
                <option key={campana.id} value={campana.id}>
                  {campana.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="filtroProgreso" className="form-label">Progreso:</label>
            <select
              id="filtroProgreso"
              className="form-select"
              value={filtroProgreso}
              onChange={(e) => setFiltroProgreso(e.target.value)}
            >
              <option value="">Todos</option>
              {progresoOpciones.map(progreso => (
                <option key={progreso} value={progreso}>
                  {progreso.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Tareas Filtradas */}
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Campaña</th>
              <th>Analista Asignado</th>
              <th>Progreso</th>
              <th>Fecha Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Ahora mapeamos sobre tareasFiltradas */}
            {tareasFiltradas.map(tarea => (
              <tr key={tarea.id}>
                <td>{tarea.id}</td>
                <td>{tarea.titulo}</td>
                <td>{tarea.campana_nombre}</td>
                <td>{tarea.analista_nombre}</td>
                <td>
                  <span className={`badge ${
                    tarea.progreso === 'PENDIENTE' ? 'text-bg-secondary' :
                    tarea.progreso === 'EN_PROGRESO' ? 'text-bg-info' :
                    tarea.progreso === 'COMPLETADA' ? 'text-bg-success' :
                    tarea.progreso === 'BLOQUEADA' ? 'text-bg-danger' : 'text-bg-light'
                  }`}>
                    {tarea.progreso.replace('_', ' ')}
                  </span>
                </td>
                <td>{tarea.fecha_vencimiento}</td>
                <td>
                  <Link to={`/tareas/${tarea.id}`} className="btn btn-sm btn-info me-2">
                    Ver
                  </Link>
                  <button className="btn btn-sm btn-warning">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tareasFiltradas.length === 0 && (
        <p className="text-center mt-3 text-muted">No se encontraron tareas que coincidan con los filtros.</p>
      )}
    </div>
  );
}

export default ListaTareas;
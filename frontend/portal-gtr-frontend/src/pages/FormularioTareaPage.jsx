// src/pages/FormularioTareaPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FormularioTarea from '../components/FormularioTarea';

function FormularioTareaPage() {
  const { id } = useParams(); // Obtiene el ID si estamos en /tareas/editar/:id
  const [tareaAEditar, setTareaAEditar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Datos de prueba con checklist_items (LOS MISMOS QUE EN DETALLETAREAPAGE Y LISTATAREAS, es crucial)
  const mockTareas = [
    { id: 1, titulo: 'Revisar informe Q3', descripcion: 'Análisis de ventas del tercer trimestre.', progreso: 'EN_PROGRESO', fecha_vencimiento: '2025-07-15', analista_id: 1, analista_nombre: 'Juan Pérez', campana_id: 1, campana_nombre: 'Campaña General', checklist_items: [
        { id: 101, descripcion: 'Recopilar datos de ventas', completado: true },
        { id: 102, descripcion: 'Analizar tendencias', completado: false },
        { id: 103, descripcion: 'Generar reporte ejecutivo', completado: false }
      ]
    },
    { id: 2, titulo: 'Actualizar base de datos de clientes', descripcion: 'Importar nuevos leads de la feria ExpoTech.', progreso: 'PENDIENTE', fecha_vencimiento: '2025-07-20', analista_id: 2, analista_nombre: 'María González', campana_id: 2, campana_nombre: 'Campaña Leads', checklist_items: [] },
    { id: 3, titulo: 'Planificar lanzamiento Campaña Verano', descripcion: 'Definir estrategia de marketing para la nueva temporada.', progreso: 'COMPLETADA', fecha_vencimiento: '2025-06-30', analista_id: 1, analista_nombre: 'Juan Pérez', campana_id: 3, campana_nombre: 'Campaña Verano', checklist_items: [
        { id: 104, descripcion: 'Definir público objetivo', completado: true },
        { id: 105, descripcion: 'Crear calendario de contenidos', completado: true }
      ]
    },
    { id: 4, titulo: 'Diseñar gráfica para aviso 001', descripcion: 'Diseño de banner para redes sociales.', progreso: 'BLOQUEADA', fecha_vencimiento: '2025-07-10', analista_id: 3, analista_nombre: 'Laura Martínez', campana_id: 4, campana_nombre: 'Campaña Redes', checklist_items: [
        { id: 106, descripcion: 'Recibir briefing del cliente', completado: true },
        { id: 107, descripcion: 'Proponer 3 opciones de diseño', completado: false }
      ]
    },
    { id: 5, titulo: 'Investigación de mercado Asia', descripcion: 'Análisis de competencia en el mercado asiático.', progreso: 'EN_PROGRESO', fecha_vencimiento: '2025-08-01', analista_id: 2, analista_nombre: 'María González', campana_id: 1, campana_nombre: 'Campaña General', checklist_items: [] },
  ];

  useEffect(() => {
    // Si hay un ID en la URL, estamos en modo edición
    if (id) {
      setLoading(true);
      setError(null);
      // Convertimos el ID de la URL a número entero para la comparación
      const foundTarea = mockTareas.find(t => t.id === parseInt(id));
      if (foundTarea) {
        setTareaAEditar(foundTarea);
      } else {
        setError("Tarea no encontrada para editar.");
      }
      setLoading(false);
    } else {
      // Si no hay ID, estamos creando una nueva tarea.
      // No necesitamos cargar ninguna tarea, solo asegurar que tareaAEditar sea null.
      setTareaAEditar(null);
      setLoading(false); // No hay carga, así que terminamos inmediatamente
    }
  }, [id]); // Este efecto se ejecuta cada vez que el ID de la URL cambia

  if (loading) {
    return <div className="container mt-4 text-center">Cargando formulario...</div>;
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button className="btn btn-secondary mt-3" onClick={() => window.history.back()}>Volver</button>
      </div>
    );
  }

  return (
    // Pasamos tareaAEditar al FormularioTarea. Si es null, será para crear. Si tiene datos, para editar.
    <FormularioTarea tareaInicial={tareaAEditar} />
  );
}

export default FormularioTareaPage;
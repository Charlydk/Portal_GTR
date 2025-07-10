// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnalistasPage from './pages/AnalistasPage';
import FormularioAnalistaPage from './pages/FormularioAnalistaPage';
import DetalleAnalistaPage from './pages/DetalleAnalistaPage';
import CampanasPage from './pages/CampanasPage';
import FormularioCampanaPage from './pages/FormularioCampanaPage';
import DetalleCampanaPage from './pages/DetalleCampanaPage';
import TareasPage from './pages/TareasPage';
import FormularioTareaPage from './pages/FormularioTareaPage';
import DetalleTareaPage from './pages/DetalleTareaPage';
import AvisosPage from './pages/AvisosPage';
import FormularioAvisoPage from './pages/FormularioAvisoPage';
import DetalleAvisoPage from './pages/DetalleAvisoPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import FormularioChecklistItemPage from './pages/FormularioChecklistItemPage'; // ¡NUEVO! Importa el formulario de checklist

import { AuthProvider, useAuth } from './context/AuthContext';

// Componente para rutas protegidas
const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p>Cargando usuario...</p>
      </div>
    );
  }

  if (!user) {
    // No autenticado, redirige al login
    return <Navigate to="/login" replace />;
  }

  // Verifica si el rol del usuario está entre los roles permitidos
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Autenticado pero sin el rol necesario, redirige a una página de acceso denegado o al dashboard
    return <Navigate to="/dashboard" replace />; // O a una página /acceso-denegado
  }

  return children;
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="App-content">
          <Routes>
            {/* Rutas de autenticación */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Ruta del Dashboard - accesible para todos los roles autenticados */}
            <Route path="/dashboard" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <DashboardPage />
              </PrivateRoute>
            } />

            {/* Rutas Protegidas por Rol (Ejemplos) */}
            {/* Analistas - La mayoría de las acciones de analistas solo para Supervisor/Responsable */}
            <Route path="/analistas" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <AnalistasPage />
              </PrivateRoute>
            } />
            <Route path="/analistas/crear" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioAnalistaPage />
              </PrivateRoute>
            } />
            <Route path="/analistas/editar/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioAnalistaPage />
              </PrivateRoute>
            } />
            {/* Un analista normal puede ver su propio detalle */}
            <Route path="/analistas/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <DetalleAnalistaPage />
              </PrivateRoute>
            } />


            {/* Campañas - Crear/Editar/Eliminar solo para Supervisor/Responsable */}
            <Route path="/campanas" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <CampanasPage />
              </PrivateRoute>
            } />
            <Route path="/campanas/crear" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioCampanaPage />
              </PrivateRoute>
            } />
            <Route path="/campanas/editar/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioCampanaPage />
              </PrivateRoute>
            } />
            <Route path="/campanas/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <DetalleCampanaPage />
              </PrivateRoute>
            } />

            {/* Tareas - Crear/Editar/Eliminar solo para Supervisor/Responsable */}
            <Route path="/tareas" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <TareasPage />
              </PrivateRoute>
            } />
            <Route path="/tareas/crear" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioTareaPage />
              </PrivateRoute>
            } />
            <Route path="/tareas/editar/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioTareaPage />
              </PrivateRoute>
            } />
            <Route path="/tareas/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <DetalleTareaPage />
              </PrivateRoute>
            } />

            {/* Rutas para Checklist Items (Sub-tareas) */}
            <Route path="/tareas/:tareaId/checklist_items/crear" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioChecklistItemPage />
              </PrivateRoute>
            } />
            <Route path="/tareas/:tareaId/checklist_items/editar/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioChecklistItemPage />
              </PrivateRoute>
            } />

            {/* Avisos - Crear/Editar/Eliminar solo para Supervisor/Responsable */}
            <Route path="/avisos" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <AvisosPage />
              </PrivateRoute>
            } />
            <Route path="/avisos/crear" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioAvisoPage />
              </PrivateRoute>
            } />
            <Route path="/avisos/editar/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                <FormularioAvisoPage />
              </PrivateRoute>
            } />
            <Route path="/avisos/:id" element={
              <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'ANALISTA']}>
                <DetalleAvisoPage />
              </PrivateRoute>
            } />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

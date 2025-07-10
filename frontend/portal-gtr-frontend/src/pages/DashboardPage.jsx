// src/pages/DashboardPage.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

function DashboardPage() {
  const { user } = useAuth(); // Obtiene la información del usuario del contexto

  return (
    <div className="container mt-4">
      {user ? (
        <>
          <h2 className="text-center">Bienvenido al Dashboard, {user.nombre} {user.apellido} ({user.role})</h2>
          <p className="text-center">Aquí verás información relevante según tu rol y campañas asignadas.</p>
          {/* Contenido del dashboard se agregará aquí */}
        </>
      ) : (
        <h2 className="text-center">Cargando Dashboard...</h2>
      )}
    </div>
  );
}

export default DashboardPage;
